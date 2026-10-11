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
//
// HOW CONFLICTS ARE DETECTED (Pass 2)
// Drive gives every file a server-side `version` that goes up on every
// change, from any device. This device remembers the version it last synced
// with (GDRIVE_BASE_KEY) and whether it has edited anything since
// (GDRIVE_DIRTY_KEY, set by syncAutoPush in sync.js). Before writing, we ask
// Drive for the current version:
//   same as our base    -> nobody else touched it, safe to push
//   different, we're clean  -> another device pushed: "behind", offer Pull
//   different, we're dirty  -> both changed: "conflict", never auto-overwrite
// No clocks are compared, so a device with a wrong date can't break it.
// ═══════════════════════════════════════════════════════

import { openImportModal, syncBundleData, syncLocalHasData } from './sync.js';
import { askConfirm, esc, g, toast } from './util.js';

export const GDRIVE_CLIENT_ID = '218324898243-cm0as5dqcsl9g7tgj1lf6lk83pc1qti3.apps.googleusercontent.com';
export const GDRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.appdata';
export const GDRIVE_FILE_NAME = 'LoreOS-sync.json';
export const GDRIVE_PUSH_DELAY = 5000; // ms debounce for auto-push
export const GDRIVE_LINK_FLAG = 'loreos_gdrive_linked'; // non-sensitive: just "was connected", never the token itself
export const GDRIVE_HINT_KEY = 'loreos_gdrive_hint';  // last account email, so Google can skip the account picker
export const GDRIVE_BASE_KEY  = 'aet_gdrive_base';      // Drive file version this device last pushed/pulled
export const GDRIVE_DIRTY_KEY = 'aet_gdrive_dirty';     // '1' = edited since the last successful sync
export const GDRIVE_RECHECK_MS = 60000;                 // min gap between "did another device push?" checks

// ── Runtime state (memory-only — cleared on reload) ──
export let gdriveToken      = null;  // access token
export let gdriveTokenExpiry = 0;    // ms epoch when the token stops working
export let gdriveFileId     = null;  // Drive file ID once located/created
export let gdriveEmail      = null;  // connected account email
export let gdriveLastSync   = null;  // ISO timestamp of last successful sync
export let gdrivePushTimer  = null;  // debounce handle
export let gdriveAvailable  = false; // false on file:// protocol
export let gdrivePushing    = false; // a push is in flight
export let gdriveEditSeq    = 0;     // bumped on every edit; lets a push tell if you edited while it ran
export let gdriveLastCheck  = 0;     // when we last compared versions with Drive
export let gdriveLastError  = '';    // message behind state === 'error'
// 'idle' | 'ok' | 'behind' (Drive has newer data) | 'conflict' (both changed)
//        | 'error' (last request failed) | 'expired' (needs reconnect)
export let gdriveState      = 'idle';

// ═══════════════════════════════════════════════════════
// INIT — hide section if on file:// (unsupported by OAuth)
// ═══════════════════════════════════════════════════════
export function gdriveInit() {
  gdriveAvailable = window.location.protocol !== 'file:';
  const section = g('gdriveSyncSection');
  if (section) section.style.display = gdriveAvailable ? '' : 'none';
}

// ═══════════════════════════════════════════════════════
// LOCAL SYNC MARKERS
// ═══════════════════════════════════════════════════════
export function gdriveGetBase() {
  try { return localStorage.getItem(GDRIVE_BASE_KEY); } catch (e) { return null; }
}

// Has this device got edits Drive hasn't seen? A device that has data but has
// never synced with this Drive file counts as dirty: we can't prove it matches.
export function gdriveIsDirty() {
  try {
    if (localStorage.getItem(GDRIVE_DIRTY_KEY) === '1') return true;
    if (gdriveGetBase() === null) return syncLocalHasData();
  } catch (e) {}
  return false;
}

export function gdriveMarkSynced(version) {
  try {
    if (version !== undefined && version !== null) localStorage.setItem(GDRIVE_BASE_KEY, String(version));
    localStorage.removeItem(GDRIVE_DIRTY_KEY);
  } catch (e) {}
  gdriveLastSync = new Date().toISOString();
}

// ═══════════════════════════════════════════════════════
// AUTH — token handling
// ═══════════════════════════════════════════════════════
export function gdriveGsiReady() {
  return typeof google !== 'undefined' && !!google.accounts?.oauth2;
}

