// ═══════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════
function handleImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      lorebook = data;
      if (!lorebook.name) lorebook.name = file.name.replace(/\.json$/i, '');
      g('lorebookName').value = lorebook.name;

      lorebook.entries = rebuildEntries(lorebook.entries);
      nextUid = Object.keys(lorebook.entries).length
        ? Math.max(...Object.keys(lorebook.entries).map(Number)) + 1
        : 0;

      openTabs = []; activeTabId = null; unsaved = new Set(); formState = {};
      renderList(); renderTabs(); renderEditor();
      saveToStorage();
      toast('Imported: ' + lorebook.name, 'ok');
    } catch(err) { toast('Import error: ' + err.message, 'err'); console.error(err); }
  };
  r.readAsText(file);
  e.target.value = '';
}

// Rebuild an entries object so every key == en.uid, handling collisions and arrays
function rebuildEntries(raw) {
  // Support both array-style and object-style entries
  const pairs = Array.isArray(raw)
    ? raw.map((en, i) => [i, en])
    : Object.entries(raw);

  const result = {};
  pairs.forEach(([origKey, en]) => {
    normalizeEntry(en);
    // Use the original object key as the authoritative uid
    // (en.uid inside the object is often unreliable / all-zero in some exports)
    const key = parseInt(origKey);
    if (!isNaN(key)) {
      en.uid = key;
      result[key] = en;
    }
  });
  return result;
}

function handleMergeImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      mergeStaging = JSON.parse(ev.target.result);
      if (!mergeStaging.name) mergeStaging.name = file.name.replace(/\.json$/i, '');
      mergeStaging.entries = rebuildEntries(mergeStaging.entries);
      mergeSelected = [];
      g('mergeCurrent').textContent = lorebook.name || 'Untitled';
      g('mergeFrom').textContent = mergeStaging.name;
      renderMergeList();
      openModal('mergeModal');
    } catch(err) { toast('Merge import error: ' + err.message, 'err'); console.error(err); }
  };
  r.readAsText(file);
  e.target.value = '';
}

function exportJson() {
  lorebook.name = g('lorebookName').value.trim() || 'lorebook';
  const fn = (lorebook.name || 'lorebook') + '.json';
  dlFile(JSON.stringify(lorebook, null, 2), fn, 'application/json');
  toast('Exported: ' + fn, 'ok');
}

function normalizeEntry(en) {
  // Core array fields — some lorebooks omit these or use null
  if (!Array.isArray(en.key)) en.key = en.keys || [];
  if (!Array.isArray(en.keysecondary)) en.keysecondary = en.keyssecondary || [];
  // uid must be a number
  if (en.uid === undefined || en.uid === null) en.uid = 0;
  en.uid = parseInt(en.uid) || 0;
  // Ensure numeric defaults
  if (en.order === undefined || en.order === null) en.order = en.uid;
  if (en.position === undefined) en.position = 0;
  if (en.depth === undefined || en.depth === null) en.depth = 4;
  if (en.probability === undefined) en.probability = 100;
  if (en.useProbability === undefined) en.useProbability = true;
  if (en.sticky === undefined) en.sticky = 0;
  if (en.cooldown === undefined) en.cooldown = 0;
  if (en.delay === undefined) en.delay = 0;
  if (en.groupWeight === undefined) en.groupWeight = 100;
  if (en.selectiveLogic === undefined) en.selectiveLogic = 0;
  if (en.content === undefined || en.content === null) en.content = '';
  if (en.comment === undefined || en.comment === null) en.comment = '';
  // Character filter
  if (!en.characterFilter) en.characterFilter = { isExclude: false, names: [], tags: [] };
  if (!Array.isArray(en.characterFilter.names)) en.characterFilter.names = [];
  if (!Array.isArray(en.characterFilter.tags)) en.characterFilter.tags = [];
  // Triggers
  if (!Array.isArray(en.triggers)) en.triggers = [];
  // Boolean flags
  ['matchPersonaDescription','matchCharacterDescription','matchCharacterPersonality',
   'matchCharacterDepthPrompt','matchScenario','matchCreatorNotes',
   'constant','disable','vectorized','selective','excludeRecursion','preventRecursion',
   'delayUntilRecursion','ignoreBudget'].forEach(k => {
    if (en[k] === undefined) en[k] = false;
  });
}

// ═══════════════════════════════════════════════════════
// ENTRY CREATION
// ═══════════════════════════════════════════════════════
function blankEntry(uid) {
  return {
    uid, key: [], keysecondary: [], comment: 'New Entry', content: '',
    constant: false, vectorized: false, selective: true, selectiveLogic: 0,
    addMemo: true, order: uid, position: 0, disable: false, ignoreBudget: false,
    excludeRecursion: true, preventRecursion: true, delayUntilRecursion: false,
    probability: 100, useProbability: true, depth: 4, outletName: '', group: '',
    groupOverride: false, groupWeight: 100, scanDepth: null, caseSensitive: null,
    matchWholeWords: null, useGroupScoring: null, automationId: '', role: null,
    sticky: 0, cooldown: 0, delay: 0, triggers: [], displayIndex: uid,
    characterFilter: { isExclude: false, names: [], tags: [] },
    matchPersonaDescription: false, matchCharacterDescription: false,
    matchCharacterPersonality: false, matchCharacterDepthPrompt: false,
    matchScenario: false, matchCreatorNotes: false
  };
}

function createEntry() {
  const uid = nextUid++;
  lorebook.entries[uid] = blankEntry(uid);
  renderList();
  openInTab(uid);
}

function insertAbove(targetUid) {
  Object.values(lorebook.entries).forEach(en => {
    if (en.uid >= targetUid) { en.uid++; en.order = en.uid; en.displayIndex = en.uid; }
  });
  const ne = blankEntry(targetUid);
  const rebuilt = {};
  Object.values(lorebook.entries).forEach(en => { rebuilt[en.uid] = en; });
  rebuilt[targetUid] = ne;
  lorebook.entries = rebuilt;
  nextUid = Math.max(...Object.keys(rebuilt).map(Number)) + 1;
  renderList(); openInTab(targetUid);
}

function insertBelow(targetUid) {
  const newUid = targetUid + 1;
  Object.values(lorebook.entries).forEach(en => {
    if (en.uid > targetUid) { en.uid++; en.order = en.uid; en.displayIndex = en.uid; }
  });
  const ne = blankEntry(newUid);
  const rebuilt = {};
  Object.values(lorebook.entries).forEach(en => { rebuilt[en.uid] = en; });
  rebuilt[newUid] = ne;
  lorebook.entries = rebuilt;
  nextUid = Math.max(...Object.keys(rebuilt).map(Number)) + 1;
  renderList(); openInTab(newUid);
}

