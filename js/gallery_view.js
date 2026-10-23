// ═══════════════════════════════════════════════════════
// GALLERY VIEW — the Library's second tab: every picture you have kept, as a wall you can search and
// filter, with a viewer (lightbox) that can edit, favourite, tag, download, or pin a picture to Home.
// ═══════════════════════════════════════════════════════
import { resizeImage } from './avatar.js';
import { SOURCES, addFiles, exportGalleryZip, filterPictures, folderAdd, folderMove, folderPathIds, folderRemove, folderRename, foldersGet, getEntry, getFull, hooks, importGalleryZip, listPictures, moveToFolder, removePicture, renamePicture, restorePicture } from './gallery.js';
import { homeGet, homeId, homeSet, normalizeCard } from './home.js';
import { openItemDetails, refreshLibrary, setImageOpener, tabsHtml, wireTabs } from './library_view.js';
import { metaGet, metaSet, recordOf, togglePin } from './meta.js';
import { askConfirm, askInput, closeAllDropdowns, closeModal, dlFile, esc, g, openModal, registerMarkup, toast } from './util.js';

const GV_KEY = 'loreos_galview';
const gv = { folder: '', q: '', source: 'all', sort: 'newest', tag: null, world: '', favs: false, size: 'm' };
try { Object.assign(gv, JSON.parse(localStorage.getItem(GV_KEY) || '{}'), { q: '' }); } catch (e) { /* first run */ }
const saveGv = () => { try { localStorage.setItem(GV_KEY, JSON.stringify({ folder: gv.folder, source: gv.source, sort: gv.sort, tag: gv.tag, world: gv.world, favs: gv.favs, size: gv.size })); } catch (e) { /* private mode */ } };

let shownIds = [];       // the pictures on screen, in order, for the viewer's arrows
let openId = null;
let lastSnapshot = null;

const tagsOfPicture = (m, id) => recordOf(m, 'image', id).tags;