// Promise wrapper around the GSI token client.
//   prompt 'consent' = interactive popup (must be called straight from a click)
//   prompt ''        = silent, no popup
// Always resolves (never rejects): { access_token, expires_in } on success,
// { error } if Google refused, or null on timeout / library missing.
export function gdriveRequestToken(prompt) {
  let hint = '';
  try { hint = localStorage.getItem(GDRIVE_HINT_KEY) || ''; } catch (e) {}
  return new Promise(resolve => {
    if (!gdriveGsiReady()) { resolve(null); return; }
    let done = false;
    let timer = null;
    const finish = v => { if (done) return; done = true; clearTimeout(timer); resolve(v); };
    timer = setTimeout(() => finish(null), prompt === '' ? 10000 : 180000);
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CLIENT_ID,
        scope: GDRIVE_SCOPE,
        callback: resp => finish(resp || null),
        // popup blocked / closed, or silent auth needs interaction
        error_callback: err => finish({ error: (err && err.type) || 'popup_failed' }),
      });
      client.requestAccessToken(hint ? { prompt, hint } : { prompt });
    } catch (e) {
      finish(null);
    }
  });
}

export function gdriveSetToken(resp) {
  gdriveToken = resp.access_token;
  // Google access tokens last ~1h. Remember when, so we refresh BEFORE a
  // request fails instead of after (the old code only found out via a 401).
  gdriveTokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
}

// Flip to the "session expired" state: pill says so, Connect button comes
// back, and nothing pretends to be syncing. Local edits stay flagged dirty
// and get pushed once the user reconnects.
export function gdriveExpire() {
  const wasConnected = !!gdriveToken;
  gdriveToken = null;
  gdriveTokenExpiry = 0;
  clearTimeout(gdrivePushTimer);
  gdriveState = 'expired';
  gdriveUpdateUI();
  return wasConnected;
}

export function gdriveAuthError() {
  const e = new Error('Drive session expired');
  e.auth = true;
  return e;
}

// Make sure we hold a token with a bit of life left, refreshing silently if
// we can. Returns false (and flips to "expired") if we can't.
export let gdriveRefreshing = null; // one silent refresh at a time, shared by concurrent callers
export async function gdriveEnsureToken() {
  if (gdriveToken && Date.now() < gdriveTokenExpiry - 60000) return true;
  if (!gdriveToken && localStorage.getItem(GDRIVE_LINK_FLAG) !== '1') return false;
  if (!gdriveRefreshing) {
    gdriveRefreshing = gdriveRequestToken('').then(resp => {
      if (resp && resp.access_token) { gdriveSetToken(resp); return true; }
      gdriveExpire();
      return false;
    }).finally(() => { gdriveRefreshing = null; });
  }
  return gdriveRefreshing;
}

// fetch() with auth: refreshes an about-to-expire token first, and if Drive
// still answers 401 refreshes once and retries before giving up.
export async function gdriveFetch(url, opts = {}) {
  const send = () => fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + gdriveToken },
  });
  if (!(await gdriveEnsureToken())) throw gdriveAuthError();
  let res = await send();
  if (res.status === 401) {
    gdriveTokenExpiry = 0; // force a refresh
    if (!(await gdriveEnsureToken())) throw gdriveAuthError();
    res = await send();
    if (res.status === 401) { gdriveExpire(); throw gdriveAuthError(); }
  }
  return res;
}

export async function gdriveFetchEmail() {
  try {
    const info = await gdriveFetch('https://www.googleapis.com/oauth2/v3/userinfo').then(r => r.json());
    gdriveEmail = info.email || 'connected';
    if (info.email) { try { localStorage.setItem(GDRIVE_HINT_KEY, info.email); } catch (e) {} }
  } catch (e) {
    gdriveEmail = gdriveEmail || 'connected';
  }
}

// ═══════════════════════════════════════════════════════
// CONNECT / DISCONNECT
// ═══════════════════════════════════════════════════════
export function gdriveConnect() {
  if (!gdriveAvailable) return;
  if (!gdriveGsiReady()) {
    toast('Google Sign-In library not loaded yet — try again.', 'warn');
    return;
  }
  // No `await` before this call: the popup has to open from the click itself.
  // prompt '' = Google only asks for consent the first time; with the saved
  // email hint, reconnecting is a quick tap instead of a full sign-in again.
  gdriveRequestToken('').then(async resp => {
    if (!resp || resp.error || !resp.access_token) {
      toast('Google auth failed' + (resp && resp.error ? ': ' + resp.error : ' (no response).'), 'err');
      return;
    }
    gdriveSetToken(resp);
    localStorage.setItem(GDRIVE_LINK_FLAG, '1');
    gdriveState = 'idle';
    await gdriveFetchEmail();
    toast('Connected to Google Drive ✓', 'ok');
    gdriveUpdateUI();
    await gdriveReconcile({ onConnect: true });
  });
}