function copyEntry(srcUid) {
  const src = lorebook.entries[srcUid]; if (!src) return;
  const newUid = srcUid + 1;
  Object.values(lorebook.entries).forEach(en => {
    if (en.uid > srcUid) { en.uid++; en.order = en.uid; en.displayIndex = en.uid; }
  });
  const cp = JSON.parse(JSON.stringify(src));
  cp.uid = newUid; cp.order = newUid; cp.displayIndex = newUid;
  cp.comment = (cp.comment || 'Untitled') + ' (Copy)';
  const rebuilt = {};
  Object.values(lorebook.entries).forEach(en => { rebuilt[en.uid] = en; });
  rebuilt[newUid] = cp;
  lorebook.entries = rebuilt;
  nextUid = Math.max(...Object.keys(rebuilt).map(Number)) + 1;
  renderList(); openInTab(newUid);
}

async function deleteSidebar(uid) {
  if (!await askConfirm('Delete this entry? This cannot be undone.')) return;
  delete lorebook.entries[uid];
  closeTab(uid);
  renderList();
  saveToStorage();
}

// ═══════════════════════════════════════════════════════
// CLEAR / REORDER
// ═══════════════════════════════════════════════════════
async function clearEditor() {
  if (Object.keys(lorebook.entries).length === 0) { toast('Already empty.', 'info'); return; }
  if (!await askConfirm('Clear all entries? Consider saving to Library first.')) return;
  lorebook = { entries: {} };
  openTabs = []; activeTabId = null; nextUid = 0;
  unsaved = new Set(); formState = {};
  g('lorebookName').value = '';
  renderList(); renderTabs(); renderEditor();
  saveToStorage();
  toast('Editor cleared.', 'ok');
}

function reorderEntry(oldUid, newUid) {
  if (oldUid === newUid) return;
  if (newUid < 0) { renderList(); return; }
  const moving = lorebook.entries[oldUid]; if (!moving) return;
  const arr = Object.values(lorebook.entries).sort((a,b) => a.uid - b.uid);
  const filtered = arr.filter(e => e.uid !== oldUid);
  const insertAt = Math.min(newUid, filtered.length);
  filtered.splice(insertAt, 0, moving);
  lorebook.entries = {};
  filtered.forEach((en, i) => {
    const old = en.uid;
    en.uid = i; en.displayIndex = i;
    lorebook.entries[i] = en;
    const ti = openTabs.indexOf(old);
    if (ti > -1) openTabs[ti] = i;
    if (activeTabId === old) activeTabId = i;
  });
  nextUid = Math.max(...Object.keys(lorebook.entries).map(Number)) + 1;
  renderList(); renderTabs(); renderEditor();
}

// ═══════════════════════════════════════════════════════
// SIDEBAR RENDER
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// MODE SWITCHING
// ═══════════════════════════════════════════════════════
function switchMode(newMode) {
  // Navigate to editor view when switching modes
  if (typeof navigateTo === 'function') navigateTo('editor');

  mode = newMode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === newMode));

  // View toggle only makes sense in lorebook mode
  g('viewToggle').style.display = newMode === 'lore' ? '' : 'none';
  if (newMode !== 'lore') { sideBySide = false; }

  // Show/hide mode headers (lore/char/preset have headers; stubs get empty placeholder)
  ['lore','char','preset','persona','prompt','regex'].forEach(m => {
    const el = g('hdr-' + m);
    if (el) el.style.display = newMode === m ? '' : 'none';
  });

  // Lorebook name input only in lorebook mode
  g('lorebookName').style.display = newMode === 'lore' ? '' : 'none';
  g('nameLabel').style.display = newMode === 'lore' ? '' : 'none';

  const sbTitle = g('sbTitle');
  g('entryList').innerHTML = '';
  g('tabBar').innerHTML = '';

  if (newMode === 'lore') {
    sbTitle.textContent = 'Entries';
    g('zoomRow').style.display = '';
    g('sbSearch').placeholder = 'Search entries...';
    renderList(); renderTabs(); renderEditor();
  } else if (newMode === 'char') {
    sbTitle.textContent = 'Characters';
    g('zoomRow').style.display = 'none';
    g('sbSearch').placeholder = 'Search characters...';
    renderCharSidebar(); renderCharEditor();
  } else if (newMode === 'preset') {
    sbTitle.textContent = 'Presets';
    g('zoomRow').style.display = 'none';
    g('sbSearch').placeholder = 'Search presets...';
    renderPresetSidebar(); renderPresetEditor();
  }
}

