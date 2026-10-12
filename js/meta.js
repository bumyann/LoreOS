// ═══════════════════════════════════════════════════════
// LIBRARY ORGANISATION — worlds, tags, pins, notes. A layer on top of the libraries:
// it never touches the items themselves, only points at them.
//
//   aet_meta = { v: 1,
//     worlds:  { [id]: { id, name, color, note, banner, createdAt } },
//     folders: { [id]: { id, world, parent, name } },   // subfolders inside a world, nested as deep as you like
//     items:   { "kind:id": { world, folder, tags: [], pinned, note, opened, name, symbol, image, color } } }
//
// kind is one of: lore, char, preset, prompt, regex, persona.
// Every item has a stable id. Characters, presets, packs and sets always had one. Saved lorebooks are
// still stored under their name (so nothing that already points at that name breaks) but each one now
// also carries an `id` that never changes when the book is renamed. `ensureLoreIds()` hands them out.
// The item's last known name is kept beside each record, so a record can still find its item if an
// older backup that had no ids is restored.
// ═══════════════════════════════════════════════════════
import { libGet, libSet, safeSet } from './storage.js';
import { store } from './kv.js';
import { state } from './state.js';

export const META_KEY = 'aet_meta';
export const KINDS = ['lore', 'char', 'preset', 'prompt', 'regex', 'persona'];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function newUid(prefix = 'x') {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 16); } catch (e) { /* insecure context */ }
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}
export const itemKey = (kind, id) => kind + ':' + id;

// ── Stable lorebook ids ──
// Gives every saved lorebook an id (and repairs duplicates). Safe to call any time; returns how many changed.
export function ensureLoreIds() {
  const lib = libGet();
  const seen = new Set();
  let changed = 0;
  Object.keys(lib).forEach(name => {
    const b = lib[name];
    if (!isObj(b)) return;
    if (!b.id || typeof b.id !== 'string' || seen.has(b.id)) { b.id = newUid('l'); changed++; }
    seen.add(b.id);
  });
  if (changed) libSet(lib);
  return changed;
}
// The library name for a lorebook id (or null)
export function loreNameById(id, lib = libGet()) {
  const hit = Object.keys(lib).find(n => isObj(lib[n]) && lib[n].id === id);
  return hit === undefined ? null : hit;
}