// ═══════════════════════════════════════════════════════
// SILENT RECONNECT — on page load, try to re-acquire a token
// without any prompt if this browser was previously linked.
// No token is ever persisted; only a plain "was linked" flag is.
// Falls back to showing the normal Connect button if this fails
// (expired browser session, revoked consent, etc.) — no error toast.
// ═══════════════════════════════════════════════════════
export async function gdriveTrySilentReconnect(retriesLeft = 10) {
  if (!gdriveAvailable) return;
  if (localStorage.getItem(GDRIVE_LINK_FLAG) !== '1') return;

  if (!gdriveGsiReady()) {
    // GSI script loads async/defer — it may not be ready yet on first call
    if (retriesLeft > 0) setTimeout(() => gdriveTrySilentReconnect(retriesLeft - 1), 300);
    return;
  }

  const resp = await gdriveRequestToken('');
  if (!resp || !resp.access_token) {
    // Google wants a tap (phones block popups that don't come from a tap, and
    // the browser session may have lapsed). Keep the link, show "Reconnect",
    // and never forget the account: a failed silent try is not a sign-out.
    if (resp && resp.error) { gdriveState = 'expired'; gdriveUpdateUI(); }
    return;
  }
  gdriveSetToken(resp);
  await gdriveFetchEmail();
  gdriveUpdateUI();
  await gdriveReconcile({ onConnect: true });
}

export function gdriveDisconnect() {
  if (gdriveToken && gdriveGsiReady()) {
    google.accounts.oauth2.revoke(gdriveToken, () => {});
  }
  gdriveToken    = null;
  gdriveTokenExpiry = 0;
  gdriveFileId   = null;
  gdriveEmail    = null;
  gdriveLastSync = null;
  gdriveState    = 'idle';
  gdriveLastError = '';
  clearTimeout(gdrivePushTimer);
  localStorage.removeItem(GDRIVE_LINK_FLAG);
  localStorage.removeItem(GDRIVE_HINT_KEY);
  // Forget which Drive version we were synced with: a different account's
  // file isn't comparable, so the next connect re-checks from scratch
  try { localStorage.removeItem(GDRIVE_BASE_KEY); } catch (e) {}
  toast('Disconnected from Google Drive.', 'ok');
  gdriveUpdateUI();
}

// ═══════════════════════════════════════════════════════
// FILE MANAGEMENT
// ═══════════════════════════════════════════════════════

// Find the sync file in the hidden app folder; create it only if the search
// genuinely worked and found nothing. Resolves { id, version, created }.
// THROWS if Drive couldn't be asked: the old version treated a failed search
// as "no file" and created a fresh sync file every time, which is where the
// duplicate / stale files came from.
export async function gdriveLocateFile({ create = true } = {}) {
  // Drive query strings use SINGLE quotes around literals (double quotes were
  // what the old query used). The name has no quotes in it, but escape anyway.
  const safeName = GDRIVE_FILE_NAME.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `name = '${safeName}' and trashed = false`,
    spaces: 'appDataFolder',
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,modifiedTime,version)',
  });
  const res = await gdriveFetch('https://www.googleapis.com/drive/v3/files?' + params.toString());
  if (!res.ok) throw new Error('Drive search failed (HTTP ' + res.status + ')');
  const search = await res.json();
  if (!search || search.error || !Array.isArray(search.files)) {
    throw new Error('Drive search returned something unexpected');
  }

  if (search.files.length > 0) {
    // appDataFolder doesn't enforce unique filenames — if more than one
    // sync file exists (left over from the old failed-search bug), use the
    // most recently modified one. The older ones are left alone: they're
    // invisible and harmless, and deleting data automatically isn't worth it.
    const latest = search.files[0];
    if (search.files.length > 1) {
      console.warn('[GDrive] found', search.files.length, 'sync files — using the most recently modified (' + latest.id + ').');
    }
    gdriveFileId = latest.id;
    return { id: latest.id, version: latest.version, created: false };
  }

  if (!create) return null;

  // Genuinely no file yet — first device to sync. Create it from local data.
  const bundle = syncBundleData();
  const meta = { name: GDRIVE_FILE_NAME, mimeType: 'application/json', parents: ['appDataFolder'] };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  body.append('media', new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
  const cres = await gdriveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version',
    { method: 'POST', body }
  );
  if (!cres.ok) throw new Error('Could not create the Drive sync file (HTTP ' + cres.status + ')');
  const created = await cres.json();
  if (!created || !created.id) throw new Error('Drive did not return a file id');
  gdriveFileId = created.id;
  return { id: created.id, version: created.version, created: true };
}

