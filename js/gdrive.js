// ═══════════════════════════════════════════════════════
// LOREOS — GOOGLE DRIVE SYNC
// Uses drive.appdata scope (hidden app folder, not visible
// in user's Drive — simpler verification, no audit needed)
// Client-side OAuth via GSI — no backend required
// Token stored in memory only (cleared on page reload)
//
// Authorised origins (Google Cloud Console):
//   https://loreos.net
//   https://loreos.pages.dev
//   https://bumyann.github.io
//   http://localhost:8080
// ═══════════════════════════════════════════════════════

const GDRIVE_CLIENT_ID = '218324898243-cm0as5dqcsl9g7tgj1lf6lk83pc1qti3.apps.googleusercontent.com';
const GDRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.appdata';
const GDRIVE_FILE_NAME = 'LoreOS-sync.json';
const GDRIVE_PUSH_DELAY = 5000; // ms debounce for auto-push
const GDRIVE_LINK_FLAG = 'loreos_gdrive_linked'; // non-sensitive: just "was connected", never the token itself

// ── Runtime state (memory-only — cleared on reload) ──
let gdriveToken      = null;  // access token
let gdriveFileId     = null;  // Drive file ID once located/created
let gdriveEmail      = null;  // connected account email
let gdriveLastSync   = null;  // ISO timestamp of last successful sync
let gdrivePushTimer  = null;  // debounce handle
let gdriveAvailable  = false; // false on file:// protocol

// ═══════════════════════════════════════════════════════
// INIT — hide section if on file:// (unsupported by OAuth)
// ═══════════════════════════════════════════════════════
function gdriveInit() {
  gdriveAvailable = window.location.protocol !== 'file:';
  const section = g('gdriveSyncSection');
  if (section) section.style.display = gdriveAvailable ? '' : 'none';
}

// ═══════════════════════════════════════════════════════
// AUTH — connect / disconnect
// ═══════════════════════════════════════════════════════
function gdriveConnect() {
  if (!gdriveAvailable) return;
  if (typeof google === 'undefined' || !google.accounts?.oauth2) {
    toast('Google Sign-In library not loaded yet — try again.', 'warn');
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CLIENT_ID,
    scope: GDRIVE_SCOPE,
    callback: async (resp) => {
      if (resp.error) {
        toast('Google auth failed: ' + resp.error, 'err');
        return;
      }
      gdriveToken = resp.access_token;
      localStorage.setItem(GDRIVE_LINK_FLAG, '1');
      // Fetch user info for display
      try {
        const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + gdriveToken }
        }).then(r => r.json());
        gdriveEmail = info.email || 'connected';
      } catch(e) {
        gdriveEmail = 'connected';
      }
      toast('Connected to Google Drive ✓', 'ok');
      gdriveUpdateUI();
      // Locate or create the sync file
      await gdriveFindOrCreateFile();
    },
  });

  client.requestAccessToken({ prompt: 'consent' });
}

// ═══════════════════════════════════════════════════════
// SILENT RECONNECT — on page load, try to re-acquire a token
// without any prompt if this browser was previously linked.
// No token is ever persisted; only a plain "was linked" flag is.
// Falls back to showing the normal Connect button if this fails
// (expired browser session, revoked consent, etc.) — no error toast.
// ═══════════════════════════════════════════════════════
function gdriveTrySilentReconnect(retriesLeft = 10) {
  if (!gdriveAvailable) return;
  if (localStorage.getItem(GDRIVE_LINK_FLAG) !== '1') return;

  if (typeof google === 'undefined' || !google.accounts?.oauth2) {
    // GSI script loads async/defer — it may not be ready yet on first call
    if (retriesLeft > 0) setTimeout(() => gdriveTrySilentReconnect(retriesLeft - 1), 300);
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CLIENT_ID,
    scope: GDRIVE_SCOPE,
    callback: async (resp) => {
      if (resp.error) {
        // Silent auth failed (session expired / consent revoked elsewhere) —
        // just fall back to manual connect, no toast needed on a background attempt.
        localStorage.removeItem(GDRIVE_LINK_FLAG);
        return;
      }
      gdriveToken = resp.access_token;
      try {
        const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + gdriveToken }
        }).then(r => r.json());
        gdriveEmail = info.email || 'connected';
      } catch(e) {
        gdriveEmail = 'connected';
      }
      gdriveUpdateUI();
      await gdriveFindOrCreateFile();
    },
  });

  client.requestAccessToken({ prompt: '' }); // '' = try silently, no popup
}

function gdriveDisconnect() {
  if (gdriveToken && typeof google !== 'undefined') {
    google.accounts.oauth2.revoke(gdriveToken, () => {});
  }
  gdriveToken    = null;
  gdriveFileId   = null;
  gdriveEmail    = null;
  gdriveLastSync = null;
  clearTimeout(gdrivePushTimer);
  localStorage.removeItem(GDRIVE_LINK_FLAG);
  toast('Disconnected from Google Drive.', 'ok');
  gdriveUpdateUI();
}