function renderList() {
  const list = g('entryList');
  const count = g('entryCount');
  const clearBtn = g('clearSel');
  clearBtn.style.display = selectedEntries.length > 0 ? 'flex' : 'none';
  if (selectedEntries.length > 0) clearBtn.textContent = `☑ Clear (${selectedEntries.length})`;

  const entries = Object.values(lorebook.entries).sort((a,b) => a.uid - b.uid);
  count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  list.innerHTML = '';

  entries.forEach(en => {
    const li = document.createElement('li');
    li.className = 'ei';
    li.dataset.uid = en.uid;
    li.draggable = true;
    if (openTabs.includes(en.uid)) li.classList.add('open');
    if (selectedEntries.includes(en.uid)) li.classList.add('sel');

    // Drag
    li.addEventListener('dragstart', e => {
      draggedEntries = selectedEntries.includes(en.uid) ? [...selectedEntries].sort((a,b)=>a-b) : [en.uid];
      e.dataTransfer.effectAllowed = 'move';
      li.style.opacity = '.4';
    });
    li.addEventListener('dragover', e => { e.preventDefault(); li.style.borderTop = '2px solid var(--p)'; });
    li.addEventListener('dragleave', () => { li.style.borderTop = ''; });
    li.addEventListener('drop', e => {
      e.stopPropagation(); li.style.borderTop = '';
      if (!draggedEntries.includes(en.uid)) moveDragged(draggedEntries, en.uid);
    });
    li.addEventListener('dragend', () => { li.style.opacity = '1'; list.querySelectorAll('.ei').forEach(x => x.style.borderTop = ''); draggedEntries = []; });

    // Header
    const head = document.createElement('div');
    head.className = 'ei-head';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'ei-cb'; cb.checked = selectedEntries.includes(en.uid);
    cb.addEventListener('click', e2 => e2.stopPropagation());
    cb.addEventListener('change', () => {
      const idx = selectedEntries.indexOf(en.uid);
      if (idx > -1) selectedEntries.splice(idx, 1); else selectedEntries.push(en.uid);
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
    if (zoomLevel >= 1 && en.key && en.key.length > 0) {
      const kws = document.createElement('div');
      kws.className = 'ei-kws';
      const show = zoomLevel === 2 ? 5 : 3;
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
    if (zoomLevel === 2 && en.content) {
      const prev = document.createElement('div'); prev.className = 'ei-preview'; prev.textContent = en.content; li.append(prev);
    }

    li.addEventListener('click', () => openInTab(en.uid));
    list.append(li);
  });
}

function moveDragged(uids, targetUid) {
  const arr = Object.values(lorebook.entries).sort((a,b) => a.uid - b.uid);
  const moving = arr.filter(e => uids.includes(e.uid));
  const rest = arr.filter(e => !uids.includes(e.uid));
  const ti = rest.findIndex(e => e.uid === targetUid);
  if (ti === -1) return;
  rest.splice(ti, 0, ...moving);
  lorebook.entries = {};
  const map = new Map();
  rest.forEach((en, i) => { map.set(en.uid, i); en.uid = i; en.displayIndex = i; lorebook.entries[i] = en; });
  openTabs = openTabs.map(u => map.get(u) ?? u);
  if (activeTabId !== null) activeTabId = map.get(activeTabId) ?? activeTabId;
  selectedEntries = selectedEntries.map(u => map.get(u) ?? u);
  nextUid = Math.max(...Object.keys(lorebook.entries).map(Number)) + 1;
  renderList(); renderTabs(); renderEditor();
}


// ═══════════════════════════════════════════════════════
// ZOOM
// ═══════════════════════════════════════════════════════
function changeZoom(d) {
  zoomLevel = Math.max(0, Math.min(2, zoomLevel + d));
  applyZoom();
  localStorage.setItem('aet_zoom', zoomLevel);
  renderList();
}
function applyZoom() {
  const sb = g('sidebar');
  sb.classList.remove('zoom-out','zoom-in');
  g('zoomLabel').textContent = ['Compact','Normal','Detailed'][zoomLevel];
  if (zoomLevel === 0) sb.classList.add('zoom-out');
  if (zoomLevel === 2) sb.classList.add('zoom-in');
}

function handleSbSearch(e) {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.ei').forEach(li => {
    const name = li.querySelector('.ei-name')?.textContent.toLowerCase() || '';
    const kws = [...li.querySelectorAll('.kw-tag')].map(t => t.textContent.toLowerCase());
    li.style.display = (!q || name.includes(q) || kws.some(k => k.includes(q))) ? '' : 'none';
  });
}

function clearSelection() { selectedEntries = []; renderList(); }

// ═══════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════
function openInTab(uid) {
  if (!openTabs.includes(uid)) openTabs.push(uid);
  activeTabId = uid;
  renderTabs(); renderEditor();
}

function closeTab(uid) {
  const i = openTabs.indexOf(uid);
  if (i > -1) openTabs.splice(i, 1);
  if (activeTabId === uid) activeTabId = openTabs.length > 0 ? openTabs[openTabs.length - 1] : null;
  unsaved.delete(uid);
  delete formState[uid];
  renderTabs(); renderEditor();
}

function toggleView() {
  sideBySide = !sideBySide;
  g('viewToggle').textContent = sideBySide ? '▦' : '▥';
  renderEditor();
}

function renderTabs() {
  const bar = g('tabBar');
  bar.innerHTML = '';
  openTabs.forEach(uid => {
    const en = lorebook.entries[uid];
    if (!en && uid !== 'help-tab') return;
    const isUnsaved = unsaved.has(uid);
    const emoji = en ? (en.disable?'⚫':en.constant?'🔵':en.vectorized?'🔗':'🟢') : '📖';
    const label = (isUnsaved ? '● ' : '') + emoji + ' ' + (en ? (en.comment || 'Untitled') : 'Help');

    const tab = document.createElement('button');
    tab.className = 'tab' + (uid === activeTabId ? ' active' : '');
    const span = document.createElement('span');
    span.textContent = label;
    if (isUnsaved) span.style.color = '#f0a830';
    const x = document.createElement('span');
    x.className = 'tab-x'; x.textContent = '×';
    x.addEventListener('click', e => { e.stopPropagation(); closeTab(uid); });
    tab.append(span, x);
    tab.addEventListener('click', () => { activeTabId = uid; renderTabs(); renderEditor(); });
    bar.append(tab);
  });
}

// ═══════════════════════════════════════════════════════
// EDITOR RENDER
// ═══════════════════════════════════════════════════════
function renderEditor() {
  const ec = g('editorContent');
  if (openTabs.length === 0) {
    ec.className = ''; ec.style.display = '';
    ec.innerHTML = `<div class="empty-state"><div>// select an entry to begin</div><button class="btn btn-ok" id="newEntryBtnAlt">+ New Entry</button></div>`;
    g('newEntryBtnAlt').onclick = openEntryPicker;
    return;
  }
  if (sideBySide && openTabs.length > 1) {
    ec.className = 'editor-grid';
    ec.innerHTML = '';
    openTabs.forEach(uid => {
      const panel = document.createElement('div');
      panel.className = 'editor-panel';
      const en = lorebook.entries[uid];
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
    if (activeTabId === null || !lorebook.entries[activeTabId]) {
      ec.innerHTML = `<div class="empty-state"><div>// select an entry to begin</div><button class="btn btn-ok" id="newEntryBtnAlt">+ New Entry</button></div>`;
      g('newEntryBtnAlt').onclick = openEntryPicker;
      return;
    }
    const en = lorebook.entries[activeTabId];
    try {
      ec.innerHTML = buildEditorHTML(en, activeTabId);
      attachEditorEvents(ec, activeTabId);
    } catch(err) {
      ec.innerHTML = `<div style="padding:1rem;color:var(--err);font-family:var(--fx);font-size:.8rem">Error rendering entry #${activeTabId}: ${err.message}</div>`;
      console.error('buildEditorHTML error', activeTabId, err);
    }
  }
}

function buildEditorHTML(en, uid) {
  normalizeEntry(en);
  const s = formState[uid] || {};
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

  const esc = t => { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; };
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
          <div class="fg"><label class="flabel-sm">Order</label><input type="number" id="eOrder-${uid}" class="fnum" value="${order}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Insertion Position</label>
            <select id="ePos-${uid}" class="fselect">
              ${sel(pos,[[0,'↑Char'],[1,'↓Char'],[2,'↑AN'],[3,'↓AN'],[4,'@D (At Depth)'],[5,'↑EM'],[6,'↓EM'],[7,'Outlet']])}
            </select>
          </div>
          ${pos === 4 ? `
          <div class="fg"><label class="flabel-sm">Insertion Depth</label><input type="number" id="eDepth-${uid}" class="fnum" value="${depth}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Role</label>
            <select id="eRole-${uid}" class="fselect">
              ${sel(role === null ? 'null' : role, [['null','None'],['0','⚙ System'],['1','👤 User'],['2','🤖 Assistant']])}
            </select>
          </div>` : `
          <div class="fg"><label class="flabel-sm">Depth</label><input type="number" id="eDepth-${uid}" class="fnum" value="${depth}" min="0"></div>
          `}
          ${pos === 7 ? `<div class="fg"><label class="flabel-sm">Outlet Name</label><input id="eOutlet-${uid}" class="finput" value="${esc(outletName)}" placeholder="Outlet name..."></div>` : ''}
          <div class="fg"><label class="flabel-sm">Scan Depth Override</label><input type="number" id="eScan-${uid}" class="fnum" value="${scanDepth}" min="0" placeholder="global"></div>
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
          <div class="fg"><label class="flabel-sm">Probability %</label><input type="number" id="eProb-${uid}" class="fnum" value="${prob}" min="0" max="100"></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="eExRec-${uid}" ${chk(exRec)}><span class="flabel-sm">Exclude Recursion</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="ePrvRec-${uid}" ${chk(prvRec)}><span class="flabel-sm">Prevent Recursion</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="eDelRec-${uid}" ${chk(delRec)}><span class="flabel-sm">Delay Until Recursion</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="eIgnBudget-${uid}" ${chk(ignBudget)}><span class="flabel-sm">Ignore Budget</span></label></div>
          <div class="fg"><label class="flabel-sm">Sticky</label><input type="number" id="eSticky-${uid}" class="fnum" value="${sticky}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Cooldown</label><input type="number" id="eCooldown-${uid}" class="fnum" value="${cooldown}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Delay</label><input type="number" id="eDelay-${uid}" class="fnum" value="${delay2}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Group</label><input id="eGroup-${uid}" class="finput" value="${esc(group)}" placeholder="Group name..."></div>
          <div class="fg"><label class="flabel-sm">Group Weight</label><input type="number" id="eGW-${uid}" class="fnum" value="${gw}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Automation ID</label><input id="eAID-${uid}" class="finput" value="${esc(aid)}" placeholder="Automation ID..."></div>

          <div class="fg" style="grid-column:1/-1">
            <label class="flabel-sm">Generation Triggers <span class="form-note" style="display:inline">(empty = all)</span></label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.35rem;margin-top:.35rem">
              ${['Normal','Continue','Impersonate','Swipe','Regenerate','Quiet'].map(t =>
                `<label class="cb-row"><input type="checkbox" class="trig-cb" data-trigger="${t}" ${tri(t)}><span class="flabel-sm">${t}</span></label>`
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
      <button class="btn btn-err del-btn" data-uid="${uid}">Delete Entry</button>
    </div>
  </div>`;
}

function attachEditorEvents(container, uid) {
  // Save / Delete
  container.querySelector(`.save-btn[data-uid="${uid}"]`)?.addEventListener('click', () => saveEntry(uid));
  container.querySelector(`.del-btn[data-uid="${uid}"]`)?.addEventListener('click', async () => {
    if (!await askConfirm('Delete this entry?')) return;
    delete lorebook.entries[uid];
    closeTab(uid); renderList(); saveToStorage();
  });

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
    unsaved.add(uid);
    captureState(uid, container);
    renderTabs();
  };
  container.querySelectorAll('input,textarea,select').forEach(el => {
    el.addEventListener('input', markUnsaved);
    el.addEventListener('change', markUnsaved);
  });
}

// ═══════════════════════════════════════════════════════
// SAVE ENTRY
// ═══════════════════════════════════════════════════════
function captureState(uid, container) {
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
  formState[uid] = s;
}

function saveEntry(uid) {
  const en = lorebook.entries[uid]; if (!en) return;
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

  unsaved.delete(uid); delete formState[uid];
  renderList(); renderTabs(); saveToStorage();
}

// ═══════════════════════════════════════════════════════
// MERGE
// ═══════════════════════════════════════════════════════
function renderMergeList() {
  const list = g('mergeList');
  list.innerHTML = '';
  Object.values(mergeStaging.entries).sort((a,b)=>a.uid-b.uid).forEach(en => {
    const div = document.createElement('div');
    div.className = 'mi' + (mergeSelected.includes(en.uid) ? ' sel' : '');
    const head = document.createElement('div'); head.className = 'mi-head';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'mi-cb'; cb.checked = mergeSelected.includes(en.uid);
    cb.addEventListener('change', () => {
      const i = mergeSelected.indexOf(en.uid);
      if (i > -1) mergeSelected.splice(i,1); else mergeSelected.push(en.uid);
      renderMergeList();
    });
    const uid = document.createElement('div'); uid.className = 'mi-uid'; uid.textContent = '#' + en.uid;
    const name = document.createElement('div'); name.className = 'mi-name'; name.textContent = en.comment || 'Untitled';
    head.append(cb, uid, name);
    div.append(head);
    if (en.key && en.key.length) {
      const kws = document.createElement('div'); kws.className = 'mi-kws';
      en.key.slice(0,5).forEach(k => { const t=document.createElement('span'); t.className='kw-tag'; t.textContent=k; kws.append(t); });
      if (en.key.length > 5) { const t=document.createElement('span'); t.className='kw-tag'; t.textContent=`+${en.key.length-5}`; kws.append(t); }
      div.append(kws);
    }
    list.append(div);
  });
  g('mergeCountLbl').textContent = `${mergeSelected.length} selected`;
}

function executeMerge() {
  if (!mergeSelected.length) { toast('Select at least one entry.', 'warn'); return; }
  let maxUid = Math.max(-1, ...Object.values(lorebook.entries).map(e=>e.uid));
  let added = 0;
  mergeSelected.forEach(oldUid => {
    const src = mergeStaging.entries[oldUid]; if (!src) return;
    const ne = JSON.parse(JSON.stringify(src));
    const nu = maxUid + 1 + added;
    ne.uid = nu; ne.order = nu; ne.displayIndex = nu;
    lorebook.entries[nu] = ne; added++;
  });
  nextUid = maxUid + 1 + added;
  renderList(); closeModal('mergeModal'); saveToStorage();
  toast(`Merged ${added} entries.`, 'ok');
  mergeStaging = null; mergeSelected = [];
}

// ═══════════════════════════════════════════════════════
// SEARCH & REPLACE
// ═══════════════════════════════════════════════════════
function buildPattern() {
  const text = g('srFind').value;
  const cs = g('srCase').checked;
  const ww = g('srWhole').checked;
  const rx = g('srRegex').checked;
  if (!text) return null;
  try {
    if (rx) return new RegExp(text, 'g' + (cs ? '' : 'i'));
    let esc = text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if (ww) esc = `\\b${esc}\\b`;
    return new RegExp(esc, 'g' + (cs ? '' : 'i'));
  } catch(e) { toast('Invalid regex: ' + e.message, 'err'); return null; }
}

function doSearch() {
  const pat = buildPattern(); if (!pat) return;
  const scope = g('srScope').value;
  searchResults = [];
  Object.entries(lorebook.entries).forEach(([uid, en]) => {
    const fields = {};
    if (scope === 'content' || scope === 'all') fields.content = en.content || '';
    if (scope === 'keywords' || scope === 'all') { fields.primaryKeywords = (en.key||[]).join(', '); fields.secondaryKeywords = (en.keysecondary||[]).join(', '); }
    if (scope === 'names' || scope === 'all') fields.name = en.comment || '';
    Object.entries(fields).forEach(([field, text]) => {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(text)) !== null) {
        searchResults.push({ uid, entryName: en.comment || '(Untitled)', field, matchText: m[0], startIndex: m.index, fullText: text });
      }
    });
  });
  searchIdx = 0;
  renderSearchResults();
}

function renderSearchResults() {
  const res = g('srResults'); const list = g('srResultsList'); const head = g('srResultsHead');
  res.style.display = 'block';
  head.textContent = searchResults.length === 0 ? 'No matches found' : `Found ${searchResults.length} match${searchResults.length===1?'':'es'}`;
  list.innerHTML = '';
  searchResults.forEach((r, i) => {
    const ctx_s = Math.max(0, r.startIndex - 20);
    const ctx_e = Math.min(r.fullText.length, r.startIndex + r.matchText.length + 20);
    const ctx = (ctx_s > 0 ? '…' : '') + r.fullText.substring(ctx_s, ctx_e) + (ctx_e < r.fullText.length ? '…' : '');
    const esc = t => { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; };
    const div = document.createElement('div'); div.className = 'sr-item';
    div.innerHTML = `<div class="sr-item-t"><strong>${esc(r.entryName)}</strong> (${r.field})<br><code>${esc(ctx)}</code></div><div class="sr-item-loc">#${r.uid}</div>`;
    div.addEventListener('click', () => { openInTab(parseInt(r.uid)); searchIdx = i; });
    list.append(div);
  });
}

function doReplaceOne() {
  if (!searchResults.length) { toast('Search first.', 'warn'); return; }
  const pat = buildPattern(); if (!pat) return;
  const r = searchResults[searchIdx];
  const en = lorebook.entries[r.uid]; if (!en) return;
  const repTxt = g('srReplace').value;
  const singlePat = new RegExp(pat.source, pat.flags.replace('g',''));
  if (r.field === 'content') en.content = en.content.replace(singlePat, repTxt);
  else if (r.field === 'name') en.comment = en.comment.replace(singlePat, repTxt);
  else if (r.field === 'primaryKeywords') en.key = en.key.map(k => k.replace(singlePat, repTxt));
  else if (r.field === 'secondaryKeywords') en.keysecondary = en.keysecondary.map(k => k.replace(singlePat, repTxt));
  unsaved.add(r.uid);
  searchResults.splice(searchIdx, 1);
  if (searchIdx >= searchResults.length && searchIdx > 0) searchIdx--;
  renderList(); renderTabs(); if (activeTabId === parseInt(r.uid)) renderEditor();
  renderSearchResults();
  toast('Replaced 1 occurrence.', 'ok');
}

async function doReplaceAll() {
  if (!searchResults.length) { toast('Search first.', 'warn'); return; }
  if (!await askConfirm(`Replace all ${searchResults.length} occurrences?`)) return;
  const pat = buildPattern(); if (!pat) return;
  const repTxt = g('srReplace').value;
  const changed = new Set();
  searchResults.forEach(r => {
    const en = lorebook.entries[r.uid]; if (!en) return;
    if (r.field === 'content') { en.content = en.content.replace(pat, repTxt); }
    else if (r.field === 'name') { en.comment = en.comment.replace(pat, repTxt); }
    else if (r.field === 'primaryKeywords') en.key = en.key.map(k => k.replace(pat, repTxt));
    else if (r.field === 'secondaryKeywords') en.keysecondary = en.keysecondary.map(k => k.replace(pat, repTxt));
    changed.add(r.uid);
  });
  changed.forEach(uid => unsaved.add(uid));
  const n = searchResults.length; searchResults = []; searchIdx = 0;
  g('srResults').style.display = 'none';
  renderList(); renderTabs(); renderEditor();
  toast(`Replaced ${n} occurrence${n===1?'':'s'}.`, 'ok');
}

// ═══════════════════════════════════════════════════════
// EXPORT TEXT
// ═══════════════════════════════════════════════════════
// Strip XML/HTML tags and code blocks from content for clean text exports
function stripMarkup(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')        // fenced code blocks
    .replace(/`[^`\n]+`/g, '')             // inline code
    .replace(/<[^>]+>/g, '')               // xml/html tags
    .replace(/\n{3,}/g, '\n\n')            // collapse excess blank lines
    .trim();
}

function doExportTxt() {
  const opts = {
    titles: g('etTitles').checked, content: g('etContent').checked,
    primary: g('etPrimary').checked, secondary: g('etSecondary').checked,
    constants: g('etConstants').checked, comments: g('etComments').checked,
    order: g('etOrder').checked
  };
  const fn = g('etFilename').value || lorebook.name || 'lorebook';
  const name = g('lorebookName').value || 'Lorebook';
  const logicMap = {0:'AND ANY',1:'NOT ALL',2:'NOT ANY',3:'AND ALL'};
  let md = `# ${name}\n\n`;
  Object.values(lorebook.entries).sort((a,b)=>(a.order||999)-(b.order||999)).forEach((en,i) => {
    let h = `## ${i+1}. ${en.comment || 'Untitled Entry'}`;
    if (opts.constants) {
      const ind = [en.constant?'🔵':'', en.vectorized?'🔗':'', (en.selective&&en.keysecondary?.length)?'🟢':''].filter(Boolean);
      if (ind.length) h += ' ' + ind.join(' ');
    }
    if (opts.order) h += ` (Order: ${en.order})`;
    md += h + '\n\n';
    if (opts.primary && en.key?.length) md += `**Primary Keys:** ${en.key.join(', ')}\n\n`;
    if (opts.secondary && en.keysecondary?.length) md += `**Logic:** ${logicMap[en.selectiveLogic]||'AND ANY'}\n**Secondary Keys:** ${en.keysecondary.join(', ')}\n\n`;
    if (opts.content && en.content) md += `${stripMarkup(en.content)}\n\n`;
    if (opts.comments && en.comment && en.comment !== 'Untitled Entry') md += `**Notes:** ${en.comment}\n\n`;
    md += '---\n\n';
  });
  md += `*LoreOS v0.1.1 — ${new Date().toLocaleDateString()}*\n`;
  dlFile(md, fn + '.txt', 'text/plain');
  closeModal('expTxtModal');
  toast('Exported text.', 'ok');
}

// ═══════════════════════════════════════════════════════
// EXPORT PUBLIC
// ═══════════════════════════════════════════════════════
function openPublicExport() {
  g('epFilename').value = (g('lorebookName').value || 'lorebook') + '-public';
  g('epPreview').style.display = 'none';
  openModal('expPubModal');
}

function genPublicMd() {
  const inclDis = g('epDisabled').checked;
  const inclKw = g('epKeywords').checked;
  const inclStatus = g('epStatus').checked;
  const name = g('lorebookName').value || 'Lorebook';
  let md = `# ${name}\n\n`;
  Object.values(lorebook.entries).sort((a,b)=>a.uid-b.uid)
    .filter(en => inclDis || !en.disable)
    .forEach(en => {
      let badge = '';
      if (inclStatus) badge = en.constant ? ' [CONSTANT]' : en.disable ? ' [DISABLED]' : '';
      md += `## ${en.comment || 'Untitled'}${badge}\n\n`;
      if (inclKw && en.key?.length) md += `**Keywords:** ${en.key.join(', ')}\n\n`;
      if (en.content) md += `${stripMarkup(en.content)}\n\n`;
      md += `---\n\n`;
    });
  md += `*${name} — exported from LoreOS*\n`;
  return md;
}

function previewPublic() {
  const md = genPublicMd();
  const prev = g('epPreview');
  prev.textContent = md.substring(0, 1500) + (md.length > 1500 ? '\n…[truncated]' : '');
  prev.style.display = 'block';
}

function doExportPublic() {
  const md = genPublicMd();
  const fn = g('epFilename').value || lorebook.name || 'lorebook';
  dlFile(md, fn + '.md', 'text/plain');
  closeModal('expPubModal');
  toast('Exported for public pages.', 'ok');
}

// ═══════════════════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════════════════
function libGet() { try { return JSON.parse(localStorage.getItem('aet_library') || '{}'); } catch(e) { return {}; } }
function libSet(d) { localStorage.setItem('aet_library', JSON.stringify(d)); }

function openLibrary() {
  g('libModalTitle').textContent = 'Lorebook Library';
  g('libSaveBtn').parentElement.style.display = '';
  g('libNewName').value = g('lorebookName').value.trim();
  renderLibraryList();
  openModal('libModal');
}

function renderLibraryList() {
  const lib = libGet();
  const container = g('libList');
  container.innerHTML = '';
  const books = Object.values(lib).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  if (!books.length) {
    container.innerHTML = '<div class="lib-empty">// no saved lorebooks yet</div>';
    return;
  }
  const curName = g('lorebookName').value.trim();
  books.forEach(book => {
    const count = Object.keys(book.lb.entries || {}).length;
    const date = new Date(book.savedAt).toLocaleDateString();
    const item = document.createElement('div');
    item.className = 'lib-item' + (book.name === curName ? ' active' : '');
    item.innerHTML = `
      <span class="lib-name" title="Load ${book.name}">${book.name}</span>
      <span class="lib-meta">${count} entries · ${date}</span>
      <div class="lib-acts">
        <button class="btn btn-s btn-sm lib-load">Load</button>
        <button class="btn btn-s btn-sm lib-rename">Rename</button>
        <button class="btn btn-err btn-sm lib-del">✕</button>
      </div>`;
    item.querySelector('.lib-name').addEventListener('click', () => libLoad(book.name));
    item.querySelector('.lib-load').addEventListener('click', () => libLoad(book.name));
    item.querySelector('.lib-rename').addEventListener('click', () => libRename(book.name));
    item.querySelector('.lib-del').addEventListener('click', () => libDelete(book.name));
    container.append(item);
  });
}

async function libSaveCurrent() {
  const name = (g('libNewName').value.trim() || g('lorebookName').value.trim() || 'Untitled').substring(0, 60);
  const lib = libGet();
  if (lib[name] && !await askConfirm(`"${name}" already exists. Overwrite?`)) return;
  lib[name] = { name, lb: JSON.parse(JSON.stringify(lorebook)), savedAt: new Date().toISOString() };
  libSet(lib);
  g('libNewName').value = '';
  renderLibraryList();
  toast(`Saved "${name}" to library.`, 'ok');
}

async function libLoad(name) {
  const lib = libGet();
  const book = lib[name]; if (!book) return;
  if (unsaved.size > 0 && !await askConfirm('You have unsaved changes. Load anyway?')) return;
  lorebook = JSON.parse(JSON.stringify(book.lb));
  openTabs = []; activeTabId = null; unsaved = new Set(); formState = {};

  lorebook.entries = rebuildEntries(lorebook.entries);
  nextUid = Object.keys(lorebook.entries).length
    ? Math.max(...Object.keys(lorebook.entries).map(Number)) + 1
    : 0;

  g('lorebookName').value = lorebook.name || name;
  renderList(); renderTabs(); renderEditor();
  saveToStorage();
  closeModal('libModal');
  toast(`Loaded "${name}".`, 'ok');
}

async function libRename(oldName) {
  g('renameModalTitle').textContent = 'Rename Lorebook';
  const newName = await askInput(`Rename "${oldName}" to:`, oldName);
  if (!newName || newName.trim() === oldName) return;
  const trimmed = newName.trim().substring(0, 60);
  const lib = libGet();
  if (lib[trimmed] && !await askConfirm(`"${trimmed}" exists. Overwrite?`)) return;
  lib[trimmed] = { ...lib[oldName], name: trimmed };
  delete lib[oldName];
  libSet(lib);
  renderLibraryList();
  toast(`Renamed to "${trimmed}".`, 'ok');
}

async function libDelete(name) {
  if (!await askConfirm(`Delete "${name}" from library?`)) return;
  const lib = libGet();
  delete lib[name];
  libSet(lib);
  renderLibraryList();
  toast(`Deleted "${name}".`, 'info');
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════
// Promise-based confirm modal — replaces native confirm() which gets silently
// blocked/auto-rejected in sandboxed iframe contexts (e.g. in-chat previews)
// Promise-based input modal — replaces native prompt() which is blocked in sandboxed iframes
function askInput(message, defaultValue = '') {
  return new Promise(resolve => {
    g('renameModalMsg').textContent = message;
    g('renameModalInput').value = defaultValue;
    openModal('renameModal');
    setTimeout(() => { g('renameModalInput').focus(); g('renameModalInput').select(); }, 80);
    const okBtn = g('renameOkBtn');
    const cancelBtn = g('renameCancelBtn');
    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      g('renameModalInput').removeEventListener('keydown', onKey);
      closeModal('renameModal');
      resolve(result);
    };
    const onOk = () => cleanup(g('renameModalInput').value);
    const onCancel = () => cleanup(null);
    const onKey = e => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    g('renameModalInput').addEventListener('keydown', onKey);
  });
}

function askConfirm(message) {
  return new Promise(resolve => {
    g('confirmMsg').textContent = message;
    openModal('confirmModal');
    const okBtn = g('confirmOkBtn');
    const cancelBtn = g('confirmCancelBtn');
    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeModal('confirmModal');
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function toast(msg, type = 'info') {
  const container = g('notifs');
  const el = document.createElement('div');
  el.className = `notif ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : type === 'warn' ? 'warn' : 'info'}`;
  el.textContent = msg;
  container.append(el);
  const dismiss = () => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), {once:true}); };
  el.addEventListener('click', dismiss);
  setTimeout(dismiss, 3500);
}

function dlFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Works in sandboxed iframes where navigator.clipboard is blocked
function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
    }
    return Promise.resolve(fallback());
  } catch(e) { return Promise.resolve(fallback()); }

  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.append(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
// ═══════════════════════════════════════════════════════
// MOBILE

// ═══════════════════════════════════════════════════════
// JANITORAI LOREBOOK IMPORT / EXPORT
//
// Real JanitorAI format (from raw character card source):
//   - flat array of entry objects (no wrapper)
//   - `key` is already an array (primary keywords)
//   - `keysecondary` is an array
//   - `insertion_order` (not `order`) for ordering
//   - `comment` is the display name
//   - JanitorAI-specific fields: activationMode, activationScript,
//     minMessages, keyMatchPriority, priority, inclusionGroupRaw,
//     keywordsRaw, keysRaw, keywordRaw — preserved in extensions
//
// Since JanitorAI has no export button, import supports both
// file upload and paste-from-clipboard via a modal.
// ═══════════════════════════════════════════════════════

function parseJanitorEntries(raw, sourceName) {
  // Accept: flat array, { entries: [...] }, or { data: { entries: [...] } }
  if (raw && raw.data) raw = raw.data;
  const entries = Array.isArray(raw) ? raw
    : (raw && Array.isArray(raw.entries)) ? raw.entries
    : null;
  if (!entries) return null;

  lorebook = { name: (raw && raw.name) || sourceName || 'janitor-import', entries: {} };
  nextUid = 0;

  entries.forEach((je, i) => {
    const uid = i;
    // JanitorAI key is already an array — keep as array to match ST internal format
    const keyArr = Array.isArray(je.key) ? je.key : (je.key ? String(je.key).split(',').map(k=>k.trim()).filter(Boolean) : []);
    const keysecArr = Array.isArray(je.keysecondary) ? je.keysecondary : (je.keysecondary ? String(je.keysecondary).split(',').map(k=>k.trim()).filter(Boolean) : []);

    // Preserve JanitorAI-specific fields in extensions so round-trip works
    const janitorExt = {};
    ['activationMode','activationScript','minMessages','keyMatchPriority',
     'priority','inclusionGroupRaw','keywordsRaw','keysRaw','keywordRaw',
     'category','prioritizeInclusion','name'].forEach(f => {
      if (je[f] !== undefined) janitorExt[f] = je[f];
    });

    lorebook.entries[uid] = {
      uid,
      key:           keyArr,       // array — matches ST internal format
      keysecondary:  keysecArr,    // array — matches ST internal format
      comment:       je.comment || je.name || '',
      content:       je.content || '',
      constant:      je.constant || false,
      selective:     keysecArr.length > 0,
      selectiveLogic: je.selectiveLogic ?? 0,
      enabled:       je.enabled !== false,
      order:         je.insertion_order ?? (i * 100),
      position:      je.position ?? 0,
      depth:         je.depth ?? 4,
      probability:   je.probability ?? 100,
      useProbability: (je.probability !== undefined && je.probability !== 100),
      matchWholeWords: je.matchWholeWords ?? false,
      caseSensitive:  je.case_sensitive ?? false,
      groupWeight:   je.groupWeight ?? 100,
      role:          je.role ?? null,
      extensions:    Object.assign({}, je.extensions || {}, { janitor: janitorExt }),
    };
    nextUid = Math.max(nextUid, uid + 1);
  });

  const lbName = (raw && raw.name) || sourceName || '';
  const nameEl = g('lorebookName');
  if (nameEl && lbName) nameEl.value = lbName;
  lorebook.name = lbName;

  openTabs = []; activeTabId = null; selectedEntries = [];
  renderList(); renderTabs(); renderEditor();
  return entries.length;
}

function handleJanitorImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      const count = parseJanitorEntries(raw, file.name.replace(/\.json$/i, ''));
      if (count === null) { toast('Unrecognised JanitorAI format.', 'err'); return; }
      toast(`Imported ${count} entries from JanitorAI lorebook.`, 'ok');
    } catch(err) {
      toast('Failed to parse JSON: ' + err.message, 'err');
    }
  };
  r.readAsText(file);
  e.target.value = '';
}