// Kept for any older callers: resolves the file id, or null on failure
export async function gdriveFindOrCreateFile() {
  try { return (await gdriveLocateFile()).id; }
  catch (e) { gdriveHandleError(e, { quiet: true }); return null; }
}

// Current server-side version of the sync file (string), or null if the file
// we had cached is gone
export async function gdriveGetRemoteVersion() {
  const res = await gdriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(gdriveFileId)}?fields=version`
  );
  if (res.status === 404) { gdriveFileId = null; return null; }
  if (!res.ok) throw new Error('Drive version check failed (HTTP ' + res.status + ')');
  const info = await res.json();
  return info && info.version !== undefined ? String(info.version) : null;
}

// ═══════════════════════════════════════════════════════
// RECONCILE — compare this device with Drive, decide what's safe
// Called on connect and when you come back to the tab.
// ═══════════════════════════════════════════════════════
export async function gdriveReconcile({ onConnect = false } = {}) {
  if (!gdriveToken || !gdriveAvailable) return;
  if (gdrivePushing) return;
  gdriveLastCheck = Date.now();
  try {
    const loc = await gdriveLocateFile({ create: true });

    if (loc.created) {
      // First device ever: the file was just created from our data
      gdriveMarkSynced(loc.version);
      gdriveState = 'ok';
      gdriveUpdateUI();
      return;
    }

    const base = gdriveGetBase();
    if (String(loc.version) === base) {
      // Nobody else has pushed since we last synced
      gdriveState = 'ok';
      gdriveUpdateUI();
      if (gdriveIsDirty()) await gdrivePush(); // unsynced edits (e.g. made offline): safe to send
      return;
    }

    // Drive has changed since this device last synced (or this device has
    // never synced with it)
    const hasLocal = syncLocalHasData();
    if (!hasLocal) {
      // Brand-new device with nothing to lose: go straight to the import prompt
      gdriveState = 'ok';
      gdriveUpdateUI();
      toast('Found your data on Drive — pick what to bring in.', 'ok');
      await gdrivePull();
      return;
    }
    if (gdriveIsDirty()) {
      gdriveState = 'conflict';
      toast('Drive and this device both have changes. Auto-sync is paused so nothing gets overwritten — use Pull to see Drive\'s version, or Push Now to overwrite it.', 'warn');
    } else {
      gdriveState = 'behind';
      toast('Another device pushed newer data to Drive. Use Pull to bring it in.', 'warn');
    }
    gdriveUpdateUI();
  } catch (e) {
    gdriveHandleError(e, { quiet: !onConnect });
  }
}

// Shared error handling: expired sessions get their own state, everything
// else lands in 'error' with the message visible in the status pill
export function gdriveHandleError(e, { quiet = false } = {}) {
  console.error('[GDrive]', e);
  if (e && e.auth) {
    if (!quiet) toast('Drive session expired — tap Reconnect to resume syncing. Your changes are safe on this device.', 'warn');
    return;
  }
  gdriveState = 'error';
  gdriveLastError = (e && e.message) || 'unknown error';
  gdriveUpdateUI();
  if (!quiet) toast('Drive sync problem: ' + gdriveLastError, 'err');
}

// ═══════════════════════════════════════════════════════
// PUSH — write current data to Drive
// Resolves { ok, reason?, message? }. reason is one of
// 'conflict' | 'behind' | 'auth' | 'busy' | 'error' | 'unavailable'.
// ═══════════════════════════════════════════════════════
export async function gdrivePush({ force = false } = {}) {
  if (!gdriveToken || !gdriveAvailable) return { ok: false, reason: 'unavailable' };
  if (gdrivePushing) return { ok: false, reason: 'busy' };
  gdrivePushing = true;
  const seqAtStart = gdriveEditSeq;
  try {
    // 1. Find the file (and create it if this is the very first sync)
    if (!gdriveFileId) {
      const loc = await gdriveLocateFile({ create: true });
      if (loc.created) {
        gdriveMarkSynced(loc.version);
        gdriveState = 'ok';
        gdriveUpdateUI();
        return { ok: true };
      }
    }

    // 2. Make sure nobody else changed it since we last synced
    if (!force) {
      let remote = await gdriveGetRemoteVersion();
      if (remote === null) { // cached id was stale: look again
        const loc = await gdriveLocateFile({ create: true });
        if (loc.created) {
          gdriveMarkSynced(loc.version);
          gdriveState = 'ok';
          gdriveUpdateUI();
          return { ok: true };
        }
        remote = String(loc.version);
      }
      if (remote !== gdriveGetBase()) {
        const reason = gdriveIsDirty() ? 'conflict' : 'behind';
        gdriveState = reason;
        gdriveUpdateUI();
        return { ok: false, reason };
      }
    }

    // 3. Write it
    const json = JSON.stringify(syncBundleData());
    const res = await gdriveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(gdriveFileId)}?uploadType=media&fields=version`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json }
    );
    if (res.status === 404) { gdriveFileId = null; throw new Error('The Drive sync file disappeared — try again.'); }
    if (!res.ok) throw new Error('Drive rejected the upload (HTTP ' + res.status + ')');
    const info = await res.json().catch(() => ({}));

    // Only now do we claim to be in sync. If you kept editing while the upload
    // ran, stay dirty (the base moves forward, the edits still need sending).
    if (gdriveEditSeq === seqAtStart) {
      gdriveMarkSynced(info.version);
    } else {
      try { if (info.version !== undefined) localStorage.setItem(GDRIVE_BASE_KEY, String(info.version)); } catch (e) {}
      gdriveLastSync = new Date().toISOString();
    }
    gdriveState = 'ok';
    gdriveLastError = '';
    gdriveUpdateUI();
    return { ok: true };
  } catch (e) {
    if (e && e.auth) return { ok: false, reason: 'auth' };
    gdriveHandleError(e, { quiet: true }); // auto-push stays quiet; the status pill shows it
    return { ok: false, reason: 'error', message: e && e.message };
  } finally {
    gdrivePushing = false;
    // Edits landed while we were uploading: send them too
    if (gdriveEditSeq !== seqAtStart && gdriveToken && gdriveState === 'ok') gdriveAutoPush();
  }
}

