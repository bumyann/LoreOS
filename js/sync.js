// ═══════════════════════════════════════════════════════
// SYNC — Manual backup/restore + backup history
// ═══════════════════════════════════════════════════════

import { openCharLibrary } from './character.js';
import { cancelDrivePush, gdriveAutoPush, wireGdrive } from './gdrive.js';
import { openLibrary } from './library.js';
import { openPresetLibrary } from './preset.js';
import { kvFlush, kvMode, store } from './kv.js';
import { cancelJournalAutosave } from './journal.js';
import { state } from './state.js';
import { cancelLoreSnapshot, isQuotaError, safeSet, storageUsage } from './storage.js';
import { renderTemplateList } from './templates.js';
import { closeModal, dlFile, g, openModal, registerMarkup, toast } from './util.js';
import { cancelAutosave, renderWsTabs } from './workshop.js';

export const SYNC_KEYS = [
  'aet_lorebook','aet_tabs','aet_activeTab','aet_nextUid',
  'aet_charLibrary','aet_presetLibrary','aet_promptLibrary','aet_regexLibrary','aet_personaLibrary','aet_meta','aet_home',
  'aet_library',
  'aet_tpl_lore','aet_tpl_char','aet_tpl_preset',
  'aet_theme','aet_zoom','aet_css','aet_css_light',
  'aet_title_main','aet_title_sub',
  'aet_font_fp','aet_font_fx','aet_font_fb',
  'aet_theme_slots','aet_logo','aet_logo_custom',
  'loreos_notebook',
];

// Human-readable module labels for the import checklist
export const SYNC_MODULES = [
  { key: 'lorebook',   label: 'Active Lorebook',    keys: ['aet_lorebook','aet_tabs','aet_activeTab','aet_nextUid'] },
  { key: 'lorelib',   label: 'Lorebook Library',    keys: ['aet_library'] },
  { key: 'chars',     label: 'Character Library',   keys: ['aet_charLibrary'] },
  { key: 'presets',   label: 'Preset Library',      keys: ['aet_presetLibrary'] },
  { key: 'prompts',   label: 'Prompt Packs',        keys: ['aet_promptLibrary'] },
  { key: 'regex',     label: 'Regex Sets',          keys: ['aet_regexLibrary'] },
  { key: 'personas',  label: 'Personas',            keys: ['aet_personaLibrary'] },
  { key: 'home',      label: 'Home board',          keys: ['aet_home'] },
  { key: 'meta',      label: 'Library organisation (worlds, tags, pins)', keys: ['aet_meta'] },
  { key: 'tpl_lore',  label: 'Lorebook Templates',  keys: ['aet_tpl_lore'] },
  { key: 'tpl_char',  label: 'Character Templates', keys: ['aet_tpl_char'] },
  { key: 'tpl_preset',label: 'Prompt Library',      keys: ['aet_tpl_preset'] },
  { key: 'settings',  label: 'Settings & Theme',    keys: ['aet_theme','aet_zoom','aet_css','aet_css_light','aet_title_main','aet_title_sub','aet_font_fp','aet_font_fx','aet_font_fb','aet_theme_slots','aet_logo','aet_logo_custom'] },
  { key: 'journal',   label: 'Journal',             keys: ['loreos_notebook'] },
];

// Selective library module map (used by per-library export/import)
export const LIB_MODULES = {
  lore:   { label: 'Lorebook Library',    key: 'aet_library',      storageKey: 'aet_library' },
  char:   { label: 'Character Library',   key: 'aet_charLibrary',  storageKey: 'aet_charLibrary' },
  preset: { label: 'Preset Library',      key: 'aet_presetLibrary',storageKey: 'aet_presetLibrary' },
  tpl_lore:   { label: 'Lorebook Templates',  key: 'aet_tpl_lore',     storageKey: 'aet_tpl_lore' },
  tpl_char:   { label: 'Character Templates', key: 'aet_tpl_char',     storageKey: 'aet_tpl_char' },
  tpl_preset: { label: 'Prompt Library',      key: 'aet_tpl_preset',   storageKey: 'aet_tpl_preset' },
};