export function renderGalleryView(el) {
  const m = metaGet();
  const all = listPictures();
  // a tag or world that is gone must not leave the wall empty
  if (gv.world && !m.worlds[gv.world]) gv.world = '';
  const tagCount = new Map();
  all.forEach(p => tagsOfPicture(m, p.id).forEach(t => tagCount.set(t.toLowerCase(), { tag: t, n: (tagCount.get(t.toLowerCase()) || { n: 0 }).n + 1 })));
  const tags = [...tagCount.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).slice(0, 14);
  if (gv.tag && !tagCount.has(gv.tag.toLowerCase())) gv.tag = null;

  let shown = filterPictures(all, { q: gv.q, source: gv.source, sort: gv.sort }, p => tagsOfPicture(m, p.id));
  shown = shown.filter(p => {
    const rec = recordOf(m, 'image', p.id);
    if (gv.favs && !rec.pinned) return false;
    if (gv.tag && !rec.tags.some(t => t.toLowerCase() === gv.tag.toLowerCase())) return false;
    if (gv.world && rec.world !== gv.world) return false;
    return true;
  });
  // inside a folder you see that folder; searching or filtering looks through every folder
  const folders = foldersGet();
  if (gv.folder && !folders.some(f => f.id === gv.folder)) gv.folder = '';
  const filteringAny = gv.q.trim() || gv.source !== 'all' || gv.tag || gv.world || gv.favs;
  const here = filteringAny ? null : gv.folder;
  if (here !== null) shown = shown.filter(p => (p.folder || '') === here);
  const subfolders = here === null ? [] : folders.filter(f => f.parent === here).sort((a, b) => a.name.localeCompare(b.name));
  const crumbs = here ? folderPathIds(folders, here).map(i => folders.find(f => f.id === i)) : [];
  const countIn = id => { const ids = new Set([id]); let grew = true; while (grew) { grew = false; folders.forEach(f => { if (f.parent && ids.has(f.parent) && !ids.has(f.id)) { ids.add(f.id); grew = true; } }); } return all.filter(p => ids.has(p.folder)).length; };
  shownIds = shown.map(p => p.id);
  const worlds = Object.values(m.worlds).sort((a, b) => a.name.localeCompare(b.name));
  const filtering = gv.q.trim() || gv.source !== 'all' || gv.tag || gv.world || gv.favs;

  el.innerHTML = `
  <div class="libx">
    <div class="libx-top">
      ${tabsHtml('gallery')}
      <input class="finput libx-search" id="galSearch" type="search" placeholder="Search names and prompts..." value="${esc(gv.q)}" aria-label="Search the gallery">
      <select class="fselect libx-sort" id="galSort" aria-label="Sort"><option value="newest"${gv.sort === 'newest' ? ' selected' : ''}>Newest</option><option value="oldest"${gv.sort === 'oldest' ? ' selected' : ''}>Oldest</option><option value="name"${gv.sort === 'name' ? ' selected' : ''}>Name</option></select>
      <div class="dd" id="galAddDd"><button class="btn btn-ok dd-btn" id="galAddBtn" aria-haspopup="true">+ Add</button>
        <div class="dd-menu">
          <button class="dd-item" data-galadd="upload">Upload pictures</button>
          ${hooks.generate ? '<button class="dd-item" data-galadd="generate">Generate a picture...</button>' : ''}
          <button class="dd-item" data-galadd="folder">New folder</button>
          <button class="dd-item" data-galadd="zipin">Import a zip of pictures</button>
          <button class="dd-item" data-galadd="zipout">Export everything as a zip</button>
        </div></div>
      <div class="libx-layout" role="group" aria-label="Picture size"><button class="btn btn-s btn-sm${gv.size === 's' ? ' on' : ''}" data-galsize="s" aria-pressed="${gv.size === 's'}">S</button><button class="btn btn-s btn-sm${gv.size === 'm' ? ' on' : ''}" data-galsize="m" aria-pressed="${gv.size === 'm'}">M</button><button class="btn btn-s btn-sm${gv.size === 'l' ? ' on' : ''}" data-galsize="l" aria-pressed="${gv.size === 'l'}">L</button></div>
    </div>
    <div class="gal-bar" role="toolbar" aria-label="Gallery filters">
      <button class="gal-chip${gv.source === 'all' ? ' on' : ''}" data-galsrc="all">All <span>${all.length}</span></button>
      ${SOURCES.map(([k, l]) => `<button class="gal-chip${gv.source === k ? ' on' : ''}" data-galsrc="${k}">${l} <span>${all.filter(p => p.source === k).length}</span></button>`).join('')}
      <button class="gal-chip${gv.favs ? ' on' : ''}" id="galFavs" aria-pressed="${gv.favs}">★ Favourites</button>
      ${tags.map(t => `<button class="gal-chip${gv.tag && gv.tag.toLowerCase() === t.tag.toLowerCase() ? ' on' : ''}" data-galtag="${esc(t.tag)}">${esc(t.tag)}</button>`).join('')}
      ${worlds.length ? `<select class="fselect" id="galWorld" aria-label="World" style="width:auto"><option value="">All worlds</option>${worlds.map(w => `<option value="${esc(w.id)}"${gv.world === w.id ? ' selected' : ''}>${esc(w.name)}</option>`).join('')}</select>` : ''}
    </div>
    ${here === null ? '' : `<nav class="gal-crumbs" aria-label="Folders"><button type="button" data-galfolder="" class="gal-crumb">All pictures</button>${crumbs.map(c => `<span aria-hidden="true">›</span><button type="button" data-galfolder="${esc(c.id)}" class="gal-crumb${c.id === here ? ' on' : ''}">${esc(c.name)}</button>`).join('')}${here ? `<span class="gal-crumb-tools"><button type="button" class="btn btn-s btn-sm" id="galFolderRename">Rename</button><button type="button" class="btn btn-s btn-sm" id="galFolderMove">Move folder</button><button type="button" class="btn btn-s btn-sm" id="galFolderDel">Delete folder</button></span>` : ''}</nav>`}
    ${subfolders.length ? `<div class="gal-folders" role="list">${subfolders.map(f => `<button type="button" role="listitem" class="gal-folder" data-galfolder="${esc(f.id)}" data-dropfolder="${esc(f.id)}"><span class="gal-folder-ico" aria-hidden="true">▤</span><span class="gal-folder-name">${esc(f.name)}</span><span class="gal-folder-n">${countIn(f.id)}</span></button>`).join('')}</div>` : ''}
    <div class="gal-zone" id="galZone" data-drop-own>
      ${shown.length ? `<div class="gal-grid ${gv.size}" id="galGrid" role="list">${shown.map((p, i) => {
        const rec = recordOf(m, 'image', p.id);
        return `<figure class="gal-item" role="listitem" tabindex="0" draggable="true" data-gal="${esc(p.id)}" aria-label="${esc(p.name)}"><img src="${esc(p.thumb)}" alt="${esc(p.name)}"${p.w && p.h ? ` width="${p.w}" height="${p.h}"` : ''} loading="lazy">${rec.pinned ? '<span class="gal-fav" aria-label="Favourite">★</span>' : ''}<figcaption class="gal-cap"><span>${esc(p.name)}</span><span>${esc((SOURCES.find(s => s[0] === p.source) || [])[1] || '')}</span></figcaption></figure>`;
      }).join('')}</div>`
      : subfolders.length && !filtering ? `<div class="lib-view-empty">no loose pictures in here</div>`
      : `<div class="lib-view-empty">${filtering ? 'no pictures match that<br><span style="font-size:.7rem;opacity:.6">try another search or clear the filters</span>' : 'no pictures yet<br><span style="font-size:.7rem;opacity:.6">use + Add, or drop pictures here, or paste one</span>'}</div>`}
    </div>
  </div>`;
  wireGallery(el);
}