// Manual push (with honest feedback)
export async function gdrivePushManual() {
  if (!gdriveToken) { toast('Not connected to Google Drive.', 'warn'); return; }
  toast('Pushing to Drive...', 'ok');
  let r = await gdrivePush();

  if (!r.ok && (r.reason === 'conflict' || r.reason === 'behind')) {
    const msg = r.reason === 'conflict'
      ? 'Drive has newer changes from another device AND this device has changes too. Overwrite Drive with THIS device\'s version? (Cancel, then use Pull to look at Drive\'s version first.)'
      : 'Drive has newer data than this device. Pushing now would replace it with older data. Overwrite Drive anyway?';
    if (!(await askConfirm(msg))) { toast('Push cancelled — nothing was overwritten.', 'info'); return; }
    r = await gdrivePush({ force: true });
  }

  if (r.ok) toast('Synced to Drive ✓', 'ok');
  else if (r.reason === 'auth') toast('Drive session expired — tap Reconnect to resume syncing.', 'warn');
  else if (r.reason === 'busy') toast('A sync is already running — give it a second.', 'info');
  else toast('Drive push failed: ' + (r.message || r.reason || 'unknown error'), 'err');
}

// Drop a queued auto-push
export function cancelDrivePush() { clearTimeout(gdrivePushTimer); }

// Auto-push debounced — called from syncAutoPush()
export function gdriveAutoPush() {
  gdriveEditSeq++;
  if (!gdriveToken || !gdriveAvailable) return;
  // Paused states: pushing now could overwrite another device's newer data.
  // The user resolves it with Pull / Push Now.
  if (gdriveState === 'conflict' || gdriveState === 'behind') return;
  clearTimeout(gdrivePushTimer);
  gdrivePushTimer = setTimeout(() => { gdrivePush(); }, GDRIVE_PUSH_DELAY);
}

