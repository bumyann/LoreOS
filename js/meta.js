// ═══════════════════════════════════════════════════════
// LIBRARY ORGANISATION — worlds, tags, pins, notes. A layer on top of the libraries:
// it never touches the items themselves, only points at them.
//
//   aet_meta = { v: 1,
//     worlds: { [id]: { id, name, color, note, createdAt } },
//     items:  { "kind:id": { world, tags: [], pinned, note, opened, name } } }
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
export function normalizeMeta(m) {
  const o = isObj(m) ? m : {};
  const worlds = {};
  Object.entries(isObj(o.worlds) ? o.worlds : {}).forEach(([id, w]) => {
    if (!isObj(w)) return;
    worlds[id] = { id, name: String(w.name || 'Untitled world').slice(0, 60), color: typeof w.color === 'string' ? w.color : '', note: typeof w.note === 'string' ? w.note : '', createdAt: w.createdAt || '' };
  });
  const items = {};
  Object.entries(isObj(o.items) ? o.items : {}).forEach(([k, r]) => {
    if (!isObj(r)) return;
    items[k] = {
      world: typeof r.world === 'string' && worlds[r.world] ? r.world : null,
      tags: cleanTags(r.tags),
      pinned: !!r.pinned,
      note: typeof r.note === 'string' ? r.note : '',
      opened: typeof r.opened === 'string' ? r.opened : '',
      name: typeof r.name === 'string' ? r.name : '',
    };
  });
  return { v: 1, worlds, items };
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

const isEmptyRecord = r => !r.world && !r.tags.length && !r.pinned && !r.note && !r.opened;
export function recordOf(m, kind, id) {
  return m.items[itemKey(kind, id)] || { world: null, tags: [], pinned: false, note: '', opened: '', name: '' };
}
// Change one item's record. `patch` keys: world, tags, pinned, note, opened, name.
export function patchItem(m, kind, id, patch) {
  const k = itemKey(kind, id);
  const next = { ...recordOf(m, kind, id), ...patch };
  next.tags = cleanTags(next.tags);
  if (next.world && !m.worlds[next.world]) next.world = null;
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
  Object.keys(m.items).forEach(k => { if (m.items[k].world === id) { m.items[k].world = null; if (isEmptyRecord(m.items[k])) delete m.items[k]; } });
  return m;
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