function wireGallery(el) {
  wireTabs(el);
  const re = () => refreshLibrary();
  const q = el.querySelector('#galSearch'); let t = null;
  q.addEventListener('input', () => { gv.q = q.value; clearTimeout(t); t = setTimeout(() => { re(); const n = document.getElementById('galSearch'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 160); });
  el.querySelector('#galSort').onchange = e => { gv.sort = e.target.value; saveGv(); re(); };
  el.querySelectorAll('[data-galsrc]').forEach(b => b.onclick = () => { gv.source = b.dataset.galsrc; saveGv(); re(); });
  el.querySelectorAll('[data-galsize]').forEach(b => b.onclick = () => { gv.size = b.dataset.galsize; saveGv(); re(); });
  el.querySelectorAll('[data-galtag]').forEach(b => b.onclick = () => { gv.tag = gv.tag && gv.tag.toLowerCase() === b.dataset.galtag.toLowerCase() ? null : b.dataset.galtag; saveGv(); re(); });
  el.querySelector('#galFavs').onclick = () => { gv.favs = !gv.favs; saveGv(); re(); };
  const w = el.querySelector('#galWorld'); if (w) w.onchange = e => { gv.world = e.target.value; saveGv(); re(); };
  // the + Add menu is drawn with the page, after the app's one-time dropdown wiring, so it wires itself
  const dd = el.querySelector('#galAddDd'), menu = dd.querySelector('.dd-menu');
  dd.querySelector('.dd-btn').onclick = e => { e.stopPropagation(); const open = menu.classList.contains('open'); closeAllDropdowns(); if (!open) menu.classList.add('open'); };
  el.querySelectorAll('[data-galadd]').forEach(b => b.onclick = () => { closeAllDropdowns(); addAction(b.dataset.galadd); });
  el.querySelectorAll('[data-galfolder]').forEach(b => b.onclick = () => { gv.folder = b.dataset.galfolder; saveGv(); re(); });
  const fr = el.querySelector('#galFolderRename'); if (fr) fr.onclick = async () => { const f = foldersGet().find(x => x.id === gv.folder); if (!f) return; const n = await askInput('Folder name', f.name); if (n && n.trim()) { folderRename(f.id, n); re(); } };
  const fm = el.querySelector('#galFolderMove'); if (fm) fm.onclick = async () => { const to = await pickFolder('Move this folder into...', gv.folder); if (to === null) return; if (!folderMove(gv.folder, to)) toast('A folder cannot go inside itself.', 'warn'); re(); };
  const fd = el.querySelector('#galFolderDel'); if (fd) fd.onclick = async () => { if (!await askConfirm('Delete this folder? The pictures and folders inside move up one level.')) return; const f = foldersGet().find(x => x.id === gv.folder); folderRemove(gv.folder); gv.folder = f ? f.parent : ''; saveGv(); re(); };
  // drag a picture onto a folder (or onto the breadcrumb) to file it
  let dragId = null;
  el.querySelectorAll('[data-gal]').forEach(n => { n.addEventListener('dragstart', e => { dragId = n.dataset.gal; try { e.dataTransfer.setData('text/x-loreos-pic', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* fine */ } }); n.addEventListener('dragend', () => { dragId = null; }); });
  const dropTargets = [...el.querySelectorAll('[data-dropfolder]'), ...el.querySelectorAll('.gal-crumb')];
  dropTargets.forEach(t => {
    const target = () => t.dataset.dropfolder !== undefined ? t.dataset.dropfolder : t.dataset.galfolder;
    t.addEventListener('dragover', e => { if (dragId) { e.preventDefault(); t.classList.add('over'); } });
    t.addEventListener('dragleave', () => t.classList.remove('over'));
    t.addEventListener('drop', e => { if (!dragId) return; e.preventDefault(); e.stopPropagation(); t.classList.remove('over'); moveToFolder(dragId, target()); dragId = null; re(); });
  });
  el.querySelectorAll('[data-gal]').forEach(n => {
    const open = () => openViewer(n.dataset.gal);
    n.addEventListener('click', open);
    n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  const zone = el.querySelector('#galZone');
  const takes = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  zone.addEventListener('dragover', e => { if (takes(e)) { e.preventDefault(); zone.classList.add('over'); } });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('over'); });
  zone.addEventListener('drop', async e => { if (!takes(e)) return; e.preventDefault(); zone.classList.remove('over'); await ingest(e.dataTransfer.files); });
}

async function ingest(files) {
  const imgs = [...files].filter(f => /^image\//.test(f.type));
  if (!imgs.length) { toast('Drop pictures here to add them.', 'info'); return; }
  toast('Adding ' + imgs.length + ' picture' + (imgs.length === 1 ? '' : 's') + '...', 'info');
  const ids = await addFiles(imgs);
  if (gv.folder && ids.length) moveToFolder(ids, gv.folder);
  toast(ids.length ? `Added ${ids.length} picture${ids.length === 1 ? '' : 's'} to the gallery.` : 'Could not keep those pictures (is the browser storage full?).', ids.length ? 'ok' : 'err');
  refreshLibrary();
}

async function addAction(kind) {
  if (kind === 'folder') {
    const name = await askInput('Folder name', ''); if (!name || !name.trim()) return;
    const f = folderAdd(name, gv.folder || ''); if (!f) { toast('Could not make the folder.', 'err'); return; }
    gv.folder = f.id; saveGv(); refreshLibrary(); return;
  }
  if (kind === 'upload') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.onchange = () => ingest(inp.files); inp.click(); return; }
  if (kind === 'generate' && hooks.generate) { hooks.generate(); return; }
  if (kind === 'zipin') {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip,application/zip';
    inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const n = await importGalleryZip(await f.arrayBuffer()); toast(`Imported ${n} picture${n === 1 ? '' : 's'}.`, n ? 'ok' : 'warn'); refreshLibrary(); } catch (e) { toast('Import failed: ' + e.message, 'err'); } };
    inp.click(); return;
  }
  if (kind === 'zipout') {
    if (!listPictures().length) { toast('The gallery is empty.', 'info'); return; }
    try { const blob = await exportGalleryZip(); dlFile(blob, 'loreos-gallery.zip', 'application/zip'); toast('Exported the gallery.', 'ok'); } catch (e) { toast('Export failed: ' + e.message, 'err'); }
  }
}

// ── The viewer ──
export function openViewer(id) {
  const e = getEntry(id); if (!e) return;
  openId = id;
  const m = metaGet(), rec = recordOf(m, 'image', id);
  g('galLbImg').src = getFull(id);
  g('galLbImg').alt = e.name;
  g('galLbName').value = e.name;
  const src = (SOURCES.find(s => s[0] === e.source) || [])[1] || '';
  g('galLbMeta').textContent = [src, e.w && e.h ? e.w + ' × ' + e.h : '', new Date(e.savedAt).toLocaleDateString(), e.model || ''].filter(Boolean).join(' · ');
  g('galLbPromptWrap').style.display = e.prompt ? '' : 'none';
  g('galLbPrompt').textContent = e.prompt || '';
  g('galLbFav').textContent = rec.pinned ? '★ Favourite' : '☆ Favourite';
  g('galLbFav').setAttribute('aria-pressed', String(!!rec.pinned));
  g('galLbEdit').style.display = hooks.edit ? '' : 'none';
  g('galLbFolderName').textContent = folderLabel(e.folder);
  const i = shownIds.indexOf(id);
  g('galLbPrev').style.display = g('galLbNext').style.display = shownIds.length > 1 && i >= 0 ? '' : 'none';
  openModal('galLightbox');
}
const folderLabel = id => { if (!id) return 'none'; const l = foldersGet(); return folderPathIds(l, id).map(i => l.find(f => f.id === i).name).join(' / ') || 'none'; };
// A small chooser: every folder as a path, plus the top level. Resolves to a folder id ('' for the top), or null if dismissed.
function pickFolder(title, exclude = '') {
  const l = foldersGet(); const blocked = new Set();
  if (exclude) { blocked.add(exclude); let grew = true; while (grew) { grew = false; l.forEach(f => { if (f.parent && blocked.has(f.parent) && !blocked.has(f.id)) { blocked.add(f.id); grew = true; } }); } }
  const rows = [['', 'Top level (no folder)'], ...l.filter(f => !blocked.has(f.id)).map(f => [f.id, folderPathIds(l, f.id).map(i => l.find(x => x.id === i).name).join(' / ')]).sort((a, b) => a[1].localeCompare(b[1]))];
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'modal open gal-pick'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', title);
    wrap.innerHTML = `<div class="modal-box" style="max-width:360px"><div class="modal-hdr"><b>${esc(title)}</b></div><div class="modal-body gal-pick-list">${rows.map(([id, n]) => `<button type="button" class="dd-item" data-pick="${esc(id)}">${esc(n)}</button>`).join('')}<button type="button" class="dd-item" data-pick-new>+ New folder...</button></div><div class="modal-ftr"><button class="btn btn-s" data-pick-x>Cancel</button></div></div>`;
    const done = v => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', async e => {
      if (e.target === wrap || e.target.closest('[data-pick-x]')) return done(null);
      const nw = e.target.closest('[data-pick-new]'); if (nw) { wrap.remove(); const name = await askInput('Folder name', ''); if (!name || !name.trim()) return resolve(null); const f = folderAdd(name, ''); return resolve(f ? f.id : null); }
      const b = e.target.closest('[data-pick]'); if (b) done(b.dataset.pick);
    });
    document.body.append(wrap);
  });
}
const step = d => { if (!openId) return; const i = shownIds.indexOf(openId); if (i < 0 || shownIds.length < 2) return; openViewer(shownIds[(i + d + shownIds.length) % shownIds.length]); };