export const HISTORY_KEY = 'aet_backup_history';
export const MAX_HISTORY = 10;
export const NOTICE_KEY = 'aet_post_restore_notice';
const fmtMB = n => (n / 1048576).toFixed(1) + ' MB';
// The snapshots together may use at most this much. In plain localStorage that is a slice of the ~5 MB cap;
// in the large-data store there is plenty of room.
export const HISTORY_MAX_CHARS = 1000000;
export const historyBudget = () => (kvMode() === 'idb' ? 20000000 : HISTORY_MAX_CHARS);

// ── pending import bundle (set before opening checklist modal) ──
export let _pendingImport = null;

// ═══════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════
export function syncSetStatus(msg, type = 'info') {
  const el = g('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status ' + type;
}

// ═══════════════════════════════════════════════════════
// BUNDLE
// ═══════════════════════════════════════════════════════
export function syncBundleData() {
  const bundle = { _version: '1', _synced_at: new Date().toISOString() };
  SYNC_KEYS.forEach(k => {
    const v = store.get(k);
    if (v !== null) bundle[k] = v;
  });
  return bundle;
}

export function syncRestoreKeys(bundle, keys) {
  keys.forEach(k => {
    // A key the backup doesn't have means "it didn't exist then": clear it, so a
    // restored module never mixes with leftovers from this device
    if (bundle[k] !== undefined) store.set(k, bundle[k]);
    else store.remove(k);
  });
}

// ═══════════════════════════════════════════════════════
// BACKUP HISTORY (LZ-string compressed, rolling 10)
// ═══════════════════════════════════════════════════════
export function historyGet() {
  try {
    const raw = store.get(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch(e) { return []; }
}

export function historySave() {
  const bundle = syncBundleData();
  const snapshot = {
    ts: bundle._synced_at,
    data: LZString.compress(JSON.stringify(bundle)),
  };
  const history = historyGet();
  history.unshift(snapshot);
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  // Every snapshot is a full copy of the workspace, so ten of them used to eat
  // most of a phone or iPad's 5 MB and made restores fail. Keep them under a budget.
  while (history.length && JSON.stringify(history).length > historyBudget()) history.pop();
  if (!history.length) return; // even one snapshot is too big for the budget: skip it, the data itself is safe
  try {
    store.set(HISTORY_KEY, JSON.stringify(history));
  } catch(e) {
    // localStorage full: keep only the newest and retry
    history.splice(1);
    try { store.set(HISTORY_KEY, JSON.stringify(history)); } catch(e2) {}
  }
}

export function historyDecompress(snapshot) {
  const json = LZString.decompress(snapshot.data);
  return JSON.parse(json);
}

// ═══════════════════════════════════════════════════════
// EXPORT (bulk)
// ═══════════════════════════════════════════════════════
export function syncExport() {
  historySave();
  const bundle = syncBundleData();
  const json = JSON.stringify(bundle, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  dlFile(json, `LoreOS-backup-${date}.json`, 'application/json');
  const kb = (new Blob([json]).size / 1024).toFixed(1);
  syncSetStatus(`Exported backup (${kb}KB) ✓`, 'ok');
}

// ═══════════════════════════════════════════════════════
// IMPORT (bulk) — opens checklist modal
// ═══════════════════════════════════════════════════════
export function syncImportFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const bundle = JSON.parse(ev.target.result);
      if (!bundle._version) throw new Error('Not a valid LoreOS backup.');
      openImportModal(bundle, 'Import Backup');
    } catch(e) {
      syncSetStatus('Import error: ' + e.message, 'err');
    }
  };
  r.readAsText(file);
}

export function openImportModal(bundle, title = 'Import Backup') {
  _pendingImport = bundle;
  g('syncImportTitle').textContent = '' + title;
  const ts = bundle._synced_at ? new Date(bundle._synced_at).toLocaleString() : 'unknown';
  g('syncImportMeta').textContent = `From: ${ts}`;

  const checks = g('syncImportChecks');
  checks.innerHTML = '';
  SYNC_MODULES.forEach(mod => {
    // Only show module if bundle has at least one of its keys
    const hasData = mod.keys.some(k => bundle[k] !== undefined);
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:.5rem;cursor:pointer;font-family:var(--fx);font-size:.75rem;color:var(--txd)';
    row.innerHTML = `<input type="checkbox" data-mod="${mod.key}" ${hasData ? 'checked' : 'disabled'} style="accent-color:var(--p)">
      ${mod.label}${!hasData ? ' <span style="color:var(--txm);font-size:.65rem">(not in backup)</span>' : ''}`;
    checks.append(row);
  });

  openModal('syncImportModal');
}

export async function syncImportConfirm() {
  if (!_pendingImport) return;
  const bundle = _pendingImport;
  const checks = g('syncImportChecks').querySelectorAll('input[type=checkbox]:checked');
  const selectedKeys = [];
  checks.forEach(cb => {
    const mod = SYNC_MODULES.find(m => m.key === cb.dataset.mod);
    if (mod) selectedKeys.push(...mod.keys);
  });
  if (!selectedKeys.length) { toast('Nothing selected.', 'warn'); return; }

  // Freeze every editor write path first: pagehide / autosave / snapshot timers
  // would otherwise write the old in-memory data back over what we restore
  state.restoringBackup = true;
  cancelAutosave(); cancelLoreSnapshot(); cancelJournalAutosave(); cancelDrivePush();

  // Restore all-or-nothing: if the browser refuses part way (storage full),
  // put every key back as it was instead of leaving a half-restored mix
  const previous = {};
  selectedKeys.forEach(k => { previous[k] = store.get(k); });
  const rollback = () => selectedKeys.forEach(k => {
    try { previous[k] === null ? store.remove(k) : store.set(k, previous[k]); } catch (e2) {}
  });
  const attempt = async () => {
    try { syncRestoreKeys(bundle, selectedKeys); }
    catch (e) { rollback(); return e; }
    // Big keys are written to the large-data store in the background: wait until it is confirmed
    if (!(await kvFlush())) {
      rollback(); await kvFlush();
      const e = new Error('the browser refused to store the restored data'); e.name = 'QuotaExceededError'; return e;
    }
    return null;
  };
  let err = await attempt();
  // Storage full: free the things that can be rebuilt (deleted-items bin, old local
  // backup snapshots), a step at a time, trying again after each. The data being
  // restored lives on Drive / the backup file, so those copies are the cheap ones to give up.
  const freedSteps = [];
  if (err && isQuotaError(err)) {
    const steps = [
      ['recently deleted items', () => { store.remove('aet_trash'); store.keys().filter(k => k.startsWith('aet_corrupt_')).forEach(k => store.remove(k)); }],
      ['older local backup snapshots', () => { const h = historyGet(); if (h.length > 1) store.set(HISTORY_KEY, JSON.stringify(h.slice(0, 1))); }],
      ['local backup snapshots', () => store.remove(HISTORY_KEY)],
    ];
    for (const [label, run] of steps) {
      try { run(); } catch (e) {}
      freedSteps.push(label);
      err = await attempt();
      if (!err) break;
    }
  }
  if (err) {
    state.restoringBackup = false;
    console.error('[LoreOS] restore failed, rolled back:', err);
    if (isQuotaError(err)) {
      const { total, bigTotal } = storageUsage();
      const need = selectedKeys.reduce((n, k) => n + (bundle[k] === undefined ? 0 : String(bundle[k]).length) - (previous[k] ? previous[k].length : 0), 0);
      toast(`Not enough room on this device (about ${fmtMB(total + bigTotal)} stored, and this restore needs about ${fmtMB(need)} more). Nothing in your libraries was changed${freedSteps.length ? ' (LoreOS did clear ' + freedSteps.join(' and ') + ' while trying to make room)' : ''}. Try ticking fewer items (one library at a time), or free space in Settings > Storage.`, 'err');
    } else {
      toast('Restore failed: ' + (err.message || err) + ' Nothing was changed.', 'err');
    }
    return;
  }
  // The page reloads right after a restore, which would wipe a toast before it can be read.
  // Keep the note and show it (for longer) once the page is back.
  if (freedSteps.length) {
    try {
      localStorage.setItem(NOTICE_KEY, 'Restore done. This device is short on storage (about ' + fmtMB((u => u.total + u.bigTotal)(storageUsage())) + ' stored), so LoreOS cleared ' +
        freedSteps.join(' and ') + ' to make room. Your restored data is intact. Settings > Storage shows what is using the space.');
    } catch (e) {}
  }
  // Importing from Drive: this device is now in step with that Drive version
  if (bundle._gdriveVersion !== undefined && bundle._gdriveVersion !== null) {
    try {
      localStorage.setItem('aet_gdrive_base', String(bundle._gdriveVersion));
      localStorage.removeItem('aet_gdrive_dirty');
    } catch (e) {}
  } else {
    // Imported from a file or a local snapshot: this device now differs from Drive
    try { localStorage.setItem('aet_gdrive_dirty', '1'); } catch (e) {}
  }
  historySave();
  await kvFlush(); // everything must be on disk before the page reloads
  closeModal('syncImportModal');
  syncSetStatus('Imported ✓ — reloading...', 'ok');
  setTimeout(() => location.reload(), 900);
}

// ═══════════════════════════════════════════════════════
// BACKUP HISTORY MODAL
// ═══════════════════════════════════════════════════════
export function openSyncHistory() {
  const list = g('syncHistoryList');
  list.innerHTML = '';
  const history = historyGet();

  if (!history.length) {
    list.innerHTML = '<div class="lib-empty">// no snapshots yet — export a backup to create one</div>';
    openModal('syncHistoryModal');
    return;
  }

  history.forEach((snap, i) => {
    const ts = new Date(snap.ts).toLocaleString();
    const item = document.createElement('div');
    item.className = 'lib-item';
    item.innerHTML = `
      <span class="lib-name" style="font-size:.78rem">${ts}</span>
      <span class="lib-meta">${i === 0 ? 'most recent' : `${i + 1} snapshots ago`}</span>
      <div class="lib-acts">
        <button class="btn btn-p btn-sm snap-restore">Restore</button>
        <button class="btn btn-s btn-sm snap-export">Export</button>
      </div>`;
    item.querySelector('.snap-restore').addEventListener('click', () => {
      try {
        const bundle = historyDecompress(snap);
        closeModal('syncHistoryModal');
        openImportModal(bundle, `Restore Snapshot — ${ts}`);
      } catch(e) { toast('Snapshot corrupted.', 'err'); }
    });
    item.querySelector('.snap-export').addEventListener('click', () => {
      try {
        const bundle = historyDecompress(snap);
        const json = JSON.stringify(bundle, null, 2);
        const date = snap.ts.slice(0, 10);
        dlFile(json, `LoreOS-snapshot-${date}.json`, 'application/json');
      } catch(e) { toast('Snapshot corrupted.', 'err'); }
    });
    list.append(item);
  });

  openModal('syncHistoryModal');
}

// ═══════════════════════════════════════════════════════
// SELECTIVE LIBRARY EXPORT / IMPORT
// ═══════════════════════════════════════════════════════
export function libExportSelective(type) {
  const mod = LIB_MODULES[type];
  if (!mod) return;
  const raw = store.get(mod.storageKey);
  if (!raw || raw === '{}') { toast('Nothing to export.', 'warn'); return; }
  const bundle = {
    _version: '1',
    _type: type,
    _label: mod.label,
    _exported_at: new Date().toISOString(),
    [mod.storageKey]: raw,
  };
  const json = JSON.stringify(bundle, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  dlFile(json, `LoreOS-${type}-${date}.json`, 'application/json');
  toast(`Exported ${mod.label} ✓`, 'ok');
}

export function libImportSelective(file, type, onDone) {
  if (!file) return;
  const mod = LIB_MODULES[type];
  if (!mod) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const bundle = JSON.parse(ev.target.result);
      if (!bundle._version) throw new Error('Not a valid LoreOS export.');
      if (!bundle[mod.storageKey]) throw new Error(`No ${mod.label} data found in this file.`);
      // Merge into existing (don't wipe, combine)
      const existing = JSON.parse(store.get(mod.storageKey) || '{}');
      const incoming = JSON.parse(bundle[mod.storageKey]);
      const merged = { ...existing, ...incoming };
      // Through safeSet so a full disk is reported, not swallowed as "Import error"
      if (!safeSet(mod.storageKey, JSON.stringify(merged))) return;
      // The editors work on in-memory copies and write them back on every save,
      // so refresh them or the next save would wipe what was just imported
      if (type === 'char') state.charLibrary = merged;
      else if (type === 'preset') state.presetLibrary = merged;
      renderWsTabs();
      syncAutoPush();
      toast(`Imported ${mod.label} ✓ (${Object.keys(incoming).length} items)`, 'ok');
      if (onDone) onDone();
    } catch(e) {
      toast('Import error: ' + e.message, 'err');
    }
  };
  r.readAsText(file);
}

