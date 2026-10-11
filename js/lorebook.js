// ═══════════════════════════════════════════════════════
// LOREBOOK EDITOR — the entry list and tabs, the entry editor form, saving, ordering, zoom and the
// lorebook's global settings.
// ═══════════════════════════════════════════════════════

import { openFullscreen } from './fullscreen.js';
import { itemUndoCanRedo, itemUndoCanUndo, itemUndoGet, itemUndoPush, itemUndoStacks, wireFieldUndoRedo } from './history.js';
import { blankEntry, normalizeEntry } from './lorebook_model.js';
import { state } from './state.js';
import { loreSnapshotSoon, safeSet, saveToStorage } from './storage.js';
import { openEntryPicker } from './templates.js';
import { askConfirm, closeModal, esc, g, openModal, toast } from './util.js';
import { commitActiveEditor } from './workshop.js';

export function createEntry() {
  const uid = state.nextUid++;
  state.lorebook.entries[uid] = blankEntry(uid);
  renderList();
  openInTab(uid);
}

// Entries get renumbered when one is inserted or copied. Everything that
// remembers an entry by uid (open tabs, selection, unsaved marks, form
// state, undo stacks) has to follow the renumbering, or a tab silently
// ends up pointing at a different entry and edits save into the wrong one.
export function remapEntryUids(map) {
  if (!map.size) return;
  const m = u => (map.has(u) ? map.get(u) : u);
  state.openTabs = state.openTabs.map(m);
  if (state.activeTabId !== null) state.activeTabId = m(state.activeTabId);
  state.selectedEntries = state.selectedEntries.map(m);
  state.unsaved = new Set([...state.unsaved].map(m));
  const fs = {};
  Object.keys(state.formState).forEach(k => { fs[isNaN(k) ? k : m(Number(k))] = state.formState[k]; });
  state.formState = fs;
  const moved = {};
  Object.keys(itemUndoStacks).forEach(k => {
    if (!k.startsWith('lore:')) return;
    const id = k.slice(5);
    if (!isNaN(id) && map.has(Number(id))) { moved[k] = itemUndoStacks[k]; delete itemUndoStacks[k]; }
  });
  Object.keys(moved).forEach(k => { itemUndoStacks['lore:' + m(Number(k.slice(5)))] = moved[k]; });
}

// Shift every entry at or after `fromUid` up by one; returns the old->new map.
export function shiftEntriesFrom(fromUid) {
  // Bank whatever is typed in open forms first: they are keyed by the old uids
  commitActiveEditor();
  const map = new Map();
  Object.values(state.lorebook.entries).forEach(en => {
    if (en.uid >= fromUid) {
      map.set(en.uid, en.uid + 1);
      en.uid++; en.order = en.uid; en.displayIndex = en.uid;
    }
  });
  remapEntryUids(map);
  return map;
}

export function finishInsert(newEntry) {
  const rebuilt = {};
  Object.values(state.lorebook.entries).forEach(en => { rebuilt[en.uid] = en; });
  rebuilt[newEntry.uid] = newEntry;
  state.lorebook.entries = rebuilt;
  state.nextUid = Math.max(...Object.keys(rebuilt).map(Number)) + 1;
  renderList(); openInTab(newEntry.uid);
  saveToStorage();
  loreSnapshotSoon();
}

export function insertAbove(targetUid) {
  shiftEntriesFrom(targetUid);
  finishInsert(blankEntry(targetUid));
}

export function insertBelow(targetUid) {
  const newUid = targetUid + 1;
  shiftEntriesFrom(newUid);
  finishInsert(blankEntry(newUid));
}

export function copyEntry(srcUid) {
  const src = state.lorebook.entries[srcUid]; if (!src) return;
  const newUid = srcUid + 1;
  const cp = JSON.parse(JSON.stringify(src));
  shiftEntriesFrom(newUid);
  cp.uid = newUid; cp.order = newUid; cp.displayIndex = newUid;
  cp.comment = (cp.comment || 'Untitled') + ' (Copy)';
  finishInsert(cp);
}

export async function deleteSidebar(uid) {
  if (!await askConfirm('Delete this entry? This cannot be undone.')) return;
  delete state.lorebook.entries[uid];
  closeTab(uid);
  renderList();
  saveToStorage();
  loreSnapshotSoon();
}

// ═══════════════════════════════════════════════════════
// CLEAR / REORDER
// ═══════════════════════════════════════════════════════

export async function clearEditor() {
  if (Object.keys(state.lorebook.entries).length === 0) { toast('Already empty.', 'info'); return; }
  if (!await askConfirm('Clear all entries? Consider saving to Library first.')) return;
  state.lorebook = { entries: {} };
  state.openTabs = []; state.activeTabId = null; state.nextUid = 0;
  state.unsaved = new Set(); state.formState = {};
  g('lorebookName').value = '';
  renderList(); renderTabs(); renderEditor();
  saveToStorage();
  toast('Editor cleared.', 'ok');
}