// ═══════════════════════════════════════════════════════
// PULL — read from Drive and offer import
// ═══════════════════════════════════════════════════════
export async function gdrivePull() {
  if (!gdriveToken) { toast('Not connected to Google Drive.', 'warn'); return; }

  try {
    toast('Fetching from Drive...', 'ok');
    const loc = await gdriveLocateFile({ create: false });
    if (!loc) { toast('No sync file found in Drive yet — push from your other device first.', 'warn'); return; }

    const res = await gdriveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(loc.id)}?alt=media`
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const bundle = await res.json();
    if (!bundle || !bundle._version) throw new Error('Not a valid LoreOS backup.');

    // Remember which Drive version this is. If the user confirms the import,
    // syncImportConfirm() records it as the version we're now in sync with.
    bundle._gdriveVersion = loc.version;

    // Use existing import modal from sync.js
    openImportModal(bundle, 'Import from Google Drive');
  } catch (e) {
    if (e && e.auth) { toast('Drive session expired — tap Reconnect to resume syncing.', 'warn'); return; }
    console.error('[GDrive] pull error:', e);
    toast('Pull failed: ' + e.message, 'err');
  }
}

// ═══════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════
export function gdriveUpdateUI() {
  const connected   = !!gdriveToken;
  const connectBtn  = g('gdriveConnectBtn');
  const disconnBtn  = g('gdriveDisconnectBtn');
  const status      = g('gdriveStatus');
  const actions     = g('gdriveActions');

  if (connectBtn) {
    connectBtn.style.display = connected ? 'none' : '';
    connectBtn.textContent = (!connected && localStorage.getItem(GDRIVE_LINK_FLAG) === '1') ? 'Reconnect Google Drive' : 'Connect Google Drive';
  }
  if (disconnBtn)  disconnBtn.style.display  = connected ? '' : 'none';
  if (actions)     actions.style.display     = connected ? 'flex' : 'none';

  if (!status) return;

  if (!connected) {
    if (gdriveState === 'expired') {
      status.innerHTML = `<span class="gdrive-pill" style="color:var(--warn)">● session expired</span> ` +
        `<span class="gdrive-ts">Your changes are safe on this device. Tap Reconnect to resume syncing.</span>`;
    } else {
      status.innerHTML = '';
    }
    return;
  }

  const who = esc(gdriveEmail || 'connected');
  const ts = gdriveLastSync
    ? 'Last synced: ' + new Date(gdriveLastSync).toLocaleString()
    : 'Connected — not yet synced';
  const pill = (cls, style, text) => `<span class="gdrive-pill ${cls}"${style ? ` style="${style}"` : ''}>${text}</span>`;

  let html;
  if (gdriveState === 'conflict') {
    html = pill('', 'color:var(--err)', `⚠ ${who} — sync paused`) +
      ` <span class="gdrive-ts">Drive and this device both changed. Pull to see Drive's version, or Push Now to overwrite it.</span>`;
  } else if (gdriveState === 'behind') {
    html = pill('', 'color:var(--warn)', `⬇ ${who} — Drive is newer`) +
      ` <span class="gdrive-ts">Another device pushed newer data. Press Pull to bring it in.</span>`;
  } else if (gdriveState === 'error') {
    html = pill('', 'color:var(--err)', `⚠ ${who} — last sync failed`) +
      ` <span class="gdrive-ts">${esc(gdriveLastError)} (will retry on your next save)</span>`;
  } else {
    html = pill('connected', '', `● ${who}`) + ` <span class="gdrive-ts">${esc(ts)}</span>`;
  }
  status.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// WIRE — called from wireSync() in sync.js
// ═══════════════════════════════════════════════════════
export function wireGdrive() {
  gdriveInit();
  gdriveTrySilentReconnect();
  g('gdriveConnectBtn')?.addEventListener('click', gdriveConnect);
  g('gdriveDisconnectBtn')?.addEventListener('click', gdriveDisconnect);
  g('gdrivePushBtn')?.addEventListener('click', gdrivePushManual);
  g('gdrivePullBtn')?.addEventListener('click', gdrivePull);

  // Back online after being offline: send whatever was edited in the meantime
  window.addEventListener('online', () => {
    if (!gdriveToken || gdrivePushing) return;
    if (gdriveState === 'conflict' || gdriveState === 'behind') return;
    if (gdriveIsDirty()) gdriveAutoPush();
  });

  // Coming back to the tab (after a while, or from another device's session):
  // quietly check whether another device pushed in the meantime
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !gdriveToken || gdrivePushing) return;
    if (gdriveState === 'conflict' || gdriveState === 'behind') return; // already known, don't nag
    if (Date.now() - gdriveLastCheck < GDRIVE_RECHECK_MS) return;
    gdriveReconcile();
  });
}
