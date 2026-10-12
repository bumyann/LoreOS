// ═══════════════════════════════════════════════════════
// LIBRARY VIEW — everything you have made in one place: search, sort, filter by type, world, folder
// or tag, pins, notes, pictures and symbols. What you see here is read from the libraries; the
// organisation (worlds, folders, tags, pins, notes) is kept separately by meta.js and never
// changes the items themselves.
// ═══════════════════════════════════════════════════════
import { readFileAsDataUrl, resizeImage } from './avatar.js';
import { createChar, openChar } from './character.js';
import { libLoad } from './library.js';
import {
  KINDS, addFolder, addWorld, allLibraryItems, childFolders, cleanTags, folderPath, folderTree, markOpened, metaGet, metaSet,
  patchItem, recordOf, removeFolder, removeWorld, tagCounts, togglePin, updateItem, worldCounts, itemKey,
} from './meta.js';
import { createPersona, openPersona, setPersonaListener } from './persona.js';
import { createPreset, openPreset } from './preset.js';
import { createPrompt, openPrompt } from './prompt.js';
import { createRegex, openRegex } from './regex.js';
import { navigateTo } from './router.js';
import { KIND_SYMBOL, SYMBOL_CHOICES, sym } from './symbols.js';
import { askConfirm, askInput, closeAllDropdowns, closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import { switchMode } from './workshop.js';

export const KIND_INFO = {
  char:    { label: 'Character',   plural: 'Characters',   icon: KIND_SYMBOL.char,    mode: 'char' },
  lore:    { label: 'Lorebook',    plural: 'Lorebooks',    icon: KIND_SYMBOL.lore,    mode: 'lore' },
  preset:  { label: 'Preset',      plural: 'Presets',      icon: KIND_SYMBOL.preset,  mode: 'preset' },
  prompt:  { label: 'Prompt pack', plural: 'Prompt packs', icon: KIND_SYMBOL.prompt,  mode: 'prompt' },
  regex:   { label: 'Regex',       plural: 'Regex',        icon: KIND_SYMBOL.regex,   mode: 'regex' },
  persona: { label: 'Persona',     plural: 'Personas',     icon: KIND_SYMBOL.persona, mode: null },
};
// Characters and personas always show their own picture; the rest can be given one, or a symbol
const OWN_PICTURE = new Set(['char', 'persona']);
// The default cover colour of each kind of book
const KIND_COLOR = { char: '#6b82c4', lore: '#9a78c8', preset: '#5aa0b4', prompt: '#c0a060', regex: '#6cb490', persona: '#c47e9c' };
// The order the shelves stand in
export const SHELF_ORDER = ['char', 'lore', 'preset', 'prompt', 'regex', 'persona'];
export const BOOK_COLORS = ['#6b82c4', '#9a78c8', '#5aa0b4', '#c0a060', '#6cb490', '#c47e9c', '#c46c6c', '#c8884c', '#8a8f9c', '#4f5f8f', '#7a5a8e', '#3f7a6a'];
const WORLD_COLORS = ['#8a9bd2', '#c9a0dc', '#7ec8b0', '#e0b070', '#e08a8a', '#9ac0e8', '#b8c870', '#d49ab8'];
const SORTS = [['recent', 'Recently used'], ['name', 'Name'], ['type', 'Type'], ['oldest', 'Oldest']];
const VIEW_KEY = 'loreos_libview';

// What the view is showing (kept across visits)
const view = { type: 'all', world: null, folder: null, tag: null, q: '', sort: 'recent', layout: 'shelves', filtersOpen: false };
try { Object.assign(view, JSON.parse(localStorage.getItem(VIEW_KEY) || '{}'), { q: '', filtersOpen: false }); } catch (e) { /* first run */ }
const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ type: view.type, world: view.world, folder: view.folder, tag: view.tag, sort: view.sort, layout: view.layout })); } catch (e) { /* private mode */ } };

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