export function reorderEntry(oldUid, newUid) {
  if (oldUid === newUid) return;
  if (newUid < 0) { renderList(); return; }
  const moving = state.lorebook.entries[oldUid]; if (!moving) return;
  commitActiveEditor();
  const arr = Object.values(state.lorebook.entries).sort((a,b) => a.uid - b.uid);
  const filtered = arr.filter(e => e.uid !== oldUid);
  const insertAt = Math.min(newUid, filtered.length);
  filtered.splice(insertAt, 0, moving);
  state.lorebook.entries = {};
  const map = new Map();
  filtered.forEach((en, i) => {
    map.set(en.uid, i);
    en.uid = i; en.displayIndex = i;
    state.lorebook.entries[i] = en;
  });
  remapEntryUids(map);
  state.nextUid = Math.max(...Object.keys(state.lorebook.entries).map(Number)) + 1;
  renderList(); renderTabs(); renderEditor();
  saveToStorage();
}

export function renderList() {
  const list = g('entryList');
  const count = g('entryCount');
  const clearBtn = g('clearSel');
  clearBtn.style.display = state.selectedEntries.length > 0 ? 'flex' : 'none';
  if (state.selectedEntries.length > 0) clearBtn.textContent = `☑ Clear (${state.selectedEntries.length})`;

  const entries = Object.values(state.lorebook.entries).sort((a,b) => a.uid - b.uid);
  count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  list.innerHTML = '';

  entries.forEach(en => {
    const li = document.createElement('li');
    li.className = 'ei';
    li.dataset.uid = en.uid;
    li.draggable = true;
    if (state.openTabs.includes(en.uid)) li.classList.add('open');
    if (state.selectedEntries.includes(en.uid)) li.classList.add('sel');

    // Drag
    li.addEventListener('dragstart', e => {
      state.draggedEntries = state.selectedEntries.includes(en.uid) ? [...state.selectedEntries].sort((a,b)=>a-b) : [en.uid];
      e.dataTransfer.effectAllowed = 'move';
      li.style.opacity = '.4';
    });
    li.addEventListener('dragover', e => { e.preventDefault(); li.style.borderTop = '2px solid var(--p)'; });
    li.addEventListener('dragleave', () => { li.style.borderTop = ''; });
    li.addEventListener('drop', e => {
      e.stopPropagation(); li.style.borderTop = '';
      if (!state.draggedEntries.includes(en.uid)) moveDragged(state.draggedEntries, en.uid);
    });
    li.addEventListener('dragend', () => { li.style.opacity = '1'; list.querySelectorAll('.ei').forEach(x => x.style.borderTop = ''); state.draggedEntries = []; });

    // Header
    const head = document.createElement('div');
    head.className = 'ei-head';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'ei-cb'; cb.checked = state.selectedEntries.includes(en.uid);
    cb.addEventListener('click', e2 => e2.stopPropagation());
    cb.addEventListener('change', () => {
      const idx = state.selectedEntries.indexOf(en.uid);
      if (idx > -1) state.selectedEntries.splice(idx, 1); else state.selectedEntries.push(en.uid);
      renderList();
    });

    const num = document.createElement('input');
    num.type = 'number'; num.className = 'ei-num'; num.value = en.uid; num.min = 0;
    num.addEventListener('click', e2 => e2.stopPropagation());
    num.addEventListener('change', e2 => { e2.stopPropagation(); reorderEntry(en.uid, parseInt(e2.target.value)); });

    const emoji = document.createElement('span');
    emoji.className = 'ei-emoji';
    emoji.textContent = en.disable ? '⚫' : en.constant ? '🔵' : en.vectorized ? '🔗' : '🟢';

    const name = document.createElement('div');
    name.className = 'ei-name';
    name.textContent = en.comment || 'Untitled Entry';

    head.append(cb, num, emoji, name);
    li.append(head);

    // Action buttons
    const acts = document.createElement('div');
    acts.className = 'ei-acts';
    [
      ['↑+', 'Insert above', () => insertAbove(en.uid), ''],
      ['↓+', 'Insert below', () => insertBelow(en.uid), ''],
      ['⧉', 'Copy entry', () => copyEntry(en.uid), ''],
      ['✕', 'Delete entry', () => deleteSidebar(en.uid), 'del'],
    ].forEach(([label, title, fn, cls]) => {
      const b = document.createElement('button');
      b.className = 'ei-act' + (cls ? ' ' + cls : '');
      b.title = title; b.textContent = label;
      b.addEventListener('click', e2 => { e2.stopPropagation(); fn(); });
      acts.append(b);
    });
    li.append(acts);

    // Keywords (normal + zoomed)
    if (state.zoomLevel >= 1 && en.key && en.key.length > 0) {
      const kws = document.createElement('div');
      kws.className = 'ei-kws';
      const show = state.zoomLevel === 2 ? 5 : 3;
      en.key.slice(0, show).forEach(k => {
        const t = document.createElement('span'); t.className = 'kw-tag'; t.textContent = k; kws.append(t);
      });
      if (en.key.length > show) {
        const t = document.createElement('span'); t.className = 'kw-tag'; t.textContent = `+${en.key.length - show}`; kws.append(t);
      }
      li.append(kws);
      const st = document.createElement('div'); st.className = 'ei-status';
      if (en.constant) { const b = document.createElement('span'); b.className='sb-badge sb-const'; b.textContent='Constant'; st.append(b); }
      if (en.disable) { const b = document.createElement('span'); b.className='sb-badge sb-dis'; b.textContent='Disabled'; st.append(b); }
      li.append(st);
    }
    // Content preview when zoomed in
    if (state.zoomLevel === 2 && en.content) {
      const prev = document.createElement('div'); prev.className = 'ei-preview'; prev.textContent = en.content; li.append(prev);
    }

    li.addEventListener('click', () => openInTab(en.uid));
    list.append(li);
  });
}