// ── The stored record ──
const MAX_IMG = 700000; // characters of data URL kept per picture
const cleanImg = v => (typeof v === 'string' && v.startsWith('data:image/') && v.length <= MAX_IMG ? v : '');
const cleanColor = v => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : '');
const cleanSym = v => (typeof v === 'string' ? Array.from(v.replace(/[\uFE0E\uFE0F]/g, '').trim()).slice(0, 2).join('') : '');
export function normalizeMeta(m) {
  const o = isObj(m) ? m : {};
  const worlds = {};
  Object.entries(isObj(o.worlds) ? o.worlds : {}).forEach(([id, w]) => {
    if (!isObj(w)) return;
    worlds[id] = { id, name: String(w.name || 'Untitled world').slice(0, 60), color: cleanColor(w.color), note: typeof w.note === 'string' ? w.note : '', banner: cleanImg(w.banner), createdAt: w.createdAt || '' };
  });
  const folders = {};
  Object.entries(isObj(o.folders) ? o.folders : {}).forEach(([id, f]) => {
    if (!isObj(f) || !worlds[f.world]) return;
    folders[id] = { id, world: f.world, parent: typeof f.parent === 'string' ? f.parent : null, name: String(f.name || 'Folder').slice(0, 60) };
  });
  // a folder's parent must exist, sit in the same world, and not lead back to itself
  Object.values(folders).forEach(f => {
    if (f.parent && (!folders[f.parent] || folders[f.parent].world !== f.world)) f.parent = null;
    let hops = 0, p = f.parent;
    while (p && hops++ < 60) p = folders[p] ? folders[p].parent : null;
    if (hops >= 60) f.parent = null;
  });
  const items = {};
  Object.entries(isObj(o.items) ? o.items : {}).forEach(([k, r]) => {
    if (!isObj(r)) return;
    const world = typeof r.world === 'string' && worlds[r.world] ? r.world : null;
    items[k] = {
      world,
      folder: world && typeof r.folder === 'string' && folders[r.folder] && folders[r.folder].world === world ? r.folder : null,
      tags: cleanTags(r.tags),
      pinned: !!r.pinned,
      note: typeof r.note === 'string' ? r.note : '',
      opened: typeof r.opened === 'string' ? r.opened : '',
      name: typeof r.name === 'string' ? r.name : '',
      symbol: cleanSym(r.symbol),
      image: cleanImg(r.image),
      color: cleanColor(r.color),
    };
  });
  return { v: 1, worlds, folders, items };
}
export function cleanTags(list) {
  const src = Array.isArray(list) ? list : typeof list === 'string' ? list.split(',') : [];
  const out = [], seen = new Set();
  src.forEach(t => {
    const s = String(t || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  });
  return out;
}

export function metaGet() {
  let raw = null;
  try { raw = store.get(META_KEY); } catch (e) { /* unreadable */ }
  if (!raw) return normalizeMeta(null);
  try { return normalizeMeta(JSON.parse(raw)); } catch (e) { return normalizeMeta(null); }
}
export function metaSet(m) { return safeSet(META_KEY, JSON.stringify(normalizeMeta(m))); }

const isEmptyRecord = r => !r.world && !r.folder && !r.tags.length && !r.pinned && !r.note && !r.opened && !r.symbol && !r.image && !r.color;
export function recordOf(m, kind, id) {
  return m.items[itemKey(kind, id)] || { world: null, folder: null, tags: [], pinned: false, note: '', opened: '', name: '', symbol: '', image: '', color: '' };
}
// Change one item's record. `patch` keys: world, tags, pinned, note, opened, name.
export function patchItem(m, kind, id, patch) {
  const k = itemKey(kind, id);
  const next = { ...recordOf(m, kind, id), ...patch };
  next.tags = cleanTags(next.tags);
  if (next.world && !m.worlds[next.world]) next.world = null;
  if (!next.world || !next.folder || !m.folders[next.folder] || m.folders[next.folder].world !== next.world) next.folder = null; // a folder belongs to one world
  next.symbol = cleanSym(next.symbol); next.image = cleanImg(next.image); next.color = cleanColor(next.color);
  if (isEmptyRecord(next)) delete m.items[k]; else m.items[k] = next;
  return m;
}
export function updateItem(kind, id, patch) {
  const m = metaGet(); patchItem(m, kind, id, patch); return metaSet(m);
}
export function togglePin(kind, id) {
  const m = metaGet(); const r = recordOf(m, kind, id); patchItem(m, kind, id, { pinned: !r.pinned }); metaSet(m); return !r.pinned;
}
export function markOpened(kind, id, name) {
  const m = metaGet(); patchItem(m, kind, id, { opened: new Date().toISOString(), ...(name ? { name } : {}) }); metaSet(m);
}

// ── Worlds ──
export function addWorld(m, name, color = '') {
  const id = newUid('w');
  m.worlds[id] = { id, name: String(name || 'New world').trim().slice(0, 60) || 'New world', color, note: '', createdAt: new Date().toISOString() };
  return id;
}
export function removeWorld(m, id) {
  delete m.worlds[id];
  Object.keys(m.folders).forEach(f => { if (m.folders[f].world === id) delete m.folders[f]; });
  Object.keys(m.items).forEach(k => { if (m.items[k].world === id) { m.items[k].world = null; m.items[k].folder = null; if (isEmptyRecord(m.items[k])) delete m.items[k]; } });
  return m;
}

// ── Folders inside a world ──
export function addFolder(m, world, parent, name) {
  if (!m.worlds[world]) return null;
  const id = newUid('f');
  m.folders[id] = { id, world, parent: parent && m.folders[parent] && m.folders[parent].world === world ? parent : null, name: String(name || 'New folder').trim().slice(0, 60) || 'New folder' };
  return id;
}
// Deleting a folder keeps what is inside: its items and subfolders move up one level
export function removeFolder(m, id) {
  const f = m.folders[id]; if (!f) return m;
  Object.values(m.folders).forEach(c => { if (c.parent === id) c.parent = f.parent; });
  Object.keys(m.items).forEach(k => { if (m.items[k].folder === id) m.items[k].folder = f.parent; });
  delete m.folders[id];
  return m;
}
export function folderPath(m, id) {
  const out = []; let cur = id, hops = 0;
  while (cur && m.folders[cur] && hops++ < 60) { out.unshift(m.folders[cur]); cur = m.folders[cur].parent; }
  return out;
}
export const childFolders = (m, world, parent) => Object.values(m.folders).filter(f => f.world === world && (f.parent || null) === (parent || null)).sort((a, b) => a.name.localeCompare(b.name));
// ids of a folder and everything below it
export function folderTree(m, id) {
  const out = [id];
  Object.values(m.folders).forEach(f => { if (f.parent === id) out.push(...folderTree(m, f.id)); });
  return out;
}

// ── Reading back ──
export function tagCounts(m) {
  const c = new Map();
  Object.values(m.items).forEach(r => r.tags.forEach(t => { const k = t.toLowerCase(); const cur = c.get(k) || { tag: t, count: 0 }; cur.count++; c.set(k, cur); }));
  return [...c.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
export function worldCounts(m) {
  const c = {};
  Object.values(m.items).forEach(r => { if (r.world) c[r.world] = (c[r.world] || 0) + 1; });
  return c;
}

// Everything in the libraries as one list: { kind, id, key, name, savedAt, icon?, entry }
export function allLibraryItems() {
  ensureLoreIds();
  const out = [];
  const lib = libGet();
  Object.keys(lib).forEach(n => { const b = lib[n]; if (isObj(b)) out.push({ kind: 'lore', id: b.id, key: n, name: b.name || n, savedAt: b.savedAt || '', entry: b }); });
  const add = (kind, map) => Object.values(map || {}).forEach(e => { if (isObj(e) && e.id) out.push({ kind, id: e.id, key: e.id, name: e.name || '', savedAt: e.savedAt || '', entry: e }); });
  add('char', state.charLibrary); add('preset', state.presetLibrary); add('prompt', state.promptLibrary); add('regex', state.regexLibrary);
  add('persona', state.personaLibrary);
  return out;
}

// Records whose item can no longer be found. A lorebook record is re-pointed by name first (this is what
// happens when a backup from before ids existed is restored), so nothing is lost. Records that really
// have no item are only removed when asked to (`drop`), never automatically.
export function repairMeta({ drop = false } = {}) {
  const m = metaGet();
  const items = allLibraryItems();
  const live = new Set(items.map(i => itemKey(i.kind, i.id)));
  const loreByName = {};
  items.filter(i => i.kind === 'lore').forEach(i => { loreByName[i.key] = i; });
  let moved = 0, dropped = 0;
  Object.keys(m.items).forEach(k => {
    if (live.has(k)) return;
    const r = m.items[k];
    if (k.startsWith('lore:') && r.name && loreByName[r.name] && !m.items[itemKey('lore', loreByName[r.name].id)]) {
      m.items[itemKey('lore', loreByName[r.name].id)] = r; delete m.items[k]; moved++;
    } else if (drop) { delete m.items[k]; dropped++; }
  });
  if (moved || dropped) metaSet(m);
  return { moved, dropped };
}
