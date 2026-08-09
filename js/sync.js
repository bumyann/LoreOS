// ═══════════════════════════════════════════════════════
// SYNC — Manual backup/restore + backup history
// ═══════════════════════════════════════════════════════

const SYNC_KEYS = [
  'aet_lorebook','aet_tabs','aet_activeTab','aet_nextUid',
  'aet_charLibrary','aet_presetLibrary',
  'aet_library',
  'aet_tpl_lore','aet_tpl_char','aet_tpl_preset',
  'aet_theme','aet_zoom','aet_css','aet_css_light',
  'aet_title_main','aet_title_sub',
  'aet_font_fp','aet_font_fx','aet_font_fb',
  'aet_theme_slots',
  'loreos_notebook',
];

// Human-readable module labels for the import checklist
const SYNC_MODULES = [
  { key: 'lorebook',   label: 'Active Lorebook',    keys: ['aet_lorebook','aet_tabs','aet_activeTab','aet_nextUid'] },
  { key: 'lorelib',   label: 'Lorebook Library',    keys: ['aet_library'] },
  { key: 'chars',     label: 'Character Library',   keys: ['aet_charLibrary'] },
  { key: 'presets',   label: 'Preset Library',      keys: ['aet_presetLibrary'] },
  { key: 'tpl_lore',  label: 'Lorebook Templates',  keys: ['aet_tpl_lore'] },
  { key: 'tpl_char',  label: 'Character Templates', keys: ['aet_tpl_char'] },
  { key: 'tpl_preset',label: 'Prompt Library',      keys: ['aet_tpl_preset'] },
  { key: 'settings',  label: 'Settings & Theme',    keys: ['aet_theme','aet_zoom','aet_css','aet_css_light','aet_title_main','aet_title_sub','aet_font_fp','aet_font_fx','aet_font_fb','aet_theme_slots'] },
  { key: 'journal',   label: 'Journal',             keys: ['loreos_notebook'] },
];

// Selective library module map (used by per-library export/import)
const LIB_MODULES = {
  lore:   { label: 'Lorebook Library',    key: 'aet_library',      storageKey: 'aet_library' },
  char:   { label: 'Character Library',   key: 'aet_charLibrary',  storageKey: 'aet_charLibrary' },
  preset: { label: 'Preset Library',      key: 'aet_presetLibrary',storageKey: 'aet_presetLibrary' },
  tpl_lore:   { label: 'Lorebook Templates',  key: 'aet_tpl_lore',     storageKey: 'aet_tpl_lore' },
  tpl_char:   { label: 'Character Templates', key: 'aet_tpl_char',     storageKey: 'aet_tpl_char' },
  tpl_preset: { label: 'Prompt Library',      key: 'aet_tpl_preset',   storageKey: 'aet_tpl_preset' },
};

const HISTORY_KEY = 'aet_backup_history';
const MAX_HISTORY = 10;

// ── pending import bundle (set before opening checklist modal) ──
let _pendingImport = null;

// ═══════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════
function syncSetStatus(msg, type = 'info') {
  const el = g('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status ' + type;
}

// ═══════════════════════════════════════════════════════
// BUNDLE
// ═══════════════════════════════════════════════════════
function syncBundleData() {
  const bundle = { _version: '1', _synced_at: new Date().toISOString() };
  SYNC_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) bundle[k] = v;
  });
  return bundle;
}

function syncRestoreKeys(bundle, keys) {
  keys.forEach(k => {
    if (bundle[k] !== undefined) localStorage.setItem(k, bundle[k]);
  });
}

// ═══════════════════════════════════════════════════════
// BACKUP HISTORY (LZ-string compressed, rolling 10)
// ═══════════════════════════════════════════════════════
function historyGet() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch(e) { return []; }
}

function historySave() {
  const bundle = syncBundleData();
  const snapshot = {
    ts: bundle._synced_at,
    data: LZString.compress(JSON.stringify(bundle)),
  };
  const history = historyGet();
  history.unshift(snapshot);
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch(e) {
    // localStorage full — drop oldest and retry
    history.splice(MAX_HISTORY - 1);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch(e2) {}
  }
}

function historyDecompress(snapshot) {
  const json = LZString.decompress(snapshot.data);
  return JSON.parse(json);
}

// ═══════════════════════════════════════════════════════
// EXPORT (bulk)
// ═══════════════════════════════════════════════════════
function syncExport() {
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
function syncImportFile(file) {
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

function openImportModal(bundle, title = 'Import Backup') {
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

function syncImportConfirm() {
  if (!_pendingImport) return;
  const bundle = _pendingImport;
  const checks = g('syncImportChecks').querySelectorAll('input[type=checkbox]:checked');
  const selectedKeys = [];
  checks.forEach(cb => {
    const mod = SYNC_MODULES.find(m => m.key === cb.dataset.mod);
    if (mod) selectedKeys.push(...mod.keys);
  });
  if (!selectedKeys.length) { toast('Nothing selected.', 'warn'); return; }

  syncRestoreKeys(bundle, selectedKeys);
  historySave();
  closeModal('syncImportModal');
  syncSetStatus('Imported ✓ — reloading...', 'ok');
  setTimeout(() => location.reload(), 900);
}

// ═══════════════════════════════════════════════════════
// BACKUP HISTORY MODAL
// ═══════════════════════════════════════════════════════
function openSyncHistory() {
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
function libExportSelective(type) {
  const mod = LIB_MODULES[type];
  if (!mod) return;
  const raw = localStorage.getItem(mod.storageKey);
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

function libImportSelective(file, type, onDone) {
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
      const existing = JSON.parse(localStorage.getItem(mod.storageKey) || '{}');
      const incoming = JSON.parse(bundle[mod.storageKey]);
      const merged = { ...existing, ...incoming };
      localStorage.setItem(mod.storageKey, JSON.stringify(merged));
      toast(`Imported ${mod.label} ✓ (${Object.keys(incoming).length} items)`, 'ok');
      if (onDone) onDone();
    } catch(e) {
      toast('Import error: ' + e.message, 'err');
    }
  };
  r.readAsText(file);
}

// ═══════════════════════════════════════════════════════
// AUTO-PUSH STUB (no-op — kept so core.js calls don't break)
// ═══════════════════════════════════════════════════════
function syncAutoPush() {}

// ═══════════════════════════════════════════════════════
// WIRE
// ═══════════════════════════════════════════════════════
function wireSync() {
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
}

// Helper: figure out which library is currently open in the lib modal
function currentLibMode() {
  const title = g('libModalTitle')?.textContent || '';
  if (title.includes('Character')) return 'char';
  if (title.includes('Preset')) return 'preset';
  if (title.includes('Lorebook')) return 'lore';
  return 'lore';
}

// Helper: figure out which template type is currently open in the tpl modal
function currentTplMode() {
  const title = g('tplModalTitle')?.textContent || '';
  if (title.includes('Character')) return 'tpl_char';
  if (title.includes('Prompt')) return 'tpl_preset';
  return 'tpl_lore';
}