export function moveDragged(uids, targetUid) {
  commitActiveEditor();
  const arr = Object.values(state.lorebook.entries).sort((a,b) => a.uid - b.uid);
  const moving = arr.filter(e => uids.includes(e.uid));
  const rest = arr.filter(e => !uids.includes(e.uid));
  const ti = rest.findIndex(e => e.uid === targetUid);
  if (ti === -1) return;
  rest.splice(ti, 0, ...moving);
  state.lorebook.entries = {};
  const map = new Map();
  rest.forEach((en, i) => { map.set(en.uid, i); en.uid = i; en.displayIndex = i; state.lorebook.entries[i] = en; });
  remapEntryUids(map);
  state.nextUid = Math.max(...Object.keys(state.lorebook.entries).map(Number)) + 1;
  renderList(); renderTabs(); renderEditor();
  saveToStorage();
}

// ═══════════════════════════════════════════════════════
// ZOOM
// ═══════════════════════════════════════════════════════
export function changeZoom(d) {
  state.zoomLevel = Math.max(0, Math.min(2, state.zoomLevel + d));
  applyZoom();
  safeSet('aet_zoom', String(state.zoomLevel));
  renderList();
}
export function applyZoom() {
  const sb = g('sidebar');
  sb.classList.remove('zoom-out','zoom-in');
  g('zoomLabel').textContent = ['Compact','Normal','Detailed'][state.zoomLevel];
  if (state.zoomLevel === 0) sb.classList.add('zoom-out');
  if (state.zoomLevel === 2) sb.classList.add('zoom-in');
}

export function handleSbSearch(e) {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.ei').forEach(li => {
    const name = li.querySelector('.ei-name')?.textContent.toLowerCase() || '';
    const kws = [...li.querySelectorAll('.kw-tag')].map(t => t.textContent.toLowerCase());
    li.style.display = (!q || name.includes(q) || kws.some(k => k.includes(q))) ? '' : 'none';
  });
}

export function clearSelection() { state.selectedEntries = []; renderList(); }

// ═══════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════
export function openInTab(uid) {
  if (!state.openTabs.includes(uid)) state.openTabs.push(uid);
  state.activeTabId = uid;
  renderTabs(); renderEditor();
}

export function closeTab(uid) {
  const i = state.openTabs.indexOf(uid);
  if (i > -1) state.openTabs.splice(i, 1);
  if (state.activeTabId === uid) state.activeTabId = state.openTabs.length > 0 ? state.openTabs[state.openTabs.length - 1] : null;
  state.unsaved.delete(uid);
  delete state.formState[uid];
  renderTabs(); renderEditor();
}

export function toggleView() {
  state.sideBySide = !state.sideBySide;
  g('viewToggle').textContent = state.sideBySide ? '▦' : '▥';
  renderEditor();
}

export function renderTabs() {
  const bar = g('tabBar');
  bar.innerHTML = '';
  state.openTabs.forEach(uid => {
    const en = state.lorebook.entries[uid];
    if (!en && uid !== 'help-tab') return;
    const isUnsaved = state.unsaved.has(uid);
    const emoji = en ? (en.disable?'⚫':en.constant?'🔵':en.vectorized?'🔗':'🟢') : '📖';
    const label = (isUnsaved ? '● ' : '') + emoji + ' ' + (en ? (en.comment || 'Untitled') : 'Help');

    const tab = document.createElement('button');
    tab.className = 'tab' + (uid === state.activeTabId ? ' active' : '');
    const span = document.createElement('span');
    span.textContent = label;
    if (isUnsaved) span.style.color = '#f0a830';
    const x = document.createElement('span');
    x.className = 'tab-x'; x.textContent = '×';
    x.addEventListener('click', e => { e.stopPropagation(); closeTab(uid); });
    tab.append(span, x);
    tab.addEventListener('click', () => { state.activeTabId = uid; renderTabs(); renderEditor(); });
    bar.append(tab);
  });
}

