// ═══════════════════════════════════════════════════════
// STORAGE — everything that reads or writes localStorage: the safe writer, the
// saved lorebook / character / preset libraries, and the lorebook <-> library link.
// ═══════════════════════════════════════════════════════

import { migrateCharacterBook } from './attach_lb.js';
import { itemHistoryPush } from './history.js';
import { applyZoom, renderEditor, renderList, renderTabs } from './lorebook.js';
import { rebuildEntries } from './lorebook_model.js';
import { state } from './state.js';
import { syncAutoPush } from './sync.js';
import { g, toast } from './util.js';
import { renderWsTabs } from './workshop.js';

// ═══════════════════════════════════════════════════════
// STORAGE SAFETY LAYER
// Every write to localStorage goes through safeSet(). If the
// browser refuses the write (quota full), we say so out loud
// instead of swallowing it — a save that fails silently is
// worse than one that crashes, because the user keeps working
// on data that isn't being kept.
// ═══════════════════════════════════════════════════════

export let _quotaWarned = false;

export function isQuotaError(e) {
  return e && (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 || e.code === 1014
  );
}

// Returns true on success, false on failure. Never throws.
export function safeSet(key, value) {
  if (state.restoringBackup) return false; // a restore is in progress: nothing may overwrite it
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    if (isQuotaError(e)) {
      console.error('[LoreOS] storage full writing', key, e);
      if (!_quotaWarned) {
        _quotaWarned = true;
        setTimeout(() => { _quotaWarned = false; }, 6000);
        toast('Storage full — that did NOT save. Open Settings → Storage to free space.', 'err');
      }
    } else {
      console.error('[LoreOS] storage write failed for', key, e);
      toast('Could not save: ' + e.message, 'err');
    }
    return false;
  }
}