export async function pinToHome(id) {
  const e = getEntry(id); if (!e) return false;
  const small = await resizeImage(getFull(id), 640, 640);
  if (!small || small.length > 700000) { toast('That picture is too big for the board.', 'warn'); return false; }
  const home = homeGet();
  home.board.unshift(normalizeCard({ id: homeId(), type: 'image', title: e.name, image: small, iw: Math.min(e.w, 640) || 0, ih: e.w ? Math.round(e.h * Math.min(1, 640 / Math.max(e.w, e.h))) : 0, createdAt: new Date().toISOString() }));
  homeSet(home);
  return true;
}

export function deleteWithUndo(id) {
  const m = metaGet(); const key = 'image:' + id; const record = m.items[key] ? JSON.parse(JSON.stringify(m.items[key])) : null;
  const snap = removePicture(id); if (!snap) return false;
  if (record) { delete m.items[key]; metaSet(m); }
  lastSnapshot = { snap, record };
  toast('Deleted "' + snap.entry.name + '".', 'info', { action: { label: 'Undo', fn: () => undoDelete() }, ms: 9000 });
  return true;
}
export function undoDelete() {
  if (!lastSnapshot) return false;
  const { snap, record } = lastSnapshot; lastSnapshot = null;
  restorePicture(snap);
  if (record) { const m = metaGet(); m.items['image:' + snap.entry.id] = record; metaSet(m); }
  refreshLibrary();
  return true;
}