// ═══════════════════════════════════════════════════════
// EDITOR RENDER
// ═══════════════════════════════════════════════════════
export function renderEditor() {
  const ec = g('editorContent');
  if (state.openTabs.length === 0) {
    ec.className = ''; ec.style.display = '';
    ec.innerHTML = `<div class="empty-state"><div>// select an entry to begin</div><button class="btn btn-ok" id="newEntryBtnAlt">+ New Entry</button></div>`;
    g('newEntryBtnAlt').onclick = openEntryPicker;
    return;
  }
  if (state.sideBySide && state.openTabs.length > 1) {
    ec.className = 'editor-grid';
    ec.innerHTML = '';
    state.openTabs.forEach(uid => {
      const panel = document.createElement('div');
      panel.className = 'editor-panel';
      const en = state.lorebook.entries[uid];
      if (!en) return;
      try {
        panel.innerHTML = buildEditorHTML(en, uid);
        attachEditorEvents(panel, uid);
      } catch(err) {
        panel.innerHTML = `<div style="padding:1rem;color:var(--err);font-family:var(--fx);font-size:.8rem">Error rendering entry #${uid}: ${err.message}</div>`;
        console.error('buildEditorHTML error', uid, err);
      }
      ec.append(panel);
    });
  } else {
    ec.className = '';
    if (state.activeTabId === null || !state.lorebook.entries[state.activeTabId]) {
      ec.innerHTML = `<div class="empty-state"><div>// select an entry to begin</div><button class="btn btn-ok" id="newEntryBtnAlt">+ New Entry</button></div>`;
      g('newEntryBtnAlt').onclick = openEntryPicker;
      return;
    }
    const en = state.lorebook.entries[state.activeTabId];
    try {
      ec.innerHTML = buildEditorHTML(en, state.activeTabId);
      attachEditorEvents(ec, state.activeTabId);
    } catch(err) {
      ec.innerHTML = `<div style="padding:1rem;color:var(--err);font-family:var(--fx);font-size:.8rem">Error rendering entry #${state.activeTabId}: ${err.message}</div>`;
      console.error('buildEditorHTML error', state.activeTabId, err);
    }
  }
}

