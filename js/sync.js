// ═══════════════════════════════════════════════════════
// SYNC — JSONBin (gzip) · npoint.io (gzip) · Manual
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
];

const SYNC_PAT_KEY     = 'aet_sync_pat';
const SYNC_GIST_KEY    = 'aet_sync_gist_id';
const SYNC_AUTO_KEY    = 'aet_sync_auto';
const SYNC_NP_ID_KEY   = 'aet_sync_np_id';
const SYNC_NP_AUTO_KEY = 'aet_sync_np_auto';
const SYNC_BACKEND_KEY = 'aet_sync_backend';

const JSONBIN_BASE = 'https://api.jsonbin.io/v3';
const NPOINT_BASE  = 'https://api.npoint.io';

// ═══════════════════════════════════════════════════════
// SHARED UTILS
// ═══════════════════════════════════════════════════════
function syncSetStatus(msg, type = 'info') {
  const el = g('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status ' + type;
}

function syncBundleData() {
  const bundle = {};
  SYNC_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) bundle[k] = v;
  });
  bundle._synced_at = new Date().toISOString();
  bundle._version = '1';
  return bundle;
}

function syncRestoreData(bundle) {
  SYNC_KEYS.forEach(k => {
    if (bundle[k] !== undefined) localStorage.setItem(k, bundle[k]);
  });
}

function syncPayloadKB(str) {
  return (new Blob([str]).size / 1024).toFixed(1);
}

// ── Gzip compress/decompress ──
async function gzipCompress(str) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream not supported in this browser.');
  }
  const enc = new TextEncoder().encode(str);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(enc);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

async function gzipDecompress(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}

// ── Build compressed payload, with size check and fallback error ──
async function buildCompressedPayload() {
  const raw = JSON.stringify(syncBundleData());
  const rawKB = syncPayloadKB(raw);
  try {
    const compressed = await gzipCompress(raw);
    const payload = JSON.stringify({ _gz: compressed, _version: '1' });
    const compKB = syncPayloadKB(payload);
    return { payload, kb: compKB, rawKB };
  } catch (e) {
    throw new Error(`Compression failed (${e.message}). Raw size: ${rawKB}KB — try Manual export instead.`);
  }
}

// ═══════════════════════════════════════════════════════
// BACKEND: JSONBIN (gzip compressed)
// ═══════════════════════════════════════════════════════
function syncGetPAT()    { return localStorage.getItem(SYNC_PAT_KEY) || ''; }
function syncGetGistId() { return localStorage.getItem(SYNC_GIST_KEY) || ''; }