function openJanitorPasteModal() {
  openModal('janitorPasteModal');
  const ta = g('janitorPasteTA');
  if (ta) { ta.value = ''; ta.focus(); }
}

function handleJanitorPaste() {
  const ta = g('janitorPasteTA');
  if (!ta || !ta.value.trim()) { toast('Nothing pasted.', 'warn'); return; }
  try {
    const raw = JSON.parse(ta.value.trim());
    const count = parseJanitorEntries(raw, 'pasted-lorebook');
    if (count === null) { toast('Unrecognised JanitorAI format — expected a JSON array or object with entries.', 'err'); return; }
    closeModal('janitorPasteModal');
    toast(`Imported ${count} entries from pasted JanitorAI lorebook.`, 'ok');
  } catch(err) {
    toast('Invalid JSON: ' + err.message, 'err');
  }
}

function exportJanitorJson() {
  const name = g('lorebookName')?.value?.trim() || lorebook.name || 'lorebook';
  // Export as flat array matching real JanitorAI format
  const entries = Object.values(lorebook.entries)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e, i) => {
      // Restore any saved JanitorAI-specific fields
      const janitorExt = e.extensions?.janitor || {};
      return {
        activationMode:     janitorExt.activationMode     ?? 'standard',
        activationScript:   janitorExt.activationScript   ?? '',
        case_sensitive:     e.caseSensitive               ?? false,
        category:           janitorExt.category           ?? 'other',
        comment:            e.comment || '',
        constant:           e.constant || false,
        content:            e.content || '',
        enabled:            e.enabled !== false,
        extensions:         Object.fromEntries(
                              Object.entries(e.extensions || {}).filter(([k]) => k !== 'janitor')
                            ),
        groupWeight:        e.groupWeight ?? 100,
        id:                 e.uid,
        inclusionGroupRaw:  janitorExt.inclusionGroupRaw  ?? '',
        insertion_order:    e.order ?? (i * 100),
        // key as array
        key:                Array.isArray(e.key) ? e.key : (e.key ? e.key.split(',').map(k=>k.trim()).filter(Boolean) : []),
        keyMatchPriority:   janitorExt.keyMatchPriority   ?? false,
        keysecondary:       Array.isArray(e.keysecondary) ? e.keysecondary : (e.keysecondary ? e.keysecondary.split(',').map(k=>k.trim()).filter(Boolean) : []),
        keysecondaryRaw:    e.keysecondary || '',
        keysRaw:            Array.isArray(e.key) ? e.key.join(', ') : (e.key || ''),
        matchWholeWords:    e.matchWholeWords ?? false,
        minMessages:        janitorExt.minMessages        ?? 0,
        name:               janitorExt.name               ?? '',
        prioritizeInclusion: janitorExt.prioritizeInclusion ?? false,
        priority:           janitorExt.priority           ?? (i + 1),
        probability:        e.probability ?? 100,
        selectiveLogic:     e.selectiveLogic              ?? 0,
        keywordsRaw:        Array.isArray(e.key) ? e.key.join(', ') : (e.key || ''),
      };
    });
  const fn = name.replace(/[^a-z0-9_\- ]/gi,'_') + '_janitor.json';
  // Export as flat array — the native JanitorAI format
  dlFile(JSON.stringify(entries, null, 2), fn, 'application/json');
  toast('Exported as JanitorAI lorebook (flat array format).', 'ok');
}