export function buildEditorHTML(en, uid) {
  normalizeEntry(en);
  const s = state.formState[uid] || {};
  const get = (key, fallback) => s[key] !== undefined ? s[key] : fallback;

  const comment = get('comment', en.comment || '');
  const content = get('content', en.content || '');
  const kw = get('keywords', en.key.join(', '));
  const kw2 = get('keywordsSecondary', en.keysecondary.join(', '));
  const logic = get('selectiveLogic', en.selectiveLogic);
  const pos = parseInt(get('position', en.position));
  const depth = get('depth', en.depth);
  const scanDepth = get('scanDepth', en.scanDepth !== null ? en.scanDepth : '');
  const order = get('order', en.order);
  const prob = get('probability', en.probability);
  const useProb = get('useProbability', en.useProbability);
  const sticky = get('sticky', en.sticky);
  const cooldown = get('cooldown', en.cooldown);
  const delay2 = get('delay', en.delay);
  const group = get('group', en.group || '');
  const gw = get('groupWeight', en.groupWeight);
  const aid = get('automationId', en.automationId || '');
  const outletName = get('outletName', en.outletName || '');
  const role = get('role', en.role);
  const exRec = get('excludeRecursion', en.excludeRecursion);
  const prvRec = get('preventRecursion', en.preventRecursion);
  const delRec = get('delayUntilRecursion', en.delayUntilRecursion);
  const ignBudget = get('ignoreBudget', en.ignoreBudget);
  const cfExclude = get('charFilterIsExclude', en.characterFilter.isExclude);
  const cfNames = get('charFilterNames', en.characterFilter.names.join(', '));
  const cfTags = get('charFilterTags', en.characterFilter.tags.join(', '));
  const triggers = get('triggers', en.triggers);
  const cs = get('caseSensitive', en.caseSensitive);
  const mww = get('matchWholeWords', en.matchWholeWords);
  const ugs = get('useGroupScoring', en.useGroupScoring);

  const dis = get('disable', en.disable);
  const con = get('constant', en.constant);
  const vec = get('vectorized', en.vectorized);
  const act = dis ? 'inactive' : con ? 'constant' : vec ? 'vector' : 'keyword';

  const sel = (v, list) => list.map(([val,lbl]) => `<option value="${val}" ${v==val?'selected':''}>${lbl}</option>`).join('');
  const chk = v => v ? 'checked' : '';
  const tri = t => triggers.includes(t) ? 'checked' : '';

  return `<div class="entry-editor" data-uid="${uid}">
    <div class="fg">
      <div style="display:flex;gap:10px;align-items:flex-end">
        <div style="flex:0 0 auto">
          <label class="flabel">Activation</label>
          <select id="eAct-${uid}" class="fselect" style="min-width:60px">
            ${sel(act,[['constant','🔵 Constant'],['keyword','🟢 Keyword'],['vector','🔗 Vector'],['inactive','⚫ Inactive']])}
          </select>
        </div>
        <div style="flex:1">
          <label class="flabel">Name / Title</label>
          <input id="eName-${uid}" class="finput" value="${esc(comment)}" placeholder="Entry name...">
        </div>
      </div>
    </div>
    <div class="fg">
      <label class="flabel">Keywords</label>
      <div class="kw-row">
        <div class="kw-field"><label class="flabel-sm">Primary</label><input id="eKw-${uid}" class="finput" value="${esc(kw)}" placeholder="sword, magic, fire"></div>
        <div class="kw-logic"><label class="flabel-sm">Logic</label>
          <select id="eLogic-${uid}" class="fselect">${sel(logic,[[0,'AND ANY'],[1,'NOT ANY'],[2,'NOT ALL'],[3,'AND ALL']])}</select>
        </div>
        <div class="kw-field"><label class="flabel-sm">Secondary</label><input id="eKw2-${uid}" class="finput" value="${esc(kw2)}" placeholder="holy, blessed"></div>
      </div>
      <span class="form-note">Comma-separated. Secondary keywords are optional filters.</span>
    </div>
    <div class="fg">
      <label class="flabel">Content</label>
      <div class="content-wrap">
        <textarea id="eContent-${uid}" class="ftextarea">${esc(content)}</textarea>
        <span class="tok-count" id="eTok-${uid}">0 chars</span>
        <button class="expand-btn" data-field="eContent-${uid}" data-label="Content">⛶ expand</button>
      </div>
    </div>
    <div class="adv">
      <div class="adv-head" data-uid="${uid}">
        <span class="adv-title">⚙ Advanced Settings</span>
        <span class="adv-arr" id="eAdvArr-${uid}">▶</span>
      </div>
      <div class="adv-body" id="eAdvBody-${uid}">
        <div class="adv-grid">
          <div class="fg"><label class="flabel-sm">Order</label><input type="number" id="eOrder-${uid}" class="fnum" value="${esc(order)}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Insertion Position</label>
            <select id="ePos-${uid}" class="fselect">
              ${sel(pos,[[0,'↑Char'],[1,'↓Char'],[2,'↑AN'],[3,'↓AN'],[4,'@D (At Depth)'],[5,'↑EM'],[6,'↓EM'],[7,'Outlet']])}
            </select>
          </div>
          ${pos === 4 ? `
          <div class="fg"><label class="flabel-sm">Insertion Depth</label><input type="number" id="eDepth-${uid}" class="fnum" value="${esc(depth)}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Role</label>
            <select id="eRole-${uid}" class="fselect">
              ${sel(role === null ? 'null' : role, [['null','None'],['0','⚙ System'],['1','👤 User'],['2','🤖 Assistant']])}
            </select>
          </div>` : `
          <div class="fg"><label class="flabel-sm">Depth</label><input type="number" id="eDepth-${uid}" class="fnum" value="${esc(depth)}" min="0"></div>
          `}
          ${pos === 7 ? `<div class="fg"><label class="flabel-sm">Outlet Name</label><input id="eOutlet-${uid}" class="finput" value="${esc(outletName)}" placeholder="Outlet name..."></div>` : ''}
          <div class="fg"><label class="flabel-sm">Scan Depth Override</label><input type="number" id="eScan-${uid}" class="fnum" value="${esc(scanDepth)}" min="0" placeholder="global"></div>
          <div class="fg"><label class="flabel-sm">Case Sensitive</label>
            <select id="eCS-${uid}" class="fselect">${sel(cs===null?'null':String(cs),[['null','Use Global'],['true','Yes'],['false','No']])}</select>
          </div>
          <div class="fg"><label class="flabel-sm">Whole Words</label>
            <select id="eMWW-${uid}" class="fselect">${sel(mww===null?'null':String(mww),[['null','Use Global'],['true','Yes'],['false','No']])}</select>
          </div>
          <div class="fg"><label class="flabel-sm">Group Scoring</label>
            <select id="eUGS-${uid}" class="fselect">${sel(ugs===null?'null':String(ugs),[['null','Use Global'],['true','Yes'],['false','No']])}</select>
          </div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="eUseProb-${uid}" ${chk(useProb)}><span class="flabel-sm">Use Probability</span></label></div>
          <div class="fg"><label class="flabel-sm">Probability %</label><input type="number" id="eProb-${uid}" class="fnum" value="${esc(prob)}" min="0" max="100"></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="eExRec-${uid}" ${chk(exRec)}><span class="flabel-sm">Exclude Recursion</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="ePrvRec-${uid}" ${chk(prvRec)}><span class="flabel-sm">Prevent Recursion</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="eDelRec-${uid}" ${chk(delRec)}><span class="flabel-sm">Delay Until Recursion</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="eIgnBudget-${uid}" ${chk(ignBudget)}><span class="flabel-sm">Ignore Budget</span></label></div>
          <div class="fg"><label class="flabel-sm">Sticky</label><input type="number" id="eSticky-${uid}" class="fnum" value="${esc(sticky)}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Cooldown</label><input type="number" id="eCooldown-${uid}" class="fnum" value="${esc(cooldown)}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Delay</label><input type="number" id="eDelay-${uid}" class="fnum" value="${esc(delay2)}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Group</label><input id="eGroup-${uid}" class="finput" value="${esc(group)}" placeholder="Group name..."></div>
          <div class="fg"><label class="flabel-sm">Group Weight</label><input type="number" id="eGW-${uid}" class="fnum" value="${esc(gw)}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Automation ID</label><input id="eAID-${uid}" class="finput" value="${esc(aid)}" placeholder="Automation ID..."></div>

          <div class="fg" style="grid-column:1/-1">
            <label class="flabel-sm">Generation Triggers <span class="form-note" style="display:inline">(empty = all)</span></label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.35rem;margin-top:.35rem">
              ${['Normal','Continue','Impersonate','Swipe','Regenerate','Quiet'].map(t =>
                `<label class="cb-row"><input type="checkbox" class="trig-cb" data-trigger="${esc(t)}" ${tri(t)}><span class="flabel-sm">${t}</span></label>`
              ).join('')}
            </div>
          </div>
          <div class="fg" style="grid-column:1/-1">
            <label class="flabel-sm">Additional Matching Sources</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:.35rem;margin-top:.35rem">
              ${[['eMatchPersona','matchPersonaDescription','Persona Description'],
                 ['eMatchCharDesc','matchCharacterDescription','Char Description'],
                 ['eMatchCharPers','matchCharacterPersonality','Char Personality'],
                 ['eMatchCharDepth','matchCharacterDepthPrompt','Char Depth Prompt'],
                 ['eMatchScenario','matchScenario','Scenario'],
                 ['eMatchCreator','matchCreatorNotes',"Creator's Notes"]
              ].map(([id,key,lbl]) =>
                `<label class="cb-row"><input type="checkbox" id="${id}-${uid}" ${get(key,en[key])?'checked':''}><span class="flabel-sm">${lbl}</span></label>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="editor-actions">
      <button class="btn btn-p save-btn" data-uid="${uid}">Save Changes</button>
      <button class="btn btn-s item-ur-btn entry-undo-btn" data-uid="${uid}" title="Undo entry change" disabled>↩ Undo</button>
      <button class="btn btn-s item-ur-btn entry-redo-btn" data-uid="${uid}" title="Redo entry change" disabled>Redo ↪</button>
      <button class="btn btn-err del-btn" data-uid="${uid}">Delete Entry</button>
    </div>
  </div>`;
}

export function attachEditorEvents(container, uid) {
  // Save / Delete
  container.querySelector(`.save-btn[data-uid="${uid}"]`)?.addEventListener('click', () => saveEntry(uid));
  // Same path as the sidebar delete, so both confirm, save, and snapshot the same way
  container.querySelector(`.del-btn[data-uid="${uid}"]`)?.addEventListener('click', () => deleteSidebar(uid));

  // Expand buttons
  container.querySelectorAll('.expand-btn[data-field]').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); openFullscreen(btn.dataset.field, btn.dataset.label); });
  });

  // Advanced toggle
  const advHead = container.querySelector(`.adv-head[data-uid="${uid}"]`);
  if (advHead) advHead.addEventListener('click', () => {
    container.querySelector(`#eAdvBody-${uid}`)?.classList.toggle('open');
    container.querySelector(`#eAdvArr-${uid}`)?.classList.toggle('open');
    advHead.classList.toggle('open');
  });

  // Position change -> save & re-render to show/hide conditional fields
  const posEl = container.querySelector(`#ePos-${uid}`);
  if (posEl) posEl.addEventListener('change', () => { saveEntry(uid); renderEditor(); });

  // Token counter
  const ta = container.querySelector(`#eContent-${uid}`);
  const tok = container.querySelector(`#eTok-${uid}`);
  if (ta && tok) {
    const update = () => {
      const c = ta.value.length;
      const t = Math.ceil(c / 4);
      tok.textContent = `${c} chars · ~${t} tok`;
      tok.className = 'tok-count' + (t > 1500 ? ' tok-over' : t > 800 ? ' tok-warn' : '');
    };
    ta.addEventListener('input', update);
    update();
  }

  // Mark unsaved on any input change
  const markUnsaved = () => {
    state.unsaved.add(uid);
    captureState(uid, container);
    itemUndoPush('lore', uid, JSON.parse(JSON.stringify(state.formState[uid] || {})));
    renderTabs();
    syncEntryUndoButtons(uid, container);
  };
  container.querySelectorAll('input,textarea,select').forEach(el => {
    el.addEventListener('input', markUnsaved);
    el.addEventListener('change', markUnsaved);
  });

  // Wire entry-level undo/redo buttons
  const undoBtn = container.querySelector(`.entry-undo-btn[data-uid="${uid}"]`);
  const redoBtn = container.querySelector(`.entry-redo-btn[data-uid="${uid}"]`);
  if (undoBtn) undoBtn.addEventListener('click', () => applyEntryUndo(uid, 'undo', container));
  if (redoBtn) redoBtn.addEventListener('click', () => applyEntryUndo(uid, 'redo', container));

  // Push initial state so undo has a baseline
  captureState(uid, container);
  itemUndoPush('lore', uid, JSON.parse(JSON.stringify(state.formState[uid] || {})));

  // Wire field-level undo/redo on all textareas
  wireFieldUndoRedo(container);
}