// ═══════════════════════════════════════════════════════
// AUTO-PUSH — triggers GDrive debounced push on any save
// ═══════════════════════════════════════════════════════
export function syncAutoPush() {
  // Remember there are edits Drive hasn't seen, even while disconnected or
  // offline. gdrive.js uses this to tell "I changed things" from "someone
  // else did" before it ever overwrites anything.
  try { if (localStorage.getItem('aet_gdrive_dirty') !== '1') localStorage.setItem('aet_gdrive_dirty', '1'); } catch (e) {}
  gdriveAutoPush();
}

// Does this device hold anything worth protecting from a Drive overwrite?
// An empty fresh install doesn't, so it can pull straight away.
export function syncLocalHasData() {
  const nonEmptyObj = k => {
    try { const v = JSON.parse(store.get(k) || '{}'); return !!v && Object.keys(v).length > 0; }
    catch (e) { return false; }
  };
  if (['aet_library', 'aet_charLibrary', 'aet_presetLibrary', 'aet_tpl_lore', 'aet_tpl_char', 'aet_tpl_preset'].some(nonEmptyObj)) return true;
  try {
    const lb = JSON.parse(store.get('aet_lorebook') || 'null');
    if (lb && lb.entries && Object.keys(lb.entries).length > 0) return true;
  } catch (e) {}
  return (store.get('loreos_notebook') || '').length > 2;
}

