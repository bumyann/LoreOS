// ═══════════════════════════════════════════════════════
// LARGE-DATA STORE
// Browsers give localStorage only ~5 MB per site, and an iPad or phone hits that
// quickly (avatars, libraries, version history). The big keys therefore live in
// IndexedDB, which allows far more, behind a synchronous in-memory copy, so the
// rest of the app keeps reading and writing them exactly as before:
//
//   store.get(key) / store.set(key, value) / store.remove(key)
//
// Reads come from memory. Writes update memory at once and are saved to
// IndexedDB right behind (batched, one transaction). The small keys (theme,
// settings, flags) stay in localStorage so they are available instantly.
//
// Safety net
//  - Nothing is removed from localStorage until IndexedDB has confirmed the write.
//  - If IndexedDB is not available at all (some private modes), everything keeps
//    using localStorage, as before.
//  - Other open tabs are told about every save so they don't overwrite it.
// ═══════════════════════════════════════════════════════
import { toast } from './util.js';

export const KV_DB_NAME = 'loreos';
export const KV_STORE = 'kv';

// Keys that can get big. Everything else stays in localStorage.
export const BIG_KEYS = [
  'aet_lorebook', 'aet_library', 'aet_charLibrary', 'aet_presetLibrary',
  'aet_tpl_lore', 'aet_tpl_char', 'aet_tpl_preset',
  'aet_promptLibrary', 'aet_regexLibrary', 'aet_personaLibrary', 'aet_meta', 'aet_home', 'aet_gallery', 'aet_stamps', 'aet_logo_custom',
  'loreos_notebook', 'aet_backup_history', 'aet_trash', 'aet_fonts', // aet_fonts = uploaded font files
];
const BIG = new Set(BIG_KEYS);
export const isBigKey = k => typeof k === 'string' && (BIG.has(k) || k.startsWith('aet_corrupt_') || k.startsWith('aet_img_'));

let mode = 'ls';            // 'idb' once IndexedDB is open and loaded, else 'ls' (plain localStorage)
let db = null;
const mem = new Map();      // the in-memory copy of every big key (mode 'idb')
const pending = new Map();  // key -> string to save, or null to delete
let flushing = null;
let flushTimer = false;
let errorShown = false;
let chan = null;

export const kvMode = () => mode;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) { reject(new Error('IndexedDB is not available')); return; }
    let req;
    try { req = indexedDB.open(KV_DB_NAME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore(KV_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('could not open IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
}

// Mobile Safari can close an idle database connection (after the app was in the background).
// Note it, and reopen on the next save instead of failing.
function watchDb(database) {
  database.onclose = () => { if (db === database) db = null; };
  database.onversionchange = () => { try { database.close(); } catch (e) {} if (db === database) db = null; };
}
async function ensureDb() {
  if (db) return db;
  db = await openDb();
  watchDb(db);
  return db;
}

function loadAll(database) {
  return new Promise((resolve, reject) => {
    const out = new Map();
    const t = database.transaction(KV_STORE, 'readonly');
    const req = t.objectStore(KV_STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out.set(c.key, c.value); c.continue(); }
    };
    t.oncomplete = () => resolve(out);
    t.onerror = t.onabort = () => reject(t.error || new Error('could not read IndexedDB'));
  });
}

// Open the store, load everything into memory, and move any big keys still sitting
// in localStorage across. Always resolves; on any problem the app just keeps using
// localStorage.
export async function kvInit() {
  // Escape hatch (also used by the tests for the plain-localStorage path): set aet_kv_off to 1
  try { if (localStorage.getItem('aet_kv_off') === '1') { mode = 'ls'; return mode; } } catch (e) {}
  try {
    db = await openDb();
    watchDb(db);
    const rows = await loadAll(db);
    rows.forEach((v, k) => { if (typeof v === 'string') mem.set(k, v); });

    // Move over big keys that are still in localStorage (first run after the update,
    // a backup restored by an older version, ...)
    const lsKeys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isBigKey(k)) lsKeys.push(k); }
    lsKeys.forEach(k => {
      const lsVal = localStorage.getItem(k);
      if (lsVal === null) return;
      if (!mem.has(k)) { mem.set(k, lsVal); pending.set(k, lsVal); return; }
      if (mem.get(k) !== lsVal) {
        // Both exist and differ (an older tab wrote after the move). Keep the IndexedDB
        // copy as the live one and keep the other beside it so nothing is lost.
        const side = 'aet_corrupt_' + k + '_older';
        mem.set(side, lsVal); pending.set(side, lsVal);
      }
      pending.set(k, mem.get(k)); // same value again: its success removes the localStorage copy
    });

    mode = 'idb';
    setupChannel();
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') kvFlush(); });
    window.addEventListener('pagehide', () => { kvFlush(); });
    await kvFlush(); // the move above; failures are retried on the next save and the localStorage copy is kept
  } catch (e) {
    console.warn('[LoreOS] large-data store unavailable, using localStorage:', e);
    mode = 'ls';
    db = null;
    mem.clear(); pending.clear();
  }
  return mode;
}