// ═══════════════════════════════════════════════════════
// ENTRY UNDO/REDO HELPERS
// ═══════════════════════════════════════════════════════

export function syncEntryUndoButtons(uid, container) {
  const undoBtn = container?.querySelector(`.entry-undo-btn[data-uid="${uid}"]`);
  const redoBtn = container?.querySelector(`.entry-redo-btn[data-uid="${uid}"]`);
  if (undoBtn) undoBtn.disabled = !itemUndoCanUndo('lore', uid);
  if (redoBtn) redoBtn.disabled = !itemUndoCanRedo('lore', uid);
}

export function applyEntryUndo(uid, direction, container) {
  const snapshot = itemUndoGet('lore', uid, direction);
  if (!snapshot) return;
  // Restore formState and re-render editor
  state.formState[uid] = snapshot;
  state.unsaved.add(uid);
  renderEditor(); // re-renders from formState
  renderTabs();
  // Sync buttons after re-render (container changes on re-render)
  const newContainer = document.querySelector(`.entry-editor[data-uid="${uid}"]`);
  syncEntryUndoButtons(uid, newContainer);
}

// ═══════════════════════════════════════════════════════
// SAVE ENTRY
// ═══════════════════════════════════════════════════════
export function captureState(uid, container) {
  const s = {};
  const gid = id => container ? container.querySelector(`#${id}-${uid}`) : g(`${id}-${uid}`);
  const chk = id => gid(id)?.checked;
  const val = id => gid(id)?.value;

  s.comment = val('eName');
  s.content = val('eContent');
  s.keywords = val('eKw');
  s.keywordsSecondary = val('eKw2');
  s.selectiveLogic = val('eLogic');
  const act = val('eAct');
  s.disable = act === 'inactive'; s.constant = act === 'constant'; s.vectorized = act === 'vector';
  s.order = val('eOrder'); s.position = val('ePos'); s.depth = val('eDepth');
  s.scanDepth = val('eScan'); s.caseSensitive = val('eCS'); s.matchWholeWords = val('eMWW');
  s.useGroupScoring = val('eUGS'); s.probability = val('eProb'); s.useProbability = chk('eUseProb');
  s.sticky = val('eSticky'); s.cooldown = val('eCooldown'); s.delay = val('eDelay');
  s.group = val('eGroup'); s.groupWeight = val('eGW'); s.automationId = val('eAID');
  s.outletName = val('eOutlet') || ''; s.role = val('eRole');
  s.excludeRecursion = chk('eExRec'); s.preventRecursion = chk('ePrvRec');
  s.delayUntilRecursion = chk('eDelRec'); s.ignoreBudget = chk('eIgnBudget');
  const cfInc = container ? container.querySelector(`input[name="cfMode-${uid}"][value="include"]`) : document.querySelector(`input[name="cfMode-${uid}"][value="include"]`);
  s.charFilterIsExclude = cfInc ? !cfInc.checked : false;
  s.charFilterNames = val('eCFN') || ''; s.charFilterTags = val('eCFT') || '';
  const trigCbs = container ? container.querySelectorAll(`#eAdvBody-${uid} .trig-cb`) : document.querySelectorAll(`#eAdvBody-${uid} .trig-cb`);
  if (trigCbs.length) s.triggers = [...trigCbs].filter(c => c.checked).map(c => c.dataset.trigger);
  s.matchPersonaDescription = chk('eMatchPersona'); s.matchCharacterDescription = chk('eMatchCharDesc');
  s.matchCharacterPersonality = chk('eMatchCharPers'); s.matchCharacterDepthPrompt = chk('eMatchCharDepth');
  s.matchScenario = chk('eMatchScenario'); s.matchCreatorNotes = chk('eMatchCreator');
  state.formState[uid] = s;
}