export function filterRows(rows, m, v = view) {
  const q = (v.q || '').trim().toLowerCase();
  const inWorld = v.world && v.world !== 'none';
  const subtree = inWorld && v.folder && m.folders[v.folder] ? new Set(folderTree(m, v.folder)) : null;
  const searching = !!(q || v.tag);
  const out = rows.filter(r => {
    if (v.type === 'pinned' && !r.rec.pinned) return false;
    if (KINDS.includes(v.type) && r.kind !== v.type) return false;
    if (v.world === 'none' && r.rec.world) return false;
    if (inWorld) {
      if (r.rec.world !== v.world) return false;
      if (subtree) { if (!r.rec.folder || !(searching ? subtree.has(r.rec.folder) : r.rec.folder === v.folder)) return false; }
      else if (!searching && r.rec.folder) return false; // the world's own level: folders hold the rest
    }
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
const pluralize = (n, one, many) => n + ' ' + (n === 1 ? one : many);

export function bookThumb(r) { return thumb(r); }
function thumb(r) {
  if (r.rec.image) return `<img src="${esc(r.rec.image)}" alt="" loading="lazy">`;
  if (r.kind === 'char' && r.entry.imageData) return `<img src="${esc(r.entry.imageData)}" alt="" loading="lazy">`;
  if (r.kind === 'persona' && r.entry.persona && r.entry.persona.avatar) return `<img src="${esc(r.entry.persona.avatar)}" alt="" loading="lazy">`;
  if (r.rec.symbol) return `<span class="libx-sym">${esc(sym(r.rec.symbol))}</span>`;
  return `<span class="libx-sym">${esc(sym(KIND_INFO[r.kind].icon))}</span>`;
}
function summaryOf(r) {
  if (r.kind === 'lore') return pluralize(Object.keys((r.entry.lb && r.entry.lb.entries) || {}).length, 'entry', 'entries');
  if (r.kind === 'regex') return pluralize(((r.entry.set && r.entry.set.scripts) || []).length, 'script', 'scripts');
  if (r.kind === 'prompt') return pluralize((((r.entry.pack || {}).modules) || []).length, 'module', 'modules');
  if (r.kind === 'preset') return pluralize((((r.entry.preset || {}).prompts) || []).length, 'prompt', 'prompts');
  if (r.kind === 'persona') return ((r.entry.persona || {}).title) || '';
  return '';
}

// A book standing on a shelf: cover art or symbol, the title, what it is, and where it belongs
function bookHtml(r, m, i) {
  const w = r.rec.world && m.worlds[r.rec.world];
  const fp = r.rec.folder ? folderPath(m, r.rec.folder).map(f => f.name).join(' › ') : '';
  const tip = [r.name, r.kindLabel, w ? w.name + (fp ? ' › ' + fp : '') : '', r.rec.tags.join(', '), r.rec.note].filter(Boolean).join(' · ');
  return `<div class="libx-card libx-book kind-${r.kind}${r.rec.pinned ? ' pinned' : ''}${r.rec.color ? ' colored' : ''}"${r.rec.color ? ` style="--bk:${esc(r.rec.color)}"` : ''} data-i="${i}" tabindex="0" role="button" title="${esc(tip)}" aria-label="Open ${esc(r.name)}">
    <div class="libx-cover"><div class="libx-thumb">${thumb(r)}</div></div>
    <div class="libx-info">
      <div class="libx-name">${esc(r.name || 'Untitled')}</div>
      <div class="libx-meta"><span class="libx-kind">${esc(r.kindLabel)}</span>${w ? `<i class="libx-wdot" style="background:${esc(w.color || '#8a9bd2')}" title="${esc(w.name)}"></i>` : ''}</div>
    </div>
    <div class="libx-extra" aria-hidden="true">${esc(r.rec.tags.join(' '))} ${esc(r.rec.note)} ${w ? esc(w.name) : ''}</div>
    <div class="libx-acts">
      <button class="libx-icon-btn" data-act="pin" title="${r.rec.pinned ? 'Unpin' : 'Pin to the favourites shelf'}" aria-pressed="${r.rec.pinned}">${r.rec.pinned ? '★' : '☆'}</button>
      <button class="libx-icon-btn" data-act="details" title="World, folder, tags, picture and notes">⋯</button>
    </div>
  </div>`;
}

// One shelf per category, with a brass plate; favourites get the top shelf
export function shelfGroups(shown, v = view) {
  const groups = [];
  const filtering = (v.q || '').trim() || v.tag || v.world || v.type !== 'all';
  if (!filtering) { const fav = shown.filter(r => r.rec.pinned); if (fav.length) groups.push({ key: 'pinned', label: 'Favourites', icon: '★', rows: fav }); }
  if (v.type === 'pinned') return [{ key: 'pinned', label: 'Favourites', icon: '★', rows: shown }];
  SHELF_ORDER.forEach(k => { const rs = shown.filter(r => r.kind === k); if (rs.length) groups.push({ key: k, label: KIND_INFO[k].plural, icon: KIND_INFO[k].icon, rows: rs }); });
  return groups;
}
function shelvesHtml(shown, m, idx) {
  return shelfGroups(shown).map(gr => `
    <section class="libx-shelf" data-shelf="${gr.key}" aria-label="${esc(gr.label)}">
      <div class="libx-plate"><span class="libx-plate-name">${esc(gr.label)}</span><span class="libx-plate-n">${gr.rows.length}</span></div>
      <div class="libx-books">${gr.rows.map(r => bookHtml(r, m, idx.get(r))).join('')}</div>
    </section>`).join('');
}

function cardHtml(r, m, i) {
  const w = r.rec.world && m.worlds[r.rec.world];
  const fp = r.rec.folder ? folderPath(m, r.rec.folder).map(f => f.name).join(' › ') : '';
  return `<div class="libx-card${r.rec.pinned ? ' pinned' : ''}${r.rec.color ? ' colored' : ''}"${r.rec.color ? ` style="--bk:${esc(r.rec.color)}"` : ''} data-i="${i}" tabindex="0" role="button" aria-label="Open ${esc(r.name)}">
    <div class="libx-thumb">${thumb(r)}</div>
    <div class="libx-info">
      <div class="libx-name" title="${esc(r.name)}">${esc(r.name || 'Untitled')}</div>
      <div class="libx-meta"><span class="libx-kind">${esc(r.kindLabel)}</span>${summaryOf(r) ? ' · ' + esc(summaryOf(r)) : ''}${r.used ? ' · ' + esc(fmtDate(r.used)) : ''}</div>
      ${w ? `<div class="libx-world"><i style="background:${esc(w.color || '#8a9bd2')}"></i>${esc(w.name)}${fp ? ' › ' + esc(fp) : ''}</div>` : ''}
      ${r.rec.tags.length ? `<div class="libx-tags">${r.rec.tags.map(t => `<span class="libx-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>` : ''}
      ${r.rec.note ? `<div class="libx-note">${esc(r.rec.note)}</div>` : ''}
    </div>
    <div class="libx-acts">
      <button class="libx-icon-btn" data-act="pin" title="${r.rec.pinned ? 'Unpin' : 'Pin to the top'}" aria-pressed="${r.rec.pinned}">${r.rec.pinned ? '★' : '☆'}</button>
      <button class="libx-icon-btn" data-act="details" title="World, folder, tags, picture and notes">⋯</button>
    </div>
  </div>`;
}

function worldHeadHtml(w, m, rows) {
  const crumbs = folderPath(m, view.folder);
  const folders = childFolders(m, w.id, view.folder || null);
  const countIn = f => { const t = new Set(folderTree(m, f.id)); return rows.filter(r => r.rec.world === w.id && r.rec.folder && t.has(r.rec.folder)).length; };
  return `
  <div class="libx-worldhead">
    <div class="libx-banner${w.banner ? ' has' : ''}"${w.banner ? ` style="background-image:url('${esc(w.banner)}')"` : ''}>
      <div class="libx-banner-bar">
        <div class="libx-worldname"><i class="libx-dot" style="background:${esc(w.color || '#8a9bd2')}"></i>${esc(w.name)}</div>
        <div class="libx-banner-acts"><button class="btn btn-s btn-sm" id="libxBannerBtn">${w.banner ? 'Change banner' : 'Add a banner'}</button>${w.banner ? '<button class="btn btn-s btn-sm" id="libxBannerClear">Remove</button>' : ''}</div>
      </div>
    </div>
    <textarea class="ftextarea" id="libxWorldNote" placeholder="Notes about this world: the premise, the rules, what is where..." aria-label="World notes">${esc(w.note || '')}</textarea>
    <div class="pr-row" style="align-items:center"><span class="flabel-sm">Colour</span><div class="libx-colorgrid" id="libxWorldColors" role="group" aria-label="World colour">${BOOK_COLORS.map(c => `<button type="button" class="libx-swatch${(w.color || '').toLowerCase() === c ? ' on' : ''}" data-wcolor="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div><input type="color" id="libxWorldColorPick" value="${esc(w.color || '#8a9bd2')}" aria-label="Custom world colour" title="Any colour"></div>
    <div class="pr-row"><button class="btn btn-s btn-sm" id="libxRenameWorld">Rename</button><button class="btn btn-err btn-sm" id="libxDeleteWorld">Delete world</button><span class="rx-none">Deleting a world keeps everything in it.</span></div>
  </div>
  <div class="libx-crumbs" aria-label="Folders">
    <button class="libx-crumb${view.folder ? '' : ' here'}" data-folder="">${esc(w.name)}</button>
    ${crumbs.map((f, i) => `<span class="libx-sep">›</span><button class="libx-crumb${i === crumbs.length - 1 ? ' here' : ''}" data-folder="${esc(f.id)}">${esc(f.name)}</button>`).join('')}
    <span class="libx-crumb-acts"><button class="btn btn-s btn-sm" id="libxAddFolder">+ New folder</button>${view.folder ? '<button class="btn btn-s btn-sm" id="libxRenameFolder">Rename folder</button><button class="btn btn-err btn-sm" id="libxDeleteFolder">Delete folder</button>' : ''}</span>
  </div>
  ${folders.length ? `<div class="libx-folders">${folders.map(f => `<button class="libx-folder" data-folder="${esc(f.id)}"><span class="libx-sym">${esc(sym('▸'))}</span><span class="libx-folder-name">${esc(f.name)}</span><span class="libx-folder-n">${countIn(f)}</span></button>`).join('')}</div>` : ''}`;
}

export function renderLibraryView() {
  const el = document.getElementById('library-content');
  if (!el) return;
  const { rows, m } = libraryRows();
  // A world, folder or tag that no longer exists must not leave the view empty
  if (view.world && view.world !== 'none' && !m.worlds[view.world]) { view.world = null; view.folder = null; }
  if (view.folder && (!m.folders[view.folder] || m.folders[view.folder].world !== view.world)) view.folder = null;
  if (view.tag && !tagCounts(m).some(t => t.tag.toLowerCase() === view.tag.toLowerCase())) view.tag = null;
  const shown = filterRows(rows, m);
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

  const rail = (label, key, count) => `<button class="libx-rail-item${(view.type === key && !view.world && !view.tag) ? ' active' : ''}" data-type="${key}">${label}<span>${count}</span></button>`;
  el.innerHTML = `
  <div class="libx">
    <div class="libx-top">
      <div class="lib-view-title">Library</div>
      <input class="finput libx-search" id="libxSearch" type="search" placeholder="Search names, tags, notes..." value="${esc(view.q)}" aria-label="Search the library">
      <select class="fselect libx-sort" id="libxSort" aria-label="Sort">${SORTS.map(([v, l]) => `<option value="${v}"${view.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="dd" id="libxNewDd"><button class="btn btn-ok dd-btn" id="libxNewBtn" aria-haspopup="true">+ New</button>
        <div class="dd-menu">
          <button class="dd-item" data-libnew="char">${sym(KIND_SYMBOL.char)} Character</button><button class="dd-item" data-libnew="lore">${sym(KIND_SYMBOL.lore)} Lorebook</button>
          <button class="dd-item" data-libnew="preset">${sym(KIND_SYMBOL.preset)} Preset</button><button class="dd-item" data-libnew="prompt">${sym(KIND_SYMBOL.prompt)} Prompt pack</button>
          <button class="dd-item" data-libnew="regex">${sym(KIND_SYMBOL.regex)} Regex set</button><button class="dd-item" data-libnew="regexscript">${sym(KIND_SYMBOL.regex)} Regex script</button>
          <button class="dd-item" data-libnew="persona">${sym(KIND_SYMBOL.persona)} Persona</button><button class="dd-item" data-libnew="personafile">Import a persona (JSON)</button>
        </div></div>
      <div class="libx-layout" role="group" aria-label="Layout"><button class="btn btn-s btn-sm${view.layout === 'shelves' ? ' on' : ''}" id="libxLayoutShelves" aria-pressed="${view.layout === 'shelves'}">Shelves</button><button class="btn btn-s btn-sm${view.layout === 'list' ? ' on' : ''}" id="libxLayoutList" aria-pressed="${view.layout === 'list'}">List</button></div>
      <button class="btn btn-s btn-sm libx-filter-toggle" id="libxFilterToggle" aria-expanded="${view.filtersOpen}">Filters</button>
    </div>
    <div class="libx-body">
      <nav class="libx-rail${view.filtersOpen ? ' open' : ''}" aria-label="Library filters">
        <div class="libx-rail-h">Browse</div>
        ${rail('All', 'all', rows.length)}${rail('★ Pinned', 'pinned', pinnedCount)}
        <div class="libx-rail-h">Types</div>
        ${KINDS.map(k => rail(`<span class="libx-sym">${esc(sym(KIND_INFO[k].icon))}</span> ${KIND_INFO[k].plural}`, k, typeCount(k))).join('')}
        <div class="libx-rail-h">Worlds <button class="libx-icon-btn" id="libxAddWorld" title="New world" aria-label="New world">+</button></div>
        ${Object.values(m.worlds).sort((a, b) => a.name.localeCompare(b.name)).map(w => `<button class="libx-rail-item${view.world === w.id ? ' active' : ''}" data-world="${esc(w.id)}"><i class="libx-dot" style="background:${esc(w.color || '#8a9bd2')}"></i>${esc(w.name)}<span>${wc[w.id] || 0}</span></button>`).join('')}
        ${Object.keys(m.worlds).length ? `<button class="libx-rail-item${view.world === 'none' ? ' active' : ''}" data-world="none">No world<span>${noWorld}</span></button>` : '<div class="libx-hint">Worlds group things that belong together, like a story or an AU. Inside a world you can make folders, like one per series.</div>'}
        ${tags.length ? `<div class="libx-rail-h">Tags</div><div class="libx-tagcloud">${tags.map(t => `<button class="libx-tag${view.tag && view.tag.toLowerCase() === t.tag.toLowerCase() ? ' on' : ''}" data-tagf="${esc(t.tag)}">${esc(t.tag)} <span>${t.count}</span></button>`).join('')}</div>` : ''}
      </nav>
      <main class="libx-main">
        ${curWorld ? worldHeadHtml(curWorld, m, rows) : ''}
        ${view.tag ? `<div class="libx-filterline">Tag: <b>${esc(view.tag)}</b> <button class="btn btn-s btn-sm" id="libxClearTag">Clear</button></div>` : ''}
        ${shown.length ? (view.layout === 'list' ? `
          ${pinned.length ? `<div class="libx-sec">★ Pinned</div><div class="libx-grid">${pinned.map(r => cardHtml(r, m, idx.get(r))).join('')}</div><div class="libx-sec">Everything else</div>` : ''}
          <div class="libx-grid">${rest.map(r => cardHtml(r, m, idx.get(r))).join('')}</div>` : shelvesHtml(shown, m, idx))
          : curWorld ? '<div class="lib-view-empty">nothing here yet<br><span style="font-size:.7rem;opacity:.6">use + New, or open an item\'s ⋯ and pick this world or folder</span></div>'
          : `<div class="lib-view-empty">${rows.length ? 'nothing matches that<br><span style="font-size:.7rem;opacity:.6">try another search or clear the filters</span>' : 'nothing in your library yet<br><span style="font-size:.7rem;opacity:.6">use + New to start something, or drop a file anywhere to import it</span>'}</div>`}
      </main>
    </div>
  </div>`;
  wire(el, shown);
}

function refresh() { renderLibraryView(); }
export function setLibraryLayout(l) { view.layout = l === 'list' ? 'list' : 'shelves'; saveView(); }
const setWorld = id => { view.world = id; view.folder = null; view.type = 'all'; view.tag = null; view.filtersOpen = false; saveView(); };

// A picture file turned into a small data URL, or '' (and a message) when it is not an image
function pickPicture(accept, maxW, maxH) {
  return new Promise(resolve => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) { resolve(''); return; }
      if (!/^image\//.test(f.type)) { toast('That is not a picture.', 'warn'); resolve(''); return; }
      const out = await resizeImage(await readFileAsDataUrl(f), maxW, maxH);
      if (!out) toast('Could not read that picture.', 'err');
      resolve(out);
    };
    inp.click();
  });
}
export const _pickPicture = { fn: pickPicture }; // a seam so tests can hand over a picture without a file dialog
const pick = (...a) => _pickPicture.fn(...a);

function wire(el, shown) {
  const q = el.querySelector('#libxSearch');
  let t = null;
  q.addEventListener('input', () => { view.q = q.value; clearTimeout(t); t = setTimeout(() => { refresh(); const n = document.getElementById('libxSearch'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 160); });
  el.querySelector('#libxSort').onchange = e => { view.sort = e.target.value; saveView(); refresh(); };
  el.querySelector('#libxLayoutShelves').onclick = () => { view.layout = 'shelves'; saveView(); refresh(); };
  el.querySelector('#libxLayoutList').onclick = () => { view.layout = 'list'; saveView(); refresh(); };
  el.querySelector('#libxFilterToggle').onclick = () => { view.filtersOpen = !view.filtersOpen; refresh(); };
  el.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { view.type = b.dataset.type; view.world = null; view.folder = null; view.tag = null; view.filtersOpen = false; saveView(); refresh(); });
  el.querySelectorAll('[data-world]').forEach(b => b.onclick = () => { setWorld(b.dataset.world); refresh(); });
  el.querySelectorAll('[data-tagf]').forEach(b => b.onclick = () => { view.tag = view.tag && view.tag.toLowerCase() === b.dataset.tagf.toLowerCase() ? null : b.dataset.tagf; saveView(); refresh(); });
  const ct = el.querySelector('#libxClearTag'); if (ct) ct.onclick = () => { view.tag = null; saveView(); refresh(); };

  // The + New menu is drawn with the page, after the app's one-time dropdown wiring, so it wires itself
  const dd = el.querySelector('#libxNewDd'), menu = dd.querySelector('.dd-menu');
  dd.querySelector('.dd-btn').onclick = e => { e.stopPropagation(); const open = menu.classList.contains('open'); closeAllDropdowns(); if (!open) menu.classList.add('open'); };
  el.querySelectorAll('[data-libnew]').forEach(b => b.onclick = () => { closeAllDropdowns(); newThing(b.dataset.libnew); });

  el.querySelector('#libxAddWorld').onclick = async () => { const n = await askInput('Name the new world:', ''); if (n && n.trim()) { const mm = metaGet(); const id = addWorld(mm, n, WORLD_COLORS[Object.keys(mm.worlds).length % WORLD_COLORS.length]); metaSet(mm); setWorld(id); refresh(); } };

  // world header
  const wn = el.querySelector('#libxWorldNote');
  if (wn) { let wt = null; wn.oninput = () => { clearTimeout(wt); wt = setTimeout(() => { const mm = metaGet(); if (mm.worlds[view.world]) { mm.worlds[view.world].note = wn.value; metaSet(mm); } }, 400); }; }
  const setWorldColor = c => { const mm = metaGet(); if (mm.worlds[view.world]) { mm.worlds[view.world].color = c; metaSet(mm); } refresh(); };
  el.querySelectorAll('[data-wcolor]').forEach(b => b.onclick = () => setWorldColor(b.dataset.wcolor));
  const wcp = el.querySelector('#libxWorldColorPick');
  if (wcp) wcp.onchange = () => setWorldColor(wcp.value);
  const rw = el.querySelector('#libxRenameWorld');
  if (rw) rw.onclick = async () => { const mm = metaGet(); const w = mm.worlds[view.world]; if (!w) return; const n = await askInput('Rename this world:', w.name); if (n && n.trim()) { w.name = n.trim().slice(0, 60); metaSet(mm); refresh(); } };
  const dw = el.querySelector('#libxDeleteWorld');
  if (dw) dw.onclick = async () => { const mm = metaGet(); const w = mm.worlds[view.world]; if (!w) return; if (!await askConfirm(`Delete the world "${w.name}"? Everything in it stays in your library.`)) return; removeWorld(mm, w.id); metaSet(mm); view.world = null; view.folder = null; saveView(); refresh(); };
  const bb = el.querySelector('#libxBannerBtn');
  if (bb) bb.onclick = async () => {
    const img = await pick('image/*', 1400, 420); if (!img) return;
    const mm = metaGet(); if (!mm.worlds[view.world]) return;
    mm.worlds[view.world].banner = img; metaSet(mm);
    if (!metaGet().worlds[view.world].banner) toast('That picture is too big to keep. Try a smaller one.', 'warn');
    refresh();
  };
  const bc = el.querySelector('#libxBannerClear');
  if (bc) bc.onclick = () => { const mm = metaGet(); if (mm.worlds[view.world]) { mm.worlds[view.world].banner = ''; metaSet(mm); } refresh(); };

  // folders
  el.querySelectorAll('[data-folder]').forEach(b => b.onclick = () => { view.folder = b.dataset.folder || null; saveView(); refresh(); });
  const af = el.querySelector('#libxAddFolder');
  if (af) af.onclick = async () => { const n = await askInput('Name the new folder:', ''); if (n && n.trim()) { const mm = metaGet(); const id = addFolder(mm, view.world, view.folder, n); if (id) metaSet(mm); refresh(); } };
  const rf = el.querySelector('#libxRenameFolder');
  if (rf) rf.onclick = async () => { const mm = metaGet(); const f = mm.folders[view.folder]; if (!f) return; const n = await askInput('Rename this folder:', f.name); if (n && n.trim()) { f.name = n.trim().slice(0, 60); metaSet(mm); refresh(); } };
  const df = el.querySelector('#libxDeleteFolder');
  if (df) df.onclick = async () => { const mm = metaGet(); const f = mm.folders[view.folder]; if (!f) return; if (!await askConfirm(`Delete the folder "${f.name}"? Everything in it moves up one level.`)) return; const up = f.parent; removeFolder(mm, f.id); metaSet(mm); view.folder = up || null; saveView(); refresh(); };

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
}

// ── New things made from the Library land in the world (and folder) that is open ──
function newThing(kind) {
  const before = new Set(allLibraryItems().map(i => itemKey(i.kind, i.id)));
  const inWorld = view.world && view.world !== 'none' ? view.world : null;
  const inFolder = inWorld ? view.folder : null;
  const adopt = () => {
    if (!inWorld) return;
    const fresh = allLibraryItems().filter(i => !before.has(itemKey(i.kind, i.id)));
    if (!fresh.length) return;
    const mm = metaGet(); fresh.forEach(i => patchItem(mm, i.kind, i.id, { world: inWorld, folder: inFolder, name: i.name })); metaSet(mm);
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

// ── Details: world, folder, tags, picture, symbol, note ──
let detailRow = null;
let detailDraft = { image: '', symbol: '', color: '' };

function folderOptions(m, worldId, selected) {
  const opts = ['<option value="">No folder (top level)</option>'];
  if (worldId && m.worlds[worldId]) {
    Object.values(m.folders).filter(f => f.world === worldId)
      .map(f => ({ f, label: folderPath(m, f.id).map(x => x.name).join(' › ') })).sort((a, b) => a.label.localeCompare(b.label))
      .forEach(({ f, label }) => opts.push(`<option value="${esc(f.id)}"${selected === f.id ? ' selected' : ''}>${esc(label)}</option>`));
    opts.push('<option value="__newfolder">+ New folder...</option>');
  }
  return opts.join('');
}
function paintColor() {
  if (!detailRow) return;
  const own = KIND_COLOR[detailRow.kind];
  g('libxColorGrid').querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === detailDraft.color));
  g('libxColorPick').value = detailDraft.color || own;
  g('libxColorClear').style.display = detailDraft.color ? '' : 'none';
}
function paintPicture() {
  if (!detailRow) return;
  paintColor();
  const own = detailRow && OWN_PICTURE.has(detailRow.kind);
  g('libxPicBox').style.display = own ? 'none' : '';
  g('libxPicOwn').style.display = own ? '' : 'none';
  if (own) return;
  g('libxPicPreview').innerHTML = detailDraft.image ? `<img src="${esc(detailDraft.image)}" alt="">` : `<span class="libx-sym">${esc(sym(detailDraft.symbol || KIND_INFO[detailRow.kind].icon))}</span>`;
  g('libxPicClear').style.display = detailDraft.image ? '' : 'none';
  g('libxSymClear').style.display = detailDraft.symbol ? '' : 'none';
  g('libxSymGrid').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.sym === detailDraft.symbol));
}

function openDetails(row) {
  detailRow = row;
  const m = metaGet();
  const rec = recordOf(m, row.kind, row.id);
  detailDraft = { image: rec.image || '', symbol: rec.symbol || '', color: rec.color || '' };
  g('libxDetailTitle').textContent = row.name || 'Untitled';
  g('libxDetailWorld').innerHTML = '<option value="">No world</option>' + Object.values(m.worlds).sort((a, b) => a.name.localeCompare(b.name)).map(w => `<option value="${esc(w.id)}"${rec.world === w.id ? ' selected' : ''}>${esc(w.name)}</option>`).join('') + '<option value="__new">+ New world...</option>';
  g('libxDetailFolder').innerHTML = folderOptions(m, rec.world, rec.folder);
  g('libxDetailFolder').disabled = !rec.world;
  g('libxDetailTags').value = rec.tags.join(', ');
  g('libxTagSuggest').innerHTML = tagCounts(m).map(t => `<option value="${esc(t.tag)}">`).join('');
  g('libxDetailNote').value = rec.note || '';
  paintPicture();
  openModal('libxDetailModal');
}
function saveDetails() {
  if (!detailRow) return;
  const patch = { tags: cleanTags(g('libxDetailTags').value), note: g('libxDetailNote').value, name: detailRow.name };
  patch.color = detailDraft.color;
  if (!OWN_PICTURE.has(detailRow.kind)) { patch.image = detailDraft.image; patch.symbol = detailDraft.symbol; }
  const w = g('libxDetailWorld').value;
  if (w !== '__new') patch.world = w || null;
  const f = g('libxDetailFolder').value;
  if (f !== '__newfolder') patch.folder = f || null;
  updateItem(detailRow.kind, detailRow.id, patch);
}
export function wireLibraryView() {
  ['libxDetailTags', 'libxDetailNote'].forEach(id => g(id).addEventListener('input', saveDetails));
  g('libxDetailWorld').onchange = async e => {
    if (!detailRow) return;
    let w = e.target.value;
    if (w === '__new') {
      const n = await askInput('Name the new world:', '');
      w = '';
      if (n && n.trim()) { const mm = metaGet(); w = addWorld(mm, n, WORLD_COLORS[Object.keys(mm.worlds).length % WORLD_COLORS.length]); metaSet(mm); }
    }
    // the world changed: keep the other fields, then redraw the folder list for the new world
    updateItem(detailRow.kind, detailRow.id, {
      world: w || null, folder: null, tags: cleanTags(g('libxDetailTags').value), note: g('libxDetailNote').value, name: detailRow.name,
      color: detailDraft.color,
      ...(OWN_PICTURE.has(detailRow.kind) ? {} : { image: detailDraft.image, symbol: detailDraft.symbol }),
    });
    openDetails(detailRow);
  };
  g('libxDetailFolder').onchange = async e => {
    if (!detailRow) return;
    if (e.target.value === '__newfolder') {
      const n = await askInput('Name the new folder:', '');
      const m = metaGet(); const rec = recordOf(m, detailRow.kind, detailRow.id);
      if (n && n.trim() && rec.world) { const fid = addFolder(m, rec.world, null, n); metaSet(m); updateItem(detailRow.kind, detailRow.id, { folder: fid }); }
      openDetails(detailRow); return;
    }
    saveDetails();
  };
  g('libxColorGrid').innerHTML = BOOK_COLORS.map(c => `<button type="button" class="libx-swatch" data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('');
  g('libxColorGrid').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (!b) return; detailDraft.color = b.dataset.color; saveDetails(); paintColor(); });
  g('libxColorPick').addEventListener('input', e => { detailDraft.color = e.target.value; saveDetails(); paintColor(); });
  g('libxColorClear').onclick = () => { detailDraft.color = ''; saveDetails(); paintColor(); };
  g('libxPicBtn').onclick = async () => { const img = await pick('image/*', 240, 240); if (img) { detailDraft.image = img; saveDetails(); paintPicture(); } };
  g('libxPicClear').onclick = () => { detailDraft.image = ''; saveDetails(); paintPicture(); };
  g('libxSymClear').onclick = () => { detailDraft.symbol = ''; saveDetails(); paintPicture(); };
  g('libxSymGrid').innerHTML = SYMBOL_CHOICES.map(s => `<button type="button" class="libx-symbtn" data-sym="${esc(s)}" aria-label="Symbol ${esc(s)}">${esc(sym(s))}</button>`).join('');
  g('libxSymGrid').addEventListener('click', e => { const b = e.target.closest('[data-sym]'); if (!b) return; detailDraft.symbol = b.dataset.sym; saveDetails(); paintPicture(); });
  g('libxDetailDone').onclick = () => { saveDetails(); closeModal('libxDetailModal'); refresh(); };
  g('libxDetailOpen').onclick = () => { if (!detailRow) { closeModal('libxDetailModal'); return; } saveDetails(); closeModal('libxDetailModal'); openLibraryItem(detailRow); };
  g('libxDetailModal').addEventListener('click', e => { if (e.target.dataset && e.target.dataset.close === 'libxDetailModal') { saveDetails(); refresh(); } });
  g('personaImportFile').addEventListener('change', () => setTimeout(refresh, 400));
  setPersonaListener(() => { if (document.getElementById('view-library') && document.getElementById('view-library').classList.contains('view-active')) refresh(); });
}

registerMarkup(189, `<div id="libxDetailModal" class="modal">
  <div class="modal-box" style="max-width:500px">
    <div class="modal-head"><h2 id="libxDetailTitle">Details</h2><button class="modal-x" data-close="libxDetailModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <label class="pr-lbl">Book colour</label>
      <div class="pr-row" style="align-items:center">
        <div id="libxColorGrid" class="libx-colorgrid" role="group" aria-label="Pick a colour"></div>
        <input type="color" id="libxColorPick" aria-label="Custom colour" title="Any colour">
        <button class="btn btn-s btn-sm" id="libxColorClear" type="button">Default</button>
      </div>
      <div id="libxPicBox" style="display:flex;flex-direction:column;gap:.5rem">
        <label class="pr-lbl">Picture or symbol</label>
        <div class="pr-row" style="align-items:center">
          <div id="libxPicPreview" class="persona-avatar"></div>
          <div style="display:flex;flex-direction:column;gap:.35rem">
            <button class="btn btn-s btn-sm" id="libxPicBtn" type="button">Choose a picture</button>
            <button class="btn btn-s btn-sm" id="libxPicClear" type="button">Remove picture</button>
            <button class="btn btn-s btn-sm" id="libxSymClear" type="button">Remove symbol</button>
          </div>
        </div>
        <div id="libxSymGrid" class="libx-symgrid" role="group" aria-label="Pick a symbol"></div>
        <div class="rx-none">A picture wins over a symbol.</div>
      </div>
      <div id="libxPicOwn" class="rx-none" style="display:none">Characters and personas show their own picture.</div>
      <label class="pr-lbl" for="libxDetailWorld">World</label>
      <select class="fselect" id="libxDetailWorld"></select>
      <label class="pr-lbl" for="libxDetailFolder">Folder</label>
      <select class="fselect" id="libxDetailFolder"></select>
      <label class="pr-lbl" for="libxDetailTags">Tags (separate with commas)</label>
      <input class="finput" id="libxDetailTags" list="libxTagSuggest" placeholder="fantasy, wip, favourite">
      <datalist id="libxTagSuggest"></datalist>
      <label class="pr-lbl" for="libxDetailNote">Notes</label>
      <textarea class="ftextarea" id="libxDetailNote" style="min-height:100px" placeholder="Anything you want to remember about this one"></textarea>
      <div class="pr-row"><button class="btn btn-p btn-sm" id="libxDetailDone">Done</button><button class="btn btn-s btn-sm" id="libxDetailOpen">Open it</button></div>
    </div>
  </div>
</div>`);
