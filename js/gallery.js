// ═══════════════════════════════════════════════════════
// GALLERY — pictures you keep: uploaded, generated, or edited in the Workshop.
//
//   state.galleryLibrary = { [id]: { id, name, thumb, w, h, source: 'upload'|'generated'|'edited', prompt, model, savedAt } }
//   the full-size picture lives under its own key, aet_img_<id>, so saving one picture never rewrites the rest.
//
// Pictures stay on this device. They are not part of the Drive sync or the backup file (they can be big);
// the Gallery has its own zip export and import instead.
// ═══════════════════════════════════════════════════════
import { readFileAsDataUrl, resizeImage } from './avatar.js';
import { store } from './kv.js';
import { state } from './state.js';
import { saveGalleryLibrary } from './storage.js';

export const GALLERY_MAX = 1800;     // px, longest edge of the stored picture
export const THUMB_MAX = 360;        // px, longest edge of the thumbnail
export const SOURCES = [['upload', 'Uploaded'], ['generated', 'Generated'], ['edited', 'Edited']];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const galleryId = () => 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
export const imgKey = id => 'aet_img_' + id;

const dims = url => new Promise(resolve => { const im = new Image(); im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => resolve({ w: 0, h: 0 }); im.src = url; });

export function normalizeEntry(e) {
  const o = isObj(e) ? e : {};
  return {
    id: String(o.id || galleryId()), name: String(o.name || 'Untitled picture').slice(0, 80),
    thumb: typeof o.thumb === 'string' && o.thumb.startsWith('data:image/') ? o.thumb : '',
    w: Math.max(0, Math.round(Number(o.w)) || 0), h: Math.max(0, Math.round(Number(o.h)) || 0),
    source: SOURCES.some(s => s[0] === o.source) ? o.source : 'upload',
    prompt: typeof o.prompt === 'string' ? o.prompt.slice(0, 4000) : '', model: typeof o.model === 'string' ? o.model.slice(0, 80) : '',
    savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date().toISOString(),
  };
}

// Shrink a picture for keeping: the full one and a thumbnail
export async function processPicture(dataUrl) {
  const image = await resizeImage(dataUrl, GALLERY_MAX, GALLERY_MAX, 0.9);
  if (!image) return null;
  const thumb = await resizeImage(image, THUMB_MAX, THUMB_MAX, 0.8);
  const d = await dims(image);
  return { image, thumb: thumb || image, w: d.w, h: d.h };
}

export const getEntry = id => state.galleryLibrary[id] || null;
export const getFull = id => store.get(imgKey(id)) || (state.galleryLibrary[id] && state.galleryLibrary[id].thumb) || '';
export const listPictures = () => Object.values(state.galleryLibrary).filter(isObj);