// ═══════════════════════════════════════════════════════
// SAUCEPANAI LOREBOOK IMPORT / EXPORT
//
// SaucepanAI format:
// {
//   id, author_id, name, short_description, image_id,
//   tags, access_level, nsfw, very_nsfw, ...metadata,
//   content: [{ title, text, id }, ...]
// }
// No keyword fields — purely chapter/narrative based.
// Import maps: title→comment, text→content (blank keywords)
// Export maps: comment→title, content→text, generates UUIDs
// ═══════════════════════════════════════════════════════

function handleSaucepanImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      const count = parseSaucepanData(raw, file.name.replace(/\.json$/i, ''));
      if (count === null) { toast('Unrecognised SaucepanAI lorebook format.', 'err'); return; }
      toast(`Imported ${count} entries from SaucepanAI lorebook.`, 'ok');
    } catch(err) {
      toast('Failed to parse JSON: ' + err.message, 'err');
    }
  };
  r.readAsText(file);
  e.target.value = '';
}

function parseSaucepanData(raw, sourceName) {
  if (!raw || !Array.isArray(raw.content)) return null;

  const lbName = raw.name || sourceName || 'saucepan-import';
  lorebook = { name: lbName, entries: {}, saucepanMeta: {
    id:                raw.id               || '',
    author_id:         raw.author_id        || '',
    short_description: raw.short_description|| '',
    image_id:          raw.image_id         || '',
    tags:              raw.tags             || [],
    access_level:      raw.access_level     || 'private',
    nsfw:              raw.nsfw             || false,
    very_nsfw:         raw.very_nsfw        || false,
    fandom_tags:       raw.fandom_tags      || [],
  }};
  nextUid = 0;

  raw.content.forEach((ch, i) => {
    lorebook.entries[i] = {
      uid:           i,
      key:           [],          // no keywords in saucepan
      keysecondary:  [],
      comment:       ch.title || `Entry ${i + 1}`,
      content:       ch.text  || '',
      constant:      false,
      selective:     false,
      selectiveLogic: 0,
      enabled:       true,
      order:         i * 100,
      position:      0,
      depth:         4,
      probability:   100,
      useProbability: false,
      role:          null,
      extensions:    { saucepan: { originalId: ch.id || '' } },
    };
    nextUid = i + 1;
  });

  const nameEl = g('lorebookName');
  if (nameEl) nameEl.value = lbName;
  lorebook.name = lbName;

  openTabs = []; activeTabId = null; selectedEntries = [];
  renderList(); renderTabs(); renderEditor();
  return raw.content.length;
}

