// ═══════════════════════════════════════════════════════
// JSONBIN SYNC
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
const SYNC_PAT_KEY = 'aet_sync_pat';
const SYNC_GIST_KEY = 'aet_sync_gist_id'; // reused as bin ID key
const SYNC_AUTO_KEY = 'aet_sync_auto';
const JSONBIN_BASE = 'https://api.jsonbin.io/v3';

function syncSetStatus(msg, type='info') {
  const el = g('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status ' + type;
}

function syncGetPAT() { return localStorage.getItem(SYNC_PAT_KEY) || ''; }
function syncGetGistId() { return localStorage.getItem(SYNC_GIST_KEY) || ''; }

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

async function syncConnect() {
  const apiKey = g('syncPatInput').value.trim();
  const binIdInput = g('syncGistId').value.trim();
  if (!apiKey) { syncSetStatus('API key is required.', 'err'); return; }

  syncSetStatus('Connecting...', 'info');
  localStorage.setItem(SYNC_PAT_KEY, apiKey);

  try {
    if (binIdInput) {
      // Verify existing bin
      const r = await fetch(`${JSONBIN_BASE}/b/${binIdInput}/latest`, {
        headers: { 'X-Master-Key': apiKey }
      });
      if (!r.ok) throw new Error(`Bin not found or API key invalid (${r.status})`);
      localStorage.setItem(SYNC_GIST_KEY, binIdInput);
      syncSetStatus(`Connected to bin ${binIdInput.slice(0,8)}… ✓`, 'ok');
    } else {
      // Create new bin
      const r = await fetch(`${JSONBIN_BASE}/b`, {
        method: 'POST',
        headers: {
          'X-Master-Key': apiKey,
          'Content-Type': 'application/json',
          'X-Bin-Name': 'LoreOS Sync',
          'X-Bin-Private': 'true'
        },
        body: JSON.stringify(syncBundleData())
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(`Failed to create bin (${r.status})${err.message ? ': ' + err.message : ''}`);
      }
      const data = await r.json();
      const binId = data.metadata.id;
      localStorage.setItem(SYNC_GIST_KEY, binId);
      g('syncGistId').value = binId;
      syncSetStatus(`Created new bin ${binId.slice(0,8)}… ✓`, 'ok');
    }
    syncUpdateUI(true);
  } catch(e) {
    syncSetStatus('Error: ' + e.message, 'err');
  }
}

async function syncPush() {
  const apiKey = syncGetPAT();
  const binId = syncGetGistId();
  if (!apiKey || !binId) { syncSetStatus('Not connected.', 'err'); return; }
  syncSetStatus('Pushing...', 'info');
  try {
    const payload = JSON.stringify(syncBundleData());
    const kb = (new Blob([payload]).size / 1024).toFixed(1);
    const r = await fetch(`${JSONBIN_BASE}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'X-Master-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: payload
    });
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      const msg = errBody.message || errBody.error || `status ${r.status}`;
      throw new Error(`Push failed (${r.status}): ${msg} — payload: ${kb}KB`);
    }
    const ts = new Date().toLocaleTimeString();
    syncSetStatus(`Pushed ✓ — ${ts} (${kb}KB)`, 'ok');
  } catch(e) {
    syncSetStatus('Push error: ' + e.message, 'err');
  }
}

async function syncPull() {
  const apiKey = syncGetPAT();
  const binId = syncGetGistId();
  if (!apiKey || !binId) { syncSetStatus('Not connected.', 'err'); return; }
  syncSetStatus('Pulling...', 'info');
  try {
    const r = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!r.ok) throw new Error(`Pull failed (${r.status})`);
    const data = await r.json();
    const bundle = data.record;
    if (!bundle || !bundle._version) throw new Error('No LoreOS data found in bin.');
    syncRestoreData(bundle);
    const ts = bundle._synced_at ? new Date(bundle._synced_at).toLocaleString() : 'unknown';
    syncSetStatus(`Pulled ✓ — data from ${ts}. Reloading...`, 'ok');
    setTimeout(() => location.reload(), 1200);
  } catch(e) {
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
  const pushBtn = g('syncPushBtn');
  const pullBtn = g('syncPullBtn');
  const disconnectBtn = g('syncDisconnectBtn');
  if (!pushBtn) return;
  pushBtn.disabled = !connected;
  pullBtn.disabled = !connected;
  disconnectBtn.style.display = connected ? '' : 'none';
}

// Auto-push hook — called after any save
function syncAutoPush() {
  if (localStorage.getItem(SYNC_AUTO_KEY) === '1' && syncGetPAT() && syncGetGistId()) {
    syncPush();
  }
}

function wireSync() {
  const savedPat = syncGetPAT();
  const savedBinId = syncGetGistId();
  const isConnected = !!(savedPat && savedBinId);

  if (savedPat) {
    const patInput = g('syncPatInput');
    if (patInput) patInput.value = savedPat;
  }
  if (savedBinId) {
    const binInput = g('syncGistId');
    if (binInput) binInput.value = savedBinId;
  }
  const autoToggle = g('syncAutoToggle');
  if (autoToggle) autoToggle.checked = localStorage.getItem(SYNC_AUTO_KEY) === '1';

  syncUpdateUI(isConnected);
  if (isConnected) syncSetStatus(`Connected — bin ${savedBinId.slice(0,8)}…`, 'ok');

  const connectBtn = g('syncConnectBtn');
  if (connectBtn) connectBtn.addEventListener('click', syncConnect);

  const pushBtn = g('syncPushBtn');
  if (pushBtn) pushBtn.addEventListener('click', syncPush);

  const pullBtn = g('syncPullBtn');
  if (pullBtn) pullBtn.addEventListener('click', syncPull);

  const disconnectBtn = g('syncDisconnectBtn');
  if (disconnectBtn) disconnectBtn.addEventListener('click', syncDisconnect);

  if (autoToggle) {
    autoToggle.addEventListener('change', () => {
      localStorage.setItem(SYNC_AUTO_KEY, autoToggle.checked ? '1' : '0');
    });
  }

  // PAT visibility toggle
  const patVisBtn = g('syncTogglePatVisibility');
  const patInput = g('syncPatInput');
  if (patVisBtn && patInput) {
    patVisBtn.addEventListener('click', () => {
      patInput.type = patInput.type === 'password' ? 'text' : 'password';
    });
  }
}