export function saveEntry(uid, opts = {}) {
  const en = state.lorebook.entries[uid]; if (!en) return;
  const gid = id => g(`${id}-${uid}`);
  const num = id => parseInt(gid(id)?.value) || 0;
  const str = id => gid(id)?.value || '';
  const chk = id => gid(id)?.checked || false;
  const nullableStr = id => { const v = gid(id)?.value; return (!v || v === 'null') ? null : v; };
  const nullable3 = id => { const v = gid(id)?.value; return v === 'null' ? null : v === 'true'; };

  en.comment = str('eName');
  en.content = str('eContent');
  en.key = str('eKw').split(',').map(k=>k.trim()).filter(Boolean);
  en.keysecondary = str('eKw2').split(',').map(k=>k.trim()).filter(Boolean);
  en.selective = en.keysecondary.length > 0;
  en.selectiveLogic = parseInt(str('eLogic')) || 0;
  const act = str('eAct');
  en.disable = act === 'inactive'; en.constant = act === 'constant'; en.vectorized = act === 'vector';
  en.order = num('eOrder'); en.position = num('ePos'); en.depth = num('eDepth');
  const sd = str('eScan'); en.scanDepth = sd === '' ? null : parseInt(sd);
  en.caseSensitive = nullable3('eCS'); en.matchWholeWords = nullable3('eMWW'); en.useGroupScoring = nullable3('eUGS');
  en.probability = num('eProb'); en.useProbability = chk('eUseProb');
  en.excludeRecursion = chk('eExRec'); en.preventRecursion = chk('ePrvRec');
  en.delayUntilRecursion = chk('eDelRec'); en.ignoreBudget = chk('eIgnBudget');
  en.sticky = num('eSticky'); en.cooldown = num('eCooldown'); en.delay = num('eDelay');
  en.group = str('eGroup'); en.groupWeight = num('eGW'); en.automationId = str('eAID');
  const roleEl = gid('eRole'); if (roleEl) { const rv = roleEl.value; en.role = rv === 'null' ? null : parseInt(rv); }
  const outletEl = gid('eOutlet'); if (outletEl) en.outletName = outletEl.value; else if (en.position !== 7) en.outletName = '';
  const cfInc = document.querySelector(`input[name="cfMode-${uid}"][value="include"]`);
  if (cfInc) en.characterFilter.isExclude = !cfInc.checked;
  en.characterFilter.names = str('eCFN').split(',').map(n=>n.trim()).filter(Boolean);
  en.characterFilter.tags = str('eCFT').split(',').map(t=>t.trim()).filter(Boolean);
  const trigCbs = document.querySelectorAll(`#eAdvBody-${uid} .trig-cb`);
  if (trigCbs.length) en.triggers = [...trigCbs].filter(c=>c.checked).map(c=>c.dataset.trigger);
  en.matchPersonaDescription = chk('eMatchPersona'); en.matchCharacterDescription = chk('eMatchCharDesc');
  en.matchCharacterPersonality = chk('eMatchCharPers'); en.matchCharacterDepthPrompt = chk('eMatchCharDepth');
  en.matchScenario = chk('eMatchScenario'); en.matchCreatorNotes = chk('eMatchCreator');

  state.unsaved.delete(uid); delete state.formState[uid];
  renderList(); renderTabs(); saveToStorage();
  // Autosaves skip the version-history snapshot (see commitActiveEditor)
  if (!opts.noSnapshot) loreSnapshotSoon();
}