export function wireGalleryViewer() {
  g('galLbClose').onclick = () => closeModal('galLightbox');
  g('galLbPrev').onclick = () => step(-1);
  g('galLbNext').onclick = () => step(1);
  g('galLbName').addEventListener('change', () => { if (openId) { renamePicture(openId, g('galLbName').value); refreshLibrary(); } });
  g('galLbFav').onclick = () => { if (!openId) return; const on = togglePin('image', openId); g('galLbFav').textContent = on ? '★ Favourite' : '☆ Favourite'; g('galLbFav').setAttribute('aria-pressed', String(on)); refreshLibrary(); };
  g('galLbDetails').onclick = () => { const e = openId && getEntry(openId); if (!e) return; closeModal('galLightbox'); openItemDetails({ kind: 'image', id: e.id, key: e.id, name: e.name, entry: e }); };
  g('galLbFolder').onclick = async () => { if (!openId) return; const to = await pickFolder('Put this picture in...'); if (to === null) return; moveToFolder(openId, to); g('galLbFolderName').textContent = folderLabel(to); refreshLibrary(); };
  g('galLbEdit').onclick = () => { if (openId && hooks.edit) { const id = openId; closeModal('galLightbox'); hooks.edit(id); } };
  g('galLbHome').onclick = async () => { if (openId && await pinToHome(openId)) toast('Pinned to the Home board.', 'ok'); };
  g('galLbDl').onclick = () => {
    const e = openId && getEntry(openId); if (!e) return;
    const full = getFull(openId); const ext = (full.match(/^data:image\/([a-z0-9]+)/i) || [, 'png'])[1].replace('jpeg', 'jpg');
    const a = document.createElement('a'); a.href = full; a.download = (e.name.replace(/[\\/:*?"<>|]+/g, '_') || 'picture') + '.' + ext; document.body.append(a); a.click(); a.remove();
  };
  g('galLbCopyPrompt').onclick = async () => { const e = openId && getEntry(openId); if (!e || !e.prompt) return; try { await navigator.clipboard.writeText(e.prompt); toast('Prompt copied.', 'ok'); } catch (err) { toast('Could not copy.', 'warn'); } };
  g('galLbDelete').onclick = () => { if (!openId) return; const id = openId; closeModal('galLightbox'); openId = null; deleteWithUndo(id); refreshLibrary(); };
  document.addEventListener('keydown', e => {
    const lb = g('galLightbox'); if (!lb || !lb.classList.contains('open')) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  // paste a picture while the Gallery is showing
  document.addEventListener('paste', async e => {
    const zone = document.getElementById('galZone'), view = document.getElementById('view-library');
    if (!zone || !view || !view.classList.contains('view-active')) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable="true"], .modal.open')) return;
    const files = e.clipboardData && [...e.clipboardData.files].filter(f => /^image\//.test(f.type));
    if (!files || !files.length) return;
    e.preventDefault(); await ingest(files);
  });
  setImageOpener(id => { showTab(); openViewer(id); });
}
function showTab() { /* the viewer is a dialog, it opens over whichever tab is showing */ }

registerMarkup(191, `<div id="galLightbox" class="modal gal-lb" aria-label="Picture viewer">
  <div class="gal-lb-box">
    <div class="gal-lb-stage"><img id="galLbImg" alt=""><button class="gal-lb-nav prev" id="galLbPrev" aria-label="Previous picture">‹</button><button class="gal-lb-nav next" id="galLbNext" aria-label="Next picture">›</button></div>
    <div class="gal-lb-side">
      <div class="pr-row" style="justify-content:space-between;align-items:center"><span class="pr-lbl">Picture</span><button class="modal-x" id="galLbClose" aria-label="Close">×</button></div>
      <input class="finput" id="galLbName" maxlength="80" aria-label="Name">
      <div class="gal-lb-meta" id="galLbMeta"></div>
      <div id="galLbPromptWrap"><div class="pr-lbl">Prompt</div><div class="gal-lb-prompt" id="galLbPrompt"></div><button class="btn btn-s btn-sm" id="galLbCopyPrompt" style="margin-top:.3rem">Copy prompt</button></div>
      <div class="pr-row"><button class="btn btn-s btn-sm" id="galLbFav" aria-pressed="false">☆ Favourite</button><button class="btn btn-s btn-sm" id="galLbDetails">World, tags, notes</button></div>
      <div class="pr-row"><button class="btn btn-s btn-sm" id="galLbFolder">Folder: <span id="galLbFolderName">none</span></button></div>
      <div class="pr-row"><button class="btn btn-p btn-sm" id="galLbEdit">Edit</button><button class="btn btn-s btn-sm" id="galLbHome">Pin to Home</button><button class="btn btn-s btn-sm" id="galLbDl">Download</button></div>
      <div class="pr-row"><button class="btn btn-err btn-sm" id="galLbDelete">Delete</button></div>
    </div>
  </div>
</div>`);
