// ═══════════════════════════════════════════════════════
// LIBRARY VIEW — everything you have made in one place: search, sort, filter by type, world or tag,
// pins, notes. What you see here is read from the libraries; the organisation (worlds, tags, pins,
// notes) is kept separately by meta.js and never changes the items themselves.
// ═══════════════════════════════════════════════════════
import { createChar, openChar } from './character.js';
import { libLoad } from './library.js';
import {
  KINDS, addWorld, allLibraryItems, cleanTags, markOpened, metaGet, metaSet, patchItem, recordOf, removeWorld,
  tagCounts, togglePin, updateItem, worldCounts, itemKey,
} from './meta.js';
import { createPersona, importPersonaText, openPersona, setPersonaListener } from './persona.js';
import { createPreset, openPreset } from './preset.js';
import { createPrompt, openPrompt } from './prompt.js';
import { createRegex, openRegex } from './regex.js';
import { navigateTo } from './router.js';
import { state } from './state.js';
import { askConfirm, askInput, closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import { switchMode } from './workshop.js';

export const KIND_INFO = {
  char:    { label: 'Character',   plural: 'Characters',   icon: '🎭', mode: 'char' },
  lore:    { label: 'Lorebook',    plural: 'Lorebooks',    icon: '📖', mode: 'lore' },
  preset:  { label: 'Preset',      plural: 'Presets',      icon: '⚙',  mode: 'preset' },
  prompt:  { label: 'Prompt pack', plural: 'Prompt packs', icon: '✎',  mode: 'prompt' },
  regex:   { label: 'Regex',       plural: 'Regex',        icon: '⌕',  mode: 'regex' },
  persona: { label: 'Persona',     plural: 'Personas',     icon: '☺',  mode: null },
};
const WORLD_COLORS = ['#8a9bd2', '#c9a0dc', '#7ec8b0', '#e0b070', '#e08a8a', '#9ac0e8', '#b8c870', '#d49ab8'];
const SORTS = [['recent', 'Recently used'], ['name', 'Name'], ['type', 'Type'], ['oldest', 'Oldest']];
const VIEW_KEY = 'loreos_libview';

// What the view is showing (kept across visits)
const view = { type: 'all', world: null, tag: null, q: '', sort: 'recent', filtersOpen: false };
try { Object.assign(view, JSON.parse(localStorage.getItem(VIEW_KEY) || '{}'), { q: '', filtersOpen: false }); } catch (e) { /* first run */ }
const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ type: view.type, world: view.world, tag: view.tag, sort: view.sort })); } catch (e) { /* private mode */ } };

// ── Items with their organisation attached ──
export function libraryRows() {
  const m = metaGet();
  const rows = allLibraryItems().map(it => {
    const rec = recordOf(m, it.kind, it.id);
    const kindLabel = it.kind === 'regex' ? (it.entry.single ? 'Regex script' : 'Regex set') : KIND_INFO[it.kind].label;
    const used = [it.savedAt, rec.opened].filter(Boolean).sort().pop() || '';
    return { ...it, rec, kindLabel, used, worldName: rec.world && m.worlds[rec.world] ? m.worlds[rec.world].name : '' };
  });
  return { rows, m };
}