// ═══════════════════════════════════════════════════════
// GLOBAL LOREBOOK SETTINGS MODAL
// ═══════════════════════════════════════════════════════

export function openLoreSettings() {
  const s = state.lorebook.settings || {};
  const el = id => document.getElementById(id);
  if (el('lsScanDepth')) el('lsScanDepth').value = s.scan_depth ?? 2;
  if (el('lsTokenBudget')) el('lsTokenBudget').value = s.token_budget ?? 2048;
  if (el('lsCaseSensitive')) el('lsCaseSensitive').checked = s.case_sensitive || false;
  if (el('lsMatchWholeWords')) el('lsMatchWholeWords').checked = s.match_whole_words || false;
  if (el('lsUseGroupScoring')) el('lsUseGroupScoring').checked = s.use_group_scoring || false;
  if (el('lsRecursiveScanning')) el('lsRecursiveScanning').checked = s.recursive_scanning || false;
  openModal('loreSettingsModal');
}

export function applyLoreSettings() {
  const el = id => document.getElementById(id);
  if (!state.lorebook.settings) state.lorebook.settings = {};
  state.lorebook.settings.scan_depth = parseInt(el('lsScanDepth')?.value) || 2;
  state.lorebook.settings.token_budget = parseInt(el('lsTokenBudget')?.value) || 2048;
  state.lorebook.settings.case_sensitive = el('lsCaseSensitive')?.checked || false;
  state.lorebook.settings.match_whole_words = el('lsMatchWholeWords')?.checked || false;
  state.lorebook.settings.use_group_scoring = el('lsUseGroupScoring')?.checked || false;
  state.lorebook.settings.recursive_scanning = el('lsRecursiveScanning')?.checked || false;
  closeModal('loreSettingsModal');
  toast('Lorebook settings updated.', 'ok');
}