// ═══════════════════════════════════════════════════════
// FILE MANAGEMENT
// ═══════════════════════════════════════════════════════
async function gdriveFindOrCreateFile() {
  if (!gdriveToken) return null;

  // Search for existing LoreOS-sync.json
  try {
    const search = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D%22${GDRIVE_FILE_NAME}%22+and+trashed%3Dfalse&fields=files(id,name,modifiedTime)&spaces=appDataFolder&orderBy=modifiedTime+desc`,
      { headers: { Authorization: 'Bearer ' + gdriveToken } }
    ).then(r => r.json());

    if (search.files && search.files.length > 0) {
      // appDataFolder doesn't enforce unique filenames — if more than one
      // sync file exists (e.g. from a session that lost its cached file ID
      // and re-created one), always use the most recently modified, and
      // quietly trash the older duplicates so push/pull can't disagree
      // about which file is current.
      gdriveFileId = search.files[0].id;
      if (search.files.length > 1) {
        console.warn('[GDrive] found', search.files.length, 'duplicate sync files — keeping the most recent, trashing the rest.');
        search.files.slice(1).forEach(f => {
          fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + gdriveToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),
          }).catch(e => console.error('[GDrive] failed to trash duplicate:', e));
        });
      }
      return gdriveFileId;
    }

    // Not found — create it in appDataFolder
    const bundle = typeof syncBundleData === 'function' ? syncBundleData() : { _version: '1', _note: 'LoreOS sync file' };
    const meta = { name: GDRIVE_FILE_NAME, mimeType: 'application/json', parents: ['appDataFolder'] };
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    body.append('media', new Blob([JSON.stringify(bundle)], { type: 'application/json' }));

    const created = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { Authorization: 'Bearer ' + gdriveToken }, body }
    ).then(r => r.json());

    gdriveFileId = created.id;
    return gdriveFileId;
  } catch(e) {
    console.error('[GDrive] file find/create error:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// PUSH — write current data to Drive
// ═══════════════════════════════════════════════════════
async function gdrivePush() {
  if (!gdriveToken || !gdriveAvailable) return;
  if (!gdriveFileId) { await gdriveFindOrCreateFile(); }
  if (!gdriveFileId) { toast('Could not locate Drive sync file.', 'err'); return; }

  try {
    const bundle = typeof syncBundleData === 'function' ? syncBundleData() : {};
    const json   = JSON.stringify(bundle);

    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${gdriveFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + gdriveToken,
          'Content-Type': 'application/json',
        },
        body: json,
      }
    );

    if (!res.ok) {
      // Token may have expired — clear and prompt reconnect
      if (res.status === 401) {
        gdriveToken = null;
        gdriveUpdateUI();
        toast('Drive session expired — please reconnect.', 'warn');
        return;
      }
      throw new Error('HTTP ' + res.status);
    }

    gdriveLastSync = new Date().toISOString();
    gdriveUpdateUI();
  } catch(e) {
    console.error('[GDrive] push error:', e);
    // Silent fail on auto-push — don't spam toasts
  }
}

// Manual push (with toast feedback)
async function gdrivePushManual() {
  if (!gdriveToken) { toast('Not connected to Google Drive.', 'warn'); return; }
  toast('Pushing to Drive...', 'ok');
  await gdrivePush();
  toast('Synced to Drive ✓', 'ok');
}

// Auto-push debounced — called from syncAutoPush()
function gdriveAutoPush() {
  if (!gdriveToken || !gdriveAvailable) return;
  clearTimeout(gdrivePushTimer);
  gdrivePushTimer = setTimeout(gdrivePush, GDRIVE_PUSH_DELAY);
}

// ═══════════════════════════════════════════════════════
// PULL — read from Drive and offer import
// ═══════════════════════════════════════════════════════
async function gdrivePull() {
  if (!gdriveToken) { toast('Not connected to Google Drive.', 'warn'); return; }
  if (!gdriveFileId) { await gdriveFindOrCreateFile(); }
  if (!gdriveFileId) { toast('No sync file found in Drive.', 'warn'); return; }

  try {
    toast('Fetching from Drive...', 'ok');
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${gdriveFileId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + gdriveToken } }
    );

    if (!res.ok) {
      if (res.status === 401) {
        gdriveToken = null;
        gdriveUpdateUI();
        toast('Drive session expired — please reconnect.', 'warn');
        return;
      }
      throw new Error('HTTP ' + res.status);
    }

    const bundle = await res.json();
    if (!bundle._version) throw new Error('Not a valid LoreOS backup.');

    // Use existing import modal from sync.js
    if (typeof openImportModal === 'function') {
      openImportModal(bundle, 'Import from Google Drive');
    }
  } catch(e) {
    console.error('[GDrive] pull error:', e);
    toast('Pull failed: ' + e.message, 'err');
  }
}

// ═══════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════
function gdriveUpdateUI() {
  const connected   = !!gdriveToken;
  const connectBtn  = g('gdriveConnectBtn');
  const disconnBtn  = g('gdriveDisconnectBtn');
  const status      = g('gdriveStatus');
  const actions     = g('gdriveActions');

  if (connectBtn)  connectBtn.style.display  = connected ? 'none' : '';
  if (disconnBtn)  disconnBtn.style.display  = connected ? '' : 'none';
  if (actions)     actions.style.display     = connected ? 'flex' : 'none';

  if (status) {
    if (connected) {
      const ts = gdriveLastSync
        ? 'Last synced: ' + new Date(gdriveLastSync).toLocaleString()
        : 'Connected — not yet synced';
      status.innerHTML = `<span class="gdrive-pill connected">● ${gdriveEmail}</span> <span class="gdrive-ts">${ts}</span>`;
    } else {
      status.innerHTML = '';
    }
  }
}

// ═══════════════════════════════════════════════════════
// WIRE — called from wireSync() in sync.js
// ═══════════════════════════════════════════════════════
function wireGdrive() {
  gdriveInit();
  gdriveTrySilentReconnect();
  g('gdriveConnectBtn')?.addEventListener('click', gdriveConnect);
  g('gdriveDisconnectBtn')?.addEventListener('click', gdriveDisconnect);
  g('gdrivePushBtn')?.addEventListener('click', gdrivePushManual);
  g('gdrivePullBtn')?.addEventListener('click', gdrivePull);
}