async function syncConnect() {
  const apiKey     = g('syncPatInput').value.trim();
  const binIdInput = g('syncGistId').value.trim();
  if (!apiKey) { syncSetStatus('API key is required.', 'err'); return; }

  syncSetStatus('Connecting...', 'info');
  localStorage.setItem(SYNC_PAT_KEY, apiKey);

  try {
    if (binIdInput) {
      const r = await fetch(`${JSONBIN_BASE}/b/${binIdInput}/latest`, {
        headers: { 'X-Master-Key': apiKey }
      });
      if (!r.ok) throw new Error(`Bin not found or key invalid (${r.status})`);
      localStorage.setItem(SYNC_GIST_KEY, binIdInput);
      syncSetStatus(`Connected to bin ${binIdInput.slice(0, 8)}… ✓`, 'ok');
    } else {
      syncSetStatus('Compressing data...', 'info');
      const { payload, kb, rawKB } = await buildCompressedPayload();
      syncSetStatus(`Creating bin… (${rawKB}KB → ${kb}KB compressed)`, 'info');
      const r = await fetch(`${JSONBIN_BASE}/b`, {
        method: 'POST',
        headers: {
          'X-Master-Key': apiKey,
          'Content-Type': 'application/json',
          'X-Bin-Name': 'LoreOS Sync',
          'X-Bin-Private': 'true'
        },
        body: payload
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(`Failed to create bin (${r.status}): ${err.message || ''} — compressed size: ${kb}KB`);
      }
      const data = await r.json();
      const binId = data.metadata.id;
      localStorage.setItem(SYNC_GIST_KEY, binId);
      g('syncGistId').value = binId;
      syncSetStatus(`Created bin ${binId.slice(0, 8)}… ✓ (${rawKB}KB → ${kb}KB)`, 'ok');
    }
    syncUpdateUI(true);
  } catch (e) {
    syncSetStatus('Error: ' + e.message, 'err');
  }
}

async function syncPush() {
  const apiKey = syncGetPAT();
  const binId  = syncGetGistId();
  if (!apiKey || !binId) { syncSetStatus('Not connected.', 'err'); return; }
  syncSetStatus('Compressing...', 'info');
  try {
    const { payload, kb, rawKB } = await buildCompressedPayload();
    syncSetStatus('Pushing...', 'info');
    const r = await fetch(`${JSONBIN_BASE}/b/${binId}`, {
      method: 'PUT',
      headers: { 'X-Master-Key': apiKey, 'Content-Type': 'application/json' },
      body: payload
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(`Push failed (${r.status}): ${err.message || ''} — ${kb}KB`);
    }
    syncSetStatus(`Pushed ✓ — ${new Date().toLocaleTimeString()} (${rawKB}KB → ${kb}KB)`, 'ok');
  } catch (e) {
    syncSetStatus('Push error: ' + e.message, 'err');
  }
}

async function syncPull() {
  const apiKey = syncGetPAT();
  const binId  = syncGetGistId();
  if (!apiKey || !binId) { syncSetStatus('Not connected.', 'err'); return; }
  syncSetStatus('Pulling...', 'info');
  try {
    const r = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!r.ok) throw new Error(`Pull failed (${r.status})`);
    const data = await r.json();
    const record = data.record;
    if (!record || !record._version) throw new Error('No LoreOS data found in bin.');

    let bundle;
    if (record._gz) {
      const json = await gzipDecompress(record._gz);
      bundle = JSON.parse(json);
    } else {
      bundle = record;
    }

    syncRestoreData(bundle);
    const ts = bundle._synced_at ? new Date(bundle._synced_at).toLocaleString() : 'unknown';
    syncSetStatus(`Pulled ✓ — data from ${ts}. Reloading...`, 'ok');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    syncSetStatus('Pull error: ' + e.message, 'err');
  }
}

function syncDisconnect() {
  localStorage.removeItem(SYNC_PAT_KEY);
  localStorage.removeItem(SYNC_GIST_KEY);
  localStorage.removeItem(SYNC_AUTO_KEY);
  g('syncPatInput').value = '';
  g('syncGistId').value = '';
  g('syncAutoToggle').checked = false;
  syncUpdateUI(false);
  syncSetStatus('Disconnected.', 'info');
}

function syncUpdateUI(connected) {
  const pushBtn       = g('syncPushBtn');
  const pullBtn       = g('syncPullBtn');
  const disconnectBtn = g('syncDisconnectBtn');
  if (!pushBtn) return;
  pushBtn.disabled            = !connected;
  pullBtn.disabled            = !connected;
  disconnectBtn.style.display = connected ? '' : 'none';
}

// ═══════════════════════════════════════════════════════
// BACKEND: NPOINT.IO (gzip compressed)
// ═══════════════════════════════════════════════════════
function syncGetNpId() { return localStorage.getItem(SYNC_NP_ID_KEY) || ''; }

async function syncNpointConnect() {
  const idInput = g('syncNpointId').value.trim();
  syncSetStatus('Connecting...', 'info');

  try {
    if (idInput) {
      const r = await fetch(`${NPOINT_BASE}/${idInput}`);
      if (!r.ok) throw new Error(`JSON not found (${r.status})`);
      localStorage.setItem(SYNC_NP_ID_KEY, idInput);
      syncSetStatus(`Connected to npoint ${idInput.slice(0, 8)}… ✓`, 'ok');
    } else {
      syncSetStatus('Compressing data...', 'info');
      const { payload, kb, rawKB } = await buildCompressedPayload();
      syncSetStatus(`Creating JSON… (${rawKB}KB → ${kb}KB compressed)`, 'info');
      const r = await fetch(`${NPOINT_BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (!r.ok) throw new Error(`Failed to create JSON (${r.status}) — compressed: ${kb}KB`);
      const data = await r.json();
      const npId = data.id;
      localStorage.setItem(SYNC_NP_ID_KEY, npId);
      g('syncNpointId').value = npId;
      syncSetStatus(`Created npoint ${npId.slice(0, 8)}… ✓ (${rawKB}KB → ${kb}KB)`, 'ok');
    }
    syncNpointUpdateUI(true);
  } catch (e) {
    syncSetStatus('Error: ' + e.message, 'err');
  }
}

async function syncNpointPush() {
  const npId = syncGetNpId();
  if (!npId) { syncSetStatus('Not connected.', 'err'); return; }
  syncSetStatus('Compressing...', 'info');
  try {
    const { payload, kb, rawKB } = await buildCompressedPayload();
    syncSetStatus('Pushing...', 'info');
    const r = await fetch(`${NPOINT_BASE}/${npId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    if (!r.ok) throw new Error(`Push failed (${r.status}) — ${kb}KB`);
    syncSetStatus(`Pushed ✓ — ${new Date().toLocaleTimeString()} (${rawKB}KB → ${kb}KB)`, 'ok');
  } catch (e) {
    syncSetStatus('Push error: ' + e.message, 'err');
  }
}

async function syncNpointPull() {
  const npId = syncGetNpId();
  if (!npId) { syncSetStatus('Not connected.', 'err'); return; }
  syncSetStatus('Pulling...', 'info');
  try {
    const r = await fetch(`${NPOINT_BASE}/${npId}`);
    if (!r.ok) throw new Error(`Pull failed (${r.status})`);
    const record = await r.json();
    if (!record || !record._version) throw new Error('No LoreOS data found.');

    let bundle;
    if (record._gz) {
      const json = await gzipDecompress(record._gz);
      bundle = JSON.parse(json);
    } else {
      bundle = record;
    }

    syncRestoreData(bundle);
    const ts = bundle._synced_at ? new Date(bundle._synced_at).toLocaleString() : 'unknown';
    syncSetStatus(`Pulled ✓ — data from ${ts}. Reloading...`, 'ok');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    syncSetStatus('Pull error: ' + e.message, 'err');
  }
}

function syncNpointDisconnect() {
  localStorage.removeItem(SYNC_NP_ID_KEY);
  localStorage.removeItem(SYNC_NP_AUTO_KEY);
  g('syncNpointId').value = '';
  g('syncNpointAutoToggle').checked = false;
  syncNpointUpdateUI(false);
  syncSetStatus('Disconnected.', 'info');
}

function syncNpointUpdateUI(connected) {
  const pushBtn       = g('syncNpointPushBtn');
  const pullBtn       = g('syncNpointPullBtn');
  const disconnectBtn = g('syncNpointDisconnectBtn');
  if (!pushBtn) return;
  pushBtn.disabled            = !connected;
  pullBtn.disabled            = !connected;
  disconnectBtn.style.display = connected ? '' : 'none';
}

// ═══════════════════════════════════════════════════════
// BACKEND: MANUAL
// ═══════════════════════════════════════════════════════
function syncManualExport() {
  const bundle = syncBundleData();
  const json = JSON.stringify(bundle, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  dlFile(json, `LoreOS-backup-${date}.json`, 'application/json');
  syncSetStatus(`Exported backup (${syncPayloadKB(json)}KB)`, 'ok');
}

function syncManualImport(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const bundle = JSON.parse(ev.target.result);
      if (!bundle._version) throw new Error('Not a valid LoreOS backup.');
      syncRestoreData(bundle);
      const ts = bundle._synced_at ? new Date(bundle._synced_at).toLocaleString() : 'unknown';
      syncSetStatus(`Imported ✓ — data from ${ts}. Reloading...`, 'ok');
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      syncSetStatus('Import error: ' + e.message, 'err');
    }
  };
  r.readAsText(file);
}

// ═══════════════════════════════════════════════════════
// AUTO-PUSH
// ═══════════════════════════════════════════════════════
function syncAutoPush() {
  const backend = localStorage.getItem(SYNC_BACKEND_KEY) || 'jsonbin';
  if (backend === 'jsonbin' && localStorage.getItem(SYNC_AUTO_KEY) === '1' && syncGetPAT() && syncGetGistId()) {
    syncPush();
  } else if (backend === 'npoint' && localStorage.getItem(SYNC_NP_AUTO_KEY) === '1' && syncGetNpId()) {
    syncNpointPush();
  }
}

// ═══════════════════════════════════════════════════════
// BACKEND SWITCHER
// ═══════════════════════════════════════════════════════
function syncSwitchBackend(backend) {
  localStorage.setItem(SYNC_BACKEND_KEY, backend);
  document.querySelectorAll('.sync-backend-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.backend === backend);
  });
  document.querySelectorAll('.sync-panel').forEach(panel => {
    panel.style.display = 'none';
  });
  const panel = g('syncPanel-' + backend);
  if (panel) panel.style.display = 'flex';
  syncSetStatus('');
}

// ═══════════════════════════════════════════════════════
// WIRE
// ═══════════════════════════════════════════════════════
function wireSync() {
  const savedBackend = localStorage.getItem(SYNC_BACKEND_KEY) || 'jsonbin';
  syncSwitchBackend(savedBackend);

  document.querySelectorAll('.sync-backend-btn').forEach(btn => {
    btn.addEventListener('click', () => syncSwitchBackend(btn.dataset.backend));
  });

  // ── JSONBin ──
  const savedPat   = syncGetPAT();
  const savedBinId = syncGetGistId();
  if (savedPat)   { const el = g('syncPatInput'); if (el) el.value = savedPat; }
  if (savedBinId) { const el = g('syncGistId');   if (el) el.value = savedBinId; }

  const autoToggle = g('syncAutoToggle');
  if (autoToggle) autoToggle.checked = localStorage.getItem(SYNC_AUTO_KEY) === '1';

  const isJbConnected = !!(savedPat && savedBinId);
  syncUpdateUI(isJbConnected);
  if (isJbConnected && savedBackend === 'jsonbin') {
    syncSetStatus(`Connected — bin ${savedBinId.slice(0, 8)}…`, 'ok');
  }

  g('syncConnectBtn')?.addEventListener('click', syncConnect);
  g('syncPushBtn')?.addEventListener('click', syncPush);
  g('syncPullBtn')?.addEventListener('click', syncPull);
  g('syncDisconnectBtn')?.addEventListener('click', syncDisconnect);
  autoToggle?.addEventListener('change', () => {
    localStorage.setItem(SYNC_AUTO_KEY, autoToggle.checked ? '1' : '0');
  });

  const patVisBtn = g('syncTogglePatVisibility');
  const patInput  = g('syncPatInput');
  patVisBtn?.addEventListener('click', () => {
    patInput.type = patInput.type === 'password' ? 'text' : 'password';
  });

  // ── npoint ──
  const savedNpId = syncGetNpId();
  if (savedNpId) { const el = g('syncNpointId'); if (el) el.value = savedNpId; }

  const npAutoToggle = g('syncNpointAutoToggle');
  if (npAutoToggle) npAutoToggle.checked = localStorage.getItem(SYNC_NP_AUTO_KEY) === '1';

  const isNpConnected = !!savedNpId;
  syncNpointUpdateUI(isNpConnected);
  if (isNpConnected && savedBackend === 'npoint') {
    syncSetStatus(`Connected — npoint ${savedNpId.slice(0, 8)}…`, 'ok');
  }

  g('syncNpointConnectBtn')?.addEventListener('click', syncNpointConnect);
  g('syncNpointPushBtn')?.addEventListener('click', syncNpointPush);
  g('syncNpointPullBtn')?.addEventListener('click', syncNpointPull);
  g('syncNpointDisconnectBtn')?.addEventListener('click', syncNpointDisconnect);
  npAutoToggle?.addEventListener('change', () => {
    localStorage.setItem(SYNC_NP_AUTO_KEY, npAutoToggle.checked ? '1' : '0');
  });

  // ── Manual ──
  g('syncManualExportBtn')?.addEventListener('click', syncManualExport);
  g('syncManualImportBtn')?.addEventListener('click', () => g('syncManualFileInput').click());
  g('syncManualFileInput')?.addEventListener('change', e => {
    syncManualImport(e.target.files[0]);
    e.target.value = '';
  });
}