function setupChannel() {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    chan = new BroadcastChannel('loreos-kv');
    chan.onmessage = ev => {
      const m = ev.data;
      if (!m || typeof m.k !== 'string' || !isBigKey(m.k)) return;
      if (m.v === null) mem.delete(m.k); else if (typeof m.v === 'string') mem.set(m.k, m.v);
    };
  } catch (e) { chan = null; }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = true;
  Promise.resolve().then(() => { flushTimer = false; kvFlush(); });
}

function reportWriteError(err) {
  console.error('[LoreOS] could not save to the large-data store:', err);
  if (errorShown) return;
  errorShown = true;
  setTimeout(() => { errorShown = false; }, 8000);
  toast('Could not save your latest changes to browser storage. Export a backup to be safe.', 'err');
}

// Save everything queued. Resolves true when it is safely stored (or nothing was queued).
export function kvFlush() {
  if (mode !== 'idb') return Promise.resolve(true);
  if (flushing) return flushing.then(() => kvFlush());
  if (!pending.size) return Promise.resolve(true);
  const batch = new Map(pending);
  pending.clear();
  const requeue = () => batch.forEach((v, k) => { if (!pending.has(k)) pending.set(k, v); });
  const writeOnce = () => new Promise((resolve, reject) => {
    ensureDb().then(database => {
      let t;
      try {
        t = database.transaction(KV_STORE, 'readwrite');
        const s = t.objectStore(KV_STORE);
        batch.forEach((v, k) => { if (v === null) s.delete(k); else s.put(v, k); });
      } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve();
      t.onerror = t.onabort = () => reject(t.error || new Error('write aborted'));
    }, reject);
  });
  flushing = writeOnce()
    .catch(err => {
      // A closed connection: drop it, reopen, and try once more
      if (err && err.name === 'InvalidStateError') { db = null; return writeOnce(); }
      throw err;
    })
    .then(() => {
      batch.forEach((v, k) => {
        try { localStorage.removeItem(k); } catch (e) {} // confirmed in IndexedDB: the old localStorage copy can go
        if (chan) { try { chan.postMessage({ k, v }); } catch (e) {} }
      });
      return true;
    }, err => { requeue(); reportWriteError(err); return false; })
    .finally(() => { flushing = null; });
  return flushing;
}

export const store = {
  get(k) {
    if (mode === 'idb' && isBigKey(k)) return mem.has(k) ? mem.get(k) : null;
    return localStorage.getItem(k);
  },
  // Throws on a full localStorage (plain keys, or any key in fallback mode), like localStorage does.
  set(k, v) {
    v = String(v);
    if (mode === 'idb' && isBigKey(k)) { mem.set(k, v); pending.set(k, v); scheduleFlush(); return; }
    localStorage.setItem(k, v);
  },
  remove(k) {
    if (mode === 'idb' && isBigKey(k)) {
      mem.delete(k); pending.set(k, null); scheduleFlush();
      try { localStorage.removeItem(k); } catch (e) {}
      return;
    }
    localStorage.removeItem(k);
  },
  // [key, length] for everything stored, from both places
  entries() {
    const out = new Map();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (mode === 'idb' && isBigKey(k)) continue; // an unconfirmed leftover; the memory copy counts
      out.set(k, { bytes: (localStorage.getItem(k) || '').length, where: 'local' });
    }
    mem.forEach((v, k) => out.set(k, { bytes: v.length, where: 'large' }));
    return out;
  },
  keys() { return [...store.entries().keys()]; },
};