function exportSaucepanJson() {
  const name = g('lorebookName')?.value?.trim() || lorebook.name || 'lorebook';
  const meta = lorebook.saucepanMeta || {};

  // Helper: generate a simple UUID-like string
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  const content = Object.values(lorebook.entries)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e, i) => ({
      title: e.comment || `Entry ${i + 1}`,
      text:  e.content || '',
      id:    e.extensions?.saucepan?.originalId || uuid(),
    }));

  const out = {
    id:                  meta.id            || uuid(),
    author_id:           meta.author_id     || '',
    name,
    short_description:   meta.short_description || '',
    content,
    access_level:        meta.access_level  || 'private',
    image_id:            meta.image_id      || '',
    nsfw:                meta.nsfw          || false,
    very_nsfw:           meta.very_nsfw     || false,
    tags:                meta.tags          || [],
    selected_chapter_index: 0,
    collaboration_type:  'private',
    has_been_public:     false,
    posted_at:           meta.posted_at     || new Date().toISOString().replace('T',' ').replace('Z',' +00:00:00'),
    updated_at:          new Date().toISOString().replace('T',' ').replace('Z',' +00:00:00'),
    hide_on_owner_profile: false,
    definition_protection: 'open',
    fandom_tags:         meta.fandom_tags   || [],
  };

  const fn = name.replace(/[^a-z0-9_\- ]/gi,'_') + '_saucepan.json';
  dlFile(JSON.stringify(out, null, 2), fn, 'application/json');
  toast('Exported as SaucepanAI lorebook.', 'ok');
}