export function filterRows(rows, v = view) {
  const q = (v.q || '').trim().toLowerCase();
  let out = rows.filter(r => {
    if (v.type === 'pinned' && !r.rec.pinned) return false;
    if (KINDS.includes(v.type) && r.kind !== v.type) return false;
    if (v.world === 'none' && r.rec.world) return false;
    if (v.world && v.world !== 'none' && r.rec.world !== v.world) return false;
    if (v.tag && !r.rec.tags.some(t => t.toLowerCase() === v.tag.toLowerCase())) return false;
    if (q) {
      const hay = [r.name, r.kindLabel, r.worldName, r.rec.note, r.rec.tags.join(' ')].join(' ').toLowerCase();
      if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  });
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  if (v.sort === 'name') out.sort(byName);
  else if (v.sort === 'type') out.sort((a, b) => a.kindLabel.localeCompare(b.kindLabel) || byName(a, b));
  else if (v.sort === 'oldest') out.sort((a, b) => (a.used || '').localeCompare(b.used || ''));
  else out.sort((a, b) => (b.used || '').localeCompare(a.used || ''));
  return out;
}

// ── Opening things ──
export function openLibraryItem(row) {
  markOpened(row.kind, row.id, row.name);
  if (row.kind === 'persona') { openPersona(row.id); return; }
  const info = KIND_INFO[row.kind];
  navigateTo('editor');
  setTimeout(() => {
    switchMode(info.mode);
    if (row.kind === 'lore') libLoad(row.key);
    else if (row.kind === 'char') openChar(row.id);
    else if (row.kind === 'preset') openPreset(row.id);
    else if (row.kind === 'prompt') openPrompt(row.id);
    else if (row.kind === 'regex') openRegex(row.id);
  }, 80);
}

// ── Rendering ──
const fmtDate = iso => { try { return iso ? new Date(iso).toLocaleDateString() : ''; } catch (e) { return ''; } };

function thumb(r) {
  if (r.kind === 'char' && r.entry.imageData) return `<img src="${esc(r.entry.imageData)}" alt="" loading="lazy">`;
  if (r.kind === 'persona' && r.entry.persona && r.entry.persona.avatar) return `<img src="${esc(r.entry.persona.avatar)}" alt="" loading="lazy">`;
  return KIND_INFO[r.kind].icon;
}
function summaryOf(r) {
  if (r.kind === 'lore') return (n => n + (n === 1 ? ' entry' : ' entries'))(Object.keys((r.entry.lb && r.entry.lb.entries) || {}).length);
  if (r.kind === 'regex') { const n = ((r.entry.set && r.entry.set.scripts) || []).length; return n + (n === 1 ? ' script' : ' scripts'); }
  if (r.kind === 'prompt') return (n => n + (n === 1 ? ' module' : ' modules'))((((r.entry.pack || {}).modules) || []).length);
  if (r.kind === 'preset') return (n => n + (n === 1 ? ' prompt' : ' prompts'))((((r.entry.preset || {}).prompts) || []).length);
  if (r.kind === 'persona') return ((r.entry.persona || {}).title) || '';
  return '';
}

function cardHtml(r, m, i) {
  const w = r.rec.world && m.worlds[r.rec.world];
  return `<div class="libx-card${r.rec.pinned ? ' pinned' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="Open ${esc(r.name)}">
    <div class="libx-thumb">${thumb(r)}</div>
    <div class="libx-info">
      <div class="libx-name" title="${esc(r.name)}">${esc(r.name || 'Untitled')}</div>
      <div class="libx-meta"><span class="libx-kind">${esc(r.kindLabel)}</span>${summaryOf(r) ? ' · ' + esc(summaryOf(r)) : ''}${r.used ? ' · ' + esc(fmtDate(r.used)) : ''}</div>
      ${w ? `<div class="libx-world"><i style="background:${esc(w.color || '#8a9bd2')}"></i>${esc(w.name)}</div>` : ''}
      ${r.rec.tags.length ? `<div class="libx-tags">${r.rec.tags.map(t => `<span class="libx-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>` : ''}
      ${r.rec.note ? `<div class="libx-note">${esc(r.rec.note)}</div>` : ''}
    </div>
    <div class="libx-acts">
      <button class="libx-icon-btn" data-act="pin" title="${r.rec.pinned ? 'Unpin' : 'Pin to the top'}" aria-pressed="${r.rec.pinned}">${r.rec.pinned ? '★' : '☆'}</button>
      <button class="libx-icon-btn" data-act="details" title="World, tags and notes">⋯</button>
    </div>
  </div>`;
}

export function renderLibraryView() {
  const el = document.getElementById('library-content');
  if (!el) return;
  const { rows, m } = libraryRows();
  // A world or tag that no longer exists must not leave the view empty
  if (view.world && view.world !== 'none' && !m.worlds[view.world]) view.world = null;
  if (view.tag && !tagCounts(m).some(t => t.tag.toLowerCase() === view.tag.toLowerCase())) view.tag = null;
  const shown = filterRows(rows);
  const wc = worldCounts(m);
  const tags = tagCounts(m);
  const typeCount = k => rows.filter(r => r.kind === k).length;
  const pinnedCount = rows.filter(r => r.rec.pinned).length;
  const noWorld = rows.filter(r => !r.rec.world).length;
  const curWorld = view.world && view.world !== 'none' ? m.worlds[view.world] : null;
  const filtering = view.q.trim() || view.tag || view.world || view.type !== 'all';
  const pinned = !filtering && view.sort === 'recent' ? shown.filter(r => r.rec.pinned) : [];
  const rest = pinned.length ? shown.filter(r => !r.rec.pinned) : shown;
  const idx = new Map(shown.map((r, i) => [r, i]));

  const rail = (label, key, count, extra = '') => `<button class="libx-rail-item${(view.type === key && !view.world && !view.tag) ? ' active' : ''}" data-type="${key}">${label}<span>${count}</span></button>`;
  el.innerHTML = `
  <div class="libx">
    <div class="libx-top">
      <div class="lib-view-title">Library</div>
      <input class="finput libx-search" id="libxSearch" type="search" placeholder="Search names, tags, notes..." value="${esc(view.q)}" aria-label="Search the library">
      <select class="fselect libx-sort" id="libxSort" aria-label="Sort">${SORTS.map(([v, l]) => `<option value="${v}"${view.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="dd" id="libxNewDd"><button class="btn btn-ok dd-btn" id="libxNewBtn">+ New</button>
        <div class="dd-menu">
          <button class="dd-item" data-new="char">Character</button><button class="dd-item" data-new="lore">Lorebook</button>
          <button class="dd-item" data-new="preset">Preset</button><button class="dd-item" data-new="prompt">Prompt pack</button>
          <button class="dd-item" data-new="regex">Regex set</button><button class="dd-item" data-new="regexscript">Regex script</button>
          <button class="dd-item" data-new="persona">Persona</button><button class="dd-item" data-new="personafile">Import a persona (JSON)</button>
        </div></div>
      <button class="btn btn-s btn-sm libx-filter-toggle" id="libxFilterToggle" aria-expanded="${view.filtersOpen}">Filters</button>
    </div>
    <div class="libx-body">
      <nav class="libx-rail${view.filtersOpen ? ' open' : ''}" aria-label="Library filters">
        <div class="libx-rail-h">Browse</div>
        ${rail('All', 'all', rows.length)}${rail('★ Pinned', 'pinned', pinnedCount)}
        <div class="libx-rail-h">Types</div>
        ${KINDS.map(k => rail(KIND_INFO[k].icon + ' ' + KIND_INFO[k].plural, k, typeCount(k))).join('')}
        <div class="libx-rail-h">Worlds <button class="libx-icon-btn" id="libxAddWorld" title="New world" aria-label="New world">+</button></div>
        ${Object.values(m.worlds).sort((a, b) => a.name.localeCompare(b.name)).map(w => `<button class="libx-rail-item${view.world === w.id ? ' active' : ''}" data-world="${esc(w.id)}"><i class="libx-dot" style="background:${esc(w.color || '#8a9bd2')}"></i>${esc(w.name)}<span>${wc[w.id] || 0}</span></button>`).join('')}
        ${Object.keys(m.worlds).length ? `<button class="libx-rail-item${view.world === 'none' ? ' active' : ''}" data-world="none">No world<span>${noWorld}</span></button>` : '<div class="libx-hint">Worlds group things that belong together, like a story or an AU.</div>'}
        ${tags.length ? `<div class="libx-rail-h">Tags</div><div class="libx-tagcloud">${tags.map(t => `<button class="libx-tag${view.tag && view.tag.toLowerCase() === t.tag.toLowerCase() ? ' on' : ''}" data-tagf="${esc(t.tag)}">${esc(t.tag)} <span>${t.count}</span></button>`).join('')}</div>` : ''}
      </nav>
      <main class="libx-main">
        ${curWorld ? `<div class="libx-worldhead"><div class="libx-worldname"><i class="libx-dot" style="background:${esc(curWorld.color || '#8a9bd2')}"></i>${esc(curWorld.name)}</div>
          <textarea class="ftextarea" id="libxWorldNote" placeholder="Notes about this world: the premise, the rules, what is where..." aria-label="World notes">${esc(curWorld.note || '')}</textarea>
          <div class="pr-row"><button class="btn btn-s btn-sm" id="libxRenameWorld">Rename</button><button class="btn btn-err btn-sm" id="libxDeleteWorld">Delete world</button><span class="rx-none">Deleting a world keeps everything in it.</span></div></div>` : ''}
        ${view.tag ? `<div class="libx-filterline">Tag: <b>${esc(view.tag)}</b> <button class="btn btn-s btn-sm" id="libxClearTag">Clear</button></div>` : ''}
        ${shown.length ? `
          ${pinned.length ? `<div class="libx-sec">★ Pinned</div><div class="libx-grid">${pinned.map(r => cardHtml(r, m, idx.get(r))).join('')}</div><div class="libx-sec">Everything else</div>` : ''}
          <div class="libx-grid">${rest.map(r => cardHtml(r, m, idx.get(r))).join('')}</div>`
          : `<div class="lib-view-empty">${rows.length ? 'nothing matches that<br><span style="font-size:.7rem;opacity:.6">try another search or clear the filters</span>' : 'nothing in your library yet<br><span style="font-size:.7rem;opacity:.6">use + New to start something, or drop a file anywhere to import it</span>'}</div>`}
      </main>
    </div>
  </div>`;
  wire(el, shown, m);
}

function refresh() { renderLibraryView(); }

function wire(el, shown, m) {
  const q = el.querySelector('#libxSearch');
  let t = null;
  q.addEventListener('input', () => { view.q = q.value; clearTimeout(t); t = setTimeout(() => { refresh(); const n = document.getElementById('libxSearch'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 160); });
  el.querySelector('#libxSort').onchange = e => { view.sort = e.target.value; saveView(); refresh(); };
  el.querySelector('#libxFilterToggle').onclick = () => { view.filtersOpen = !view.filtersOpen; refresh(); };
  el.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { view.type = b.dataset.type; view.world = null; view.tag = null; view.filtersOpen = false; saveView(); refresh(); });
  el.querySelectorAll('[data-world]').forEach(b => b.onclick = () => { view.world = b.dataset.world; view.type = 'all'; view.tag = null; view.filtersOpen = false; saveView(); refresh(); });
  el.querySelectorAll('[data-tagf]').forEach(b => b.onclick = () => { view.tag = view.tag && view.tag.toLowerCase() === b.dataset.tagf.toLowerCase() ? null : b.dataset.tagf; saveView(); refresh(); });
  const ct = el.querySelector('#libxClearTag'); if (ct) ct.onclick = () => { view.tag = null; saveView(); refresh(); };
  el.querySelector('#libxAddWorld').onclick = async () => { const n = await askInput('Name the new world:', ''); if (n && n.trim()) { const mm = metaGet(); const id = addWorld(mm, n, WORLD_COLORS[Object.keys(mm.worlds).length % WORLD_COLORS.length]); metaSet(mm); view.world = id; view.type = 'all'; saveView(); refresh(); } };
  const wn = el.querySelector('#libxWorldNote');
  if (wn) { let wt = null; wn.oninput = () => { clearTimeout(wt); wt = setTimeout(() => { const mm = metaGet(); if (mm.worlds[view.world]) { mm.worlds[view.world].note = wn.value; metaSet(mm); } }, 400); }; }
  const rw = el.querySelector('#libxRenameWorld');
  if (rw) rw.onclick = async () => { const mm = metaGet(); const w = mm.worlds[view.world]; if (!w) return; const n = await askInput('Rename this world:', w.name); if (n && n.trim()) { w.name = n.trim().slice(0, 60); metaSet(mm); refresh(); } };
  const dw = el.querySelector('#libxDeleteWorld');
  if (dw) dw.onclick = async () => { const mm = metaGet(); const w = mm.worlds[view.world]; if (!w) return; if (!await askConfirm(`Delete the world "${w.name}"? Everything in it stays in your library.`)) return; removeWorld(mm, w.id); metaSet(mm); view.world = null; saveView(); refresh(); };

  el.querySelectorAll('.libx-card').forEach(card => {
    const row = shown[Number(card.dataset.i)];
    const open = () => openLibraryItem(row);
    card.addEventListener('click', e => {
      const act = e.target.closest('[data-act]'), tag = e.target.closest('.libx-tag');
      if (act) { e.stopPropagation(); if (act.dataset.act === 'pin') { togglePin(row.kind, row.id); refresh(); } else openDetails(row); return; }
      if (tag && tag.dataset.tag) { e.stopPropagation(); view.tag = tag.dataset.tag; saveView(); refresh(); return; }
      open();
    });
    card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); open(); } });
  });

  el.querySelectorAll('[data-new]').forEach(b => b.onclick = () => newThing(b.dataset.new));
}

// ── New things made from the Library land in the world that is open ──
async function newThing(kind) {
  const before = new Set(allLibraryItems().map(i => itemKey(i.kind, i.id)));
  const inWorld = view.world && view.world !== 'none' ? view.world : null;
  const adopt = () => {
    if (!inWorld) return;
    const fresh = allLibraryItems().filter(i => !before.has(itemKey(i.kind, i.id)));
    if (!fresh.length) return;
    const mm = metaGet(); fresh.forEach(i => patchItem(mm, i.kind, i.id, { world: inWorld, name: i.name })); metaSet(mm);
  };
  if (kind === 'persona') { const id = createPersona(); adopt(); openPersona(id); refresh(); return; }
  if (kind === 'personafile') { document.getElementById('personaImportFile').click(); return; }
  if (kind === 'lore') { navigateTo('editor'); setTimeout(() => switchMode('lore'), 80); toast('Build it in the editor, then Save to Library to see it here.', 'info'); return; }
  navigateTo('editor');
  setTimeout(() => {
    if (kind === 'char') { switchMode('char'); createChar(); }
    else if (kind === 'preset') { switchMode('preset'); createPreset(); }
    else if (kind === 'prompt') { switchMode('prompt'); createPrompt(); }
    else if (kind === 'regex') { switchMode('regex'); createRegex(); }
    else if (kind === 'regexscript') { switchMode('regex'); createRegex('New regex set', null, { single: true }); }
    adopt();
  }, 80);
}

// ── Details: world, tags, note ──
let detailRow = null;
function openDetails(row) {
  detailRow = row;
  const { m } = libraryRows();
  const rec = recordOf(m, row.kind, row.id);
  g('libxDetailTitle').textContent = row.name || 'Untitled';
  const sel = g('libxDetailWorld');
  sel.innerHTML = '<option value="">No world</option>' + Object.values(m.worlds).sort((a, b) => a.name.localeCompare(b.name)).map(w => `<option value="${esc(w.id)}"${rec.world === w.id ? ' selected' : ''}>${esc(w.name)}</option>`).join('') + '<option value="__new">+ New world...</option>';
  g('libxDetailTags').value = rec.tags.join(', ');
  g('libxTagSuggest').innerHTML = tagCounts(m).map(t => `<option value="${esc(t.tag)}">`).join('');
  g('libxDetailNote').value = rec.note || '';
  g('libxDetailOpen').style.display = '';
  openModal('libxDetailModal');
}
function saveDetails() {
  if (!detailRow) return;
  const patch = { tags: cleanTags(g('libxDetailTags').value), note: g('libxDetailNote').value, name: detailRow.name };
  const w = g('libxDetailWorld').value;
  if (w !== '__new') patch.world = w || null;
  updateItem(detailRow.kind, detailRow.id, patch);
}
export function wireLibraryView() {
  ['libxDetailTags', 'libxDetailNote'].forEach(id => g(id).addEventListener('input', saveDetails));
  g('libxDetailWorld').onchange = async e => {
    if (!detailRow) return;
    if (e.target.value === '__new') {
      const n = await askInput('Name the new world:', '');
      if (n && n.trim()) { const mm = metaGet(); const id = addWorld(mm, n, WORLD_COLORS[Object.keys(mm.worlds).length % WORLD_COLORS.length]); metaSet(mm); openDetails(detailRow); g('libxDetailWorld').value = id; }
      else g('libxDetailWorld').value = '';
    }
    saveDetails();
  };
  g('libxDetailDone').onclick = () => { saveDetails(); closeModal('libxDetailModal'); refresh(); };
  g('libxDetailOpen').onclick = () => { if (!detailRow) { closeModal('libxDetailModal'); return; } saveDetails(); closeModal('libxDetailModal'); openLibraryItem(detailRow); };
  g('libxDetailModal').addEventListener('click', e => { if (e.target.dataset && e.target.dataset.close === 'libxDetailModal') { saveDetails(); refresh(); } });
  g('personaImportFile').addEventListener('change', () => setTimeout(refresh, 400));
  setPersonaListener(() => { if (document.getElementById('view-library') && document.getElementById('view-library').classList.contains('view-active')) refresh(); });
}

registerMarkup(189, `<div id="libxDetailModal" class="modal">
  <div class="modal-box" style="max-width:480px">
    <div class="modal-head"><h2 id="libxDetailTitle">Details</h2><button class="modal-x" data-close="libxDetailModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <label class="pr-lbl" for="libxDetailWorld">World</label>
      <select class="fselect" id="libxDetailWorld"></select>
      <label class="pr-lbl" for="libxDetailTags">Tags (separate with commas)</label>
      <input class="finput" id="libxDetailTags" list="libxTagSuggest" placeholder="fantasy, wip, favourite">
      <datalist id="libxTagSuggest"></datalist>
      <label class="pr-lbl" for="libxDetailNote">Notes</label>
      <textarea class="ftextarea" id="libxDetailNote" style="min-height:110px" placeholder="Anything you want to remember about this one"></textarea>
      <div class="pr-row"><button class="btn btn-p btn-sm" id="libxDetailDone">Done</button><button class="btn btn-s btn-sm" id="libxDetailOpen">Open it</button></div>
    </div>
  </div>
</div>`);
