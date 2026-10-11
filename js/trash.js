// ═══════════════════════════════════════════════════════
// RECENTLY DELETED — a safety net behind every delete.
// Deleting a character, preset, library lorebook, entry or journal page (or
// clearing a lorebook) first copies it here. The delete toast offers Undo, and
// Settings > Storage lists the rest so they can be restored later.
// Each module registers how to put its own kind back (registerTrashRestorer),
// so this file imports nothing from the editors.
// ═══════════════════════════════════════════════════════
import { safeSet } from './storage.js';
import { toast } from './util.js';
import { store } from './kv.js';

export const TRASH_KEY = 'aet_trash';
export const TRASH_MAX_ITEMS = 20;
export const TRASH_MAX_BYTES = 1500000; // ~1.5 MB of the 5 MB budget, oldest dropped first

const restorers = {};
export function registerTrashRestorer(kind, fn) { restorers[kind] = fn; }

export function trashAll() {
  try {
    const v = JSON.parse(store.get(TRASH_KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && x.id && x.kind) : [];
  } catch (e) { return []; }
}

function trashSave(list) {
  // Keep it small: newest first, capped by count and by size
  let out = list.slice(0, TRASH_MAX_ITEMS);
  let json = JSON.stringify(out);
  while (json.length > TRASH_MAX_BYTES && out.length > 1) { out = out.slice(0, -1); json = JSON.stringify(out); }
  return safeSet(TRASH_KEY, json);
}

// Copy `data` into the trash. Returns the trash id (or null if it could not be kept).
// With `undo`, the delete toast gets an Undo button.
export function trashPush(kind, label, data, { undo = true, message = null } = {}) {
  let copy;
  try { copy = JSON.parse(JSON.stringify(data)); } catch (e) { return null; }
  // A huge avatar must not push everything else out
  if (copy && copy.imageData && copy.imageData.length > 800000) copy.imageData = null;
  const id = 't' + Date.now() + Math.floor(Math.random() * 1000);
  const ok = trashSave([{ id, kind, label: label || kind, at: new Date().toISOString(), data: copy }, ...trashAll()]);
  if (!ok) return null;
  if (undo) toast(message || ('Deleted "' + (label || kind) + '".'), 'info', { action: { label: 'Undo', fn: () => trashRestore(id) }, ms: 8000 });
  return id;
}

export function trashRestore(id) {
  const list = trashAll();
  const item = list.find(x => x.id === id);
  if (!item) { toast('That item is no longer in Recently deleted.', 'warn'); return false; }
  const fn = restorers[item.kind];
  if (!fn) { toast("Can't restore this kind of item here.", 'warn'); return false; }
  try { fn(item.data, item); } catch (e) { console.error('[LoreOS] restore failed', e); toast('Restore failed: ' + e.message, 'err'); return false; }
  trashSave(list.filter(x => x.id !== id));
  toast('Restored "' + item.label + '".', 'ok');
  return true;
}

export function trashDiscard(id) { return trashSave(trashAll().filter(x => x.id !== id)); }
export function trashClear() { try { store.remove(TRASH_KEY); } catch (e) {} }

const KIND_LABEL = { char: 'Character', preset: 'Preset', lorelib: 'Lorebook', entry: 'Entry', entries: 'Cleared entries', journal: 'Journal page' };
export function trashKindLabel(k) { return KIND_LABEL[k] || k; }