// ═══════════════════════════════════════════════════════
// GLOBAL LOREBOOK SETTINGS MODAL
// ═══════════════════════════════════════════════════════

function openLoreSettings() {
  const s = lorebook.settings || {};
  const el = id => document.getElementById(id);
  if (el('lsScanDepth')) el('lsScanDepth').value = s.scan_depth ?? 2;
  if (el('lsTokenBudget')) el('lsTokenBudget').value = s.token_budget ?? 2048;
  if (el('lsCaseSensitive')) el('lsCaseSensitive').checked = s.case_sensitive || false;
  if (el('lsMatchWholeWords')) el('lsMatchWholeWords').checked = s.match_whole_words || false;
  if (el('lsUseGroupScoring')) el('lsUseGroupScoring').checked = s.use_group_scoring || false;
  if (el('lsRecursiveScanning')) el('lsRecursiveScanning').checked = s.recursive_scanning || false;
  openModal('loreSettingsModal');
}

function applyLoreSettings() {
  const el = id => document.getElementById(id);
  if (!lorebook.settings) lorebook.settings = {};
  lorebook.settings.scan_depth = parseInt(el('lsScanDepth')?.value) || 2;
  lorebook.settings.token_budget = parseInt(el('lsTokenBudget')?.value) || 2048;
  lorebook.settings.case_sensitive = el('lsCaseSensitive')?.checked || false;
  lorebook.settings.match_whole_words = el('lsMatchWholeWords')?.checked || false;
  lorebook.settings.use_group_scoring = el('lsUseGroupScoring')?.checked || false;
  lorebook.settings.recursive_scanning = el('lsRecursiveScanning')?.checked || false;
  closeModal('loreSettingsModal');
  toast('Lorebook settings updated.', 'ok');
}