// Approximate bytes used across all of localStorage for this origin.
export function storageUsage() {
  const rows = [];
  let total = 0;
  for (const k in localStorage) {
    if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
    const bytes = (localStorage[k] || '').length;
    total += bytes;
    rows.push({ key: k, bytes });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  return { rows, total, limit: 5 * 1024 * 1024 };
}

// ── LZ helpers ──
// LZString.compress() emits raw UTF-16 including unpaired surrogates,
// which can be mangled on the way into localStorage. compressToUTF16()
// is the storage-safe variant. Unpack falls back to the old format so
// any snapshot written by an earlier build still opens.
export function lzPack(obj) {
  return LZString.compressToUTF16(JSON.stringify(obj));
}
export function lzUnpack(str) {
  let json = null;
  try { json = LZString.decompressFromUTF16(str); } catch(e) {}
  if (!json) { try { json = LZString.decompress(str); } catch(e) {} }
  if (!json) throw new Error('snapshot unreadable');
  return JSON.parse(json);
}

export function loadPrefs() {
  if (localStorage.getItem('aet_theme') === 'pink') document.body.classList.add('pink');
  const z = localStorage.getItem('aet_zoom');
  if (z !== null) { state.zoomLevel = parseInt(z); applyZoom(); }
}

// Read one key, parse it, and never let a failure here stop the
// next one. A mangled lorebook used to take the character library,
// the preset library and the workshop tabs down with it.
export function loadPart(name, fn) {
  try { fn(); }
  catch(e) {
    console.error(`[LoreOS] could not load ${name}:`, e);
    setTimeout(() => {
      toast(`Couldn't load your ${name} — it may be corrupted.`, 'err');
    }, 500);
  }
}

export function loadFromStorage() {
  loadPart('lorebook', () => {
    const lb = localStorage.getItem('aet_lorebook');
    if (!lb) return;
    state.lorebook = JSON.parse(lb);
    g('lorebookName').value = state.lorebook.name || '';
    state.lorebook.entries = rebuildEntries(state.lorebook.entries || {});
    // Re-link to the library entry it came from, if that still exists
    const linked = localStorage.getItem('aet_lorebookLibName');
    if (linked) {
      const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
      if (lib[linked]) loreLinkToLib(linked); else loreLinkToLib(null);
    }
  });

  loadPart('open tabs', () => {
    const tabs = localStorage.getItem('aet_tabs');
    if (tabs) state.openTabs = JSON.parse(tabs);
    const atab = localStorage.getItem('aet_activeTab');
    if (atab && atab !== 'null') state.activeTabId = parseInt(atab);
    const nu = localStorage.getItem('aet_nextUid');
    if (nu) state.nextUid = parseInt(nu);
  });

  loadPart('character library', () => {
    state.charLibrary = JSON.parse(localStorage.getItem('aet_charLibrary') || '{}');
    // Cards with an attached lorebook saved before the character_book fix hold
    // an object-shaped book that SillyTavern can't import; convert them once
    let migrated = false;
    Object.values(state.charLibrary).forEach(e => {
      try { if (e && e.card && migrateCharacterBook(e.card)) migrated = true; } catch (err) {}
    });
    if (migrated) safeSet('aet_charLibrary', JSON.stringify(state.charLibrary));
  });

  loadPart('preset library', () => {
    state.presetLibrary = JSON.parse(localStorage.getItem('aet_presetLibrary') || '{}');
  });

  loadPart('workshop tabs', renderWsTabs);

  loadPart('editor', () => {
    if (Object.keys(state.lorebook.entries || {}).length > 0) {
      renderList(); renderTabs();
      if (state.activeTabId !== null) renderEditor();
    }
  });
}

// ── Live lorebook <-> library link ──
// The editor works on `lorebook` (aet_lorebook), but workshop tabs, version
// history and checkpoints all read the library copy (aet_library). Nothing
// kept the two in sync, so entry edits never reached the library: snapshots
// captured the stale copy, and switching workshop tabs reloaded it over your
// edits. When the open lorebook came from the library, every save now writes
// through to its library entry.
// Tracked by object identity, so any import / clear that replaces `lorebook`
// with a new object automatically unlinks it and can't overwrite the entry.
export let loreLibName = null;
export let loreLibRef = null;

export function loreLinkToLib(name) {
  loreLibName = name || null;
  loreLibRef = name ? state.lorebook : null;
  if (state.restoringBackup) return;
  try { localStorage.setItem('aet_lorebookLibName', name || ''); } catch (e) {}
}

export function loreActiveLibName() {
  return (loreLibName && loreLibRef === state.lorebook) ? loreLibName : null;
}

export function loreSyncToLib() {
  // `lorebook` was replaced (import, clear, etc.): drop the stale link so a
  // reload can't re-attach the new content to the old library entry
  if (loreLibName && loreLibRef !== state.lorebook) loreLinkToLib(null);
  const name = loreActiveLibName();
  if (!name) return true;
  const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
  if (!lib[name]) { loreLinkToLib(null); return true; }
  const next = JSON.stringify(state.lorebook);
  if (JSON.stringify(lib[name].lb) === next) return true;
  lib[name].lb = JSON.parse(next);
  lib[name].savedAt = new Date().toISOString();
  return safeSet('aet_library', JSON.stringify(lib));
}

// Debounced lorebook snapshot: a burst of entry saves/deletes becomes one
// snapshot instead of burning through all 10 slots.
export let loreSnapTimer = null;
export function loreSnapshotSoon() {
  if (!loreActiveLibName()) return;
  clearTimeout(loreSnapTimer);
  loreSnapTimer = setTimeout(loreSnapshotNow, 2000);
}
// Drop a pending lorebook snapshot (a restore is about to replace the data)
export function cancelLoreSnapshot() { clearTimeout(loreSnapTimer); loreSnapTimer = null; }

export function loreSnapshotNow() {
  clearTimeout(loreSnapTimer); loreSnapTimer = null;
  if (state.restoringBackup) return;
  const name = loreActiveLibName();
  if (!name) return;
  loreSyncToLib();
  const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
  if (lib[name]) itemHistoryPush('lore', name, lib[name]);
}
window.addEventListener('pagehide', () => { if (loreSnapTimer) loreSnapshotNow(); });

export function saveToStorage() {
  loreSyncToLib();
  const ok =
    safeSet('aet_lorebook', JSON.stringify(state.lorebook)) &&
    safeSet('aet_tabs', JSON.stringify(state.openTabs)) &&
    safeSet('aet_activeTab', String(state.activeTabId)) &&
    safeSet('aet_nextUid', String(state.nextUid));
  if (ok) syncAutoPush();
  return ok;
}

export function saveCharLibrary() {
  const ok = safeSet('aet_charLibrary', JSON.stringify(state.charLibrary));
  if (ok) syncAutoPush();
  return ok;
}

export function savePresetLibrary() {
  const ok = safeSet('aet_presetLibrary', JSON.stringify(state.presetLibrary));
  if (ok) syncAutoPush();
  return ok;
}

// ═══════════════════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════════════════
export function libGet() { try { return JSON.parse(localStorage.getItem('aet_library') || '{}'); } catch(e) { return {}; } }
export function libSet(d) {
  const ok = safeSet('aet_library', JSON.stringify(d));
  if (ok) syncAutoPush(); // library edits should reach Drive too
  return ok;
}