// Add a picture (a data URL). Returns its id, or '' when it could not be kept.
export async function addPicture({ dataUrl, name = '', source = 'upload', prompt = '', model = '' }) {
  const p = await processPicture(dataUrl);
  if (!p) return '';
  const id = galleryId();
  try { store.set(imgKey(id), p.image); } catch (e) { return ''; }
  state.galleryLibrary[id] = normalizeEntry({ id, name: name || 'Untitled picture', thumb: p.thumb, w: p.w, h: p.h, source, prompt, model, savedAt: new Date().toISOString() });
  if (!saveGalleryLibrary()) { delete state.galleryLibrary[id]; store.remove(imgKey(id)); return ''; }
  return id;
}
export async function addFiles(files) {
  const ids = [];
  for (const f of [...files]) {
    if (!/^image\//.test(f.type)) continue;
    const id = await addPicture({ dataUrl: await readFileAsDataUrl(f), name: f.name.replace(/\.[^.]+$/, ''), source: 'upload' });
    if (id) ids.push(id);
  }
  return ids;
}
// Replace a picture's pixels (an edit saved over it)
export async function replacePicture(id, dataUrl, patch = {}) {
  const e = state.galleryLibrary[id]; if (!e) return false;
  const p = await processPicture(dataUrl); if (!p) return false;
  store.set(imgKey(id), p.image);
  Object.assign(e, { thumb: p.thumb, w: p.w, h: p.h, savedAt: new Date().toISOString() }, patch);
  return saveGalleryLibrary();
}
export function renamePicture(id, name) {
  const e = state.galleryLibrary[id]; if (!e) return false;
  e.name = String(name || '').trim().slice(0, 80) || 'Untitled picture';
  return saveGalleryLibrary();
}
// Removing returns what is needed to put it back
export function removePicture(id) {
  const e = state.galleryLibrary[id]; if (!e) return null;
  const snapshot = { entry: JSON.parse(JSON.stringify(e)), image: store.get(imgKey(id)) || '' };
  delete state.galleryLibrary[id]; store.remove(imgKey(id)); saveGalleryLibrary();
  return snapshot;
}
export function restorePicture(snapshot) {
  if (!snapshot || !snapshot.entry) return false;
  const e = normalizeEntry(snapshot.entry);
  if (snapshot.image) store.set(imgKey(e.id), snapshot.image);
  state.galleryLibrary[e.id] = e;
  return saveGalleryLibrary();
}

// ── Filtering and sorting the grid ──
export function filterPictures(list, { q = '', source = 'all', sort = 'newest' } = {}, tagsOf = () => []) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = list.filter(p => {
    if (source !== 'all' && p.source !== source) return false;
    if (words.length) { const hay = [p.name, p.prompt, p.source, tagsOf(p).join(' ')].join(' ').toLowerCase(); if (!words.every(w => hay.includes(w))) return false; }
    return true;
  });
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (sort === 'oldest') out.sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  else if (sort === 'name') out.sort(byName);
  else out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return out;
}

// ── Export and import as a zip ──
export async function exportGalleryZip() {
  if (typeof JSZip === 'undefined') throw new Error('The zip library did not load.');
  const zip = new JSZip(), index = [];
  const used = new Set();
  for (const e of listPictures()) {
    const full = getFull(e.id); if (!full) continue;
    const m = full.match(/^data:image\/([a-z0-9+.-]+);base64,(.*)$/i); if (!m) continue;
    const ext = m[1].replace('jpeg', 'jpg').replace('+xml', '');
    let base = e.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'picture', n = base, k = 2;
    while (used.has(n.toLowerCase())) n = base + '-' + k++;
    used.add(n.toLowerCase());
    zip.file('images/' + n + '.' + ext, m[2], { base64: true });
    index.push({ file: 'images/' + n + '.' + ext, name: e.name, source: e.source, prompt: e.prompt, model: e.model, savedAt: e.savedAt });
  }
  zip.file('gallery.json', JSON.stringify({ format: 'loreos-gallery', version: 1, images: index }, null, 2));
  return zip.generateAsync({ type: 'blob' });
}
export async function importGalleryZip(buf) {
  if (typeof JSZip === 'undefined') throw new Error('The zip library did not load.');
  const zip = await JSZip.loadAsync(buf);
  let meta = {}; const jf = zip.file('gallery.json');
  if (jf) { try { const j = JSON.parse(await jf.async('string')); (j.images || []).forEach(x => { if (x && x.file) meta[x.file] = x; }); } catch (e) { /* plain zip of pictures */ } }
  let added = 0;
  for (const name of Object.keys(zip.files)) {
    const f = zip.files[name]; if (f.dir || !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name)) continue;
    const ext = name.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
    const dataUrl = 'data:image/' + ext + ';base64,' + await f.async('base64');
    const info = meta[name] || {};
    const id = await addPicture({ dataUrl, name: info.name || name.split('/').pop().replace(/\.[^.]+$/, ''), source: info.source || 'upload', prompt: info.prompt || '', model: info.model || '' });
    if (id) added++;
  }
  return added;
}
// Other modules plug in here (the Workshop image editor, image generation) so the Gallery can offer them
export const hooks = { edit: null, generate: null };