// ═══════════════════════════════════════════════════════
// WIRE
// ═══════════════════════════════════════════════════════
export function wireSync() {
  // Bulk export
  g('syncExportBtn')?.addEventListener('click', syncExport);

  // Bulk import
  g('syncImportBtn')?.addEventListener('click', () => g('syncImportFile').click());

  g('syncImportFile')?.addEventListener('change', e => {
    syncImportFile(e.target.files[0]);
    e.target.value = '';
  });

  // History
  g('syncHistoryBtn')?.addEventListener('click', openSyncHistory);

  // Import checklist modal
  g('syncImportConfirmBtn')?.addEventListener('click', syncImportConfirm);
  g('syncImportCheckAll')?.addEventListener('click', () => {
    g('syncImportChecks').querySelectorAll('input:not(:disabled)').forEach(cb => cb.checked = true);
  });
  g('syncImportCheckNone')?.addEventListener('click', () => {
    g('syncImportChecks').querySelectorAll('input:not(:disabled)').forEach(cb => cb.checked = false);
  });

  // Selective lib export/import
  g('libExportSelBtn')?.addEventListener('click', () => {
    libExportSelective(currentLibMode());
  });
  g('libImportSelBtn')?.addEventListener('click', () => g('libImportSelFile').click());
  g('libImportSelFile')?.addEventListener('change', e => {
    const type = currentLibMode();
    libImportSelective(e.target.files[0], type, () => {
      if (type === 'char') openCharLibrary();
      else if (type === 'preset') openPresetLibrary();
      else openLibrary();
    });
    e.target.value = '';
  });

  // Template selective export/import
  g('tplExportSelBtn')?.addEventListener('click', () => {
    const type = currentTplMode();
    libExportSelective(type);
  });
  g('tplImportSelBtn')?.addEventListener('click', () => g('tplImportSelFile').click());
  g('tplImportSelFile')?.addEventListener('change', e => {
    const type = currentTplMode();
    libImportSelective(e.target.files[0], type, () => {
      renderTemplateList(type.replace('tpl_', ''));
    });
    e.target.value = '';
  });

  // Google Drive
  wireGdrive();
}

// Helper: figure out which library is currently open in the lib modal
export function currentLibMode() {
  const title = g('libModalTitle')?.textContent || '';
  if (title.includes('Character')) return 'char';
  if (title.includes('Preset')) return 'preset';
  if (title.includes('Lorebook')) return 'lore';
  return 'lore';
}

// Helper: figure out which template type is currently open in the tpl modal
export function currentTplMode() {
  const title = g('tplModalTitle')?.textContent || '';
  if (title.includes('Character')) return 'tpl_char';
  if (title.includes('Prompt')) return 'tpl_preset';
  return 'tpl_lore';
}

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(290, `<!-- BACKUP HISTORY MODAL -->
<div id="syncHistoryModal" class="modal">
  <div class="modal-box lg">
    <div class="modal-head"><h2>Backup History</h2><button class="modal-x" data-close="syncHistoryModal">×</button></div>
    <div class="modal-body">
      <div style="font-family:var(--fx);font-size:.68rem;color:var(--txm);margin-bottom:.6rem">
        Last 10 snapshots — saved on each export or import. Restore to roll back to any point.
      </div>
      <div id="syncHistoryList" class="lib-list"></div>
    </div>
  </div>
</div>`);

registerMarkup(300, `<!-- IMPORT CHECKLIST MODAL -->
<div id="syncImportModal" class="modal">
  <div class="modal-box" style="max-width:420px">
    <div class="modal-head"><h2 id="syncImportTitle">Import Backup</h2><button class="modal-x" data-close="syncImportModal">×</button></div>
    <div class="modal-body">
      <div style="font-family:var(--fx);font-size:.68rem;color:var(--txm);margin-bottom:.65rem" id="syncImportMeta"></div>
      <div style="font-family:var(--fx);font-size:.72rem;color:var(--txd);margin-bottom:.4rem">Select what to restore:</div>
      <div id="syncImportChecks" style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.75rem"></div>
      <div style="display:flex;gap:.4rem;margin-bottom:.5rem">
        <button class="btn btn-s btn-sm" id="syncImportCheckAll">All</button>
        <button class="btn btn-s btn-sm" id="syncImportCheckNone">None</button>
      </div>
      <div style="font-family:var(--fx);font-size:.65rem;color:var(--warn);margin-bottom:.75rem">
        ⚠ Selected data will overwrite what's currently in your browser. This cannot be undone.
      </div>
      <div class="modal-foot">
        <button class="btn btn-s" data-close="syncImportModal">Cancel</button>
        <button class="btn btn-ok" id="syncImportConfirmBtn">Restore</button>
      </div>
    </div>
  </div>
</div>`);


// Shown once after the reload that follows a restore
export function showPostRestoreNotice() {
  let msg = null;
  try { msg = localStorage.getItem(NOTICE_KEY); localStorage.removeItem(NOTICE_KEY); } catch (e) {}
  if (msg) toast(msg, 'info', { ms: 15000 });
}
