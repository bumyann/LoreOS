// ═══════════════════════════════════════════════════════
// SECRETS — where API keys live, and how carefully.
//
// A key typed into a web page is only ever as safe as that page and the browser it runs in. What this
// module does about it:
//   - the default is to NOT keep a key: it stays in memory until the tab is closed or reloaded
//   - or keep it encrypted (AES-GCM, key derived from a passphrase with PBKDF2, 600,000 rounds). The
//     passphrase is asked once per visit and is never stored; only the unlocked key lives in memory
//   - or keep it as plain text in this browser, which is clearly labelled as the weakest choice
//   - keys are never part of backups, Drive sync, exports or the console bridge's state, and are never
//     shown again after saving (only the last 4 characters)
//   - `secureFetch` only sends a key to https addresses (or localhost and home-network addresses),
//     never follows a redirect with it, and sends no cookies or referrer
// ═══════════════════════════════════════════════════════
import { askInput } from './util.js';

export const SECRETS_KEY = 'loreos_secrets';
export const MODES = [['session', 'Do not keep it (forget when this tab closes)'], ['encrypted', 'Keep it, encrypted with a passphrase'], ['plain', 'Keep it as plain text in this browser (least safe)']];
const ITER = 600000;
const mem = new Map();          // name -> value, for this visit only
const unlocked = new Map();     // salt (base64) -> CryptoKey, for this visit only

const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const cryptoAvailable = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function';

function readStore() { try { const o = JSON.parse(localStorage.getItem(SECRETS_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
function writeStore(o) { try { if (Object.keys(o).length) localStorage.setItem(SECRETS_KEY, JSON.stringify(o)); else localStorage.removeItem(SECRETS_KEY); return true; } catch (e) { return false; } }

// ── The cipher (exported so it can be tested on its own) ──
export async function deriveKey(passphrase, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptText(text, passphrase, iter = ITER) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iter);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct), iter };
}
export async function decryptText(box, passphrase) {
  const key = await deriveKey(passphrase, unb64(box.salt), box.iter || ITER);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
  return new TextDecoder().decode(pt);
}

export const maskSecret = v => (v ? '•'.repeat(8) + String(v).slice(-4) : '');

// What is known about a secret without opening it
export function secretInfo(name) {
  const rec = readStore()[name];
  if (rec && rec.mode === 'encrypted') return { has: true, mode: 'encrypted', unlocked: mem.has(name) };
  if (rec && rec.mode === 'plain') return { has: true, mode: 'plain', unlocked: true, hint: rec.hint || '' };
  if (mem.has(name)) return { has: true, mode: 'session', unlocked: true, hint: maskSecret(mem.get(name)).slice(-4) };
  return { has: false, mode: 'session', unlocked: false };
}

// Save a secret. `passphrase` is needed for the encrypted mode.
export async function setSecret(name, value, mode = 'session', passphrase = '') {
  const v = String(value || '').trim();
  if (!v) { forgetSecret(name); return { ok: true }; }
  const store = readStore();
  if (mode === 'encrypted') {
    if (!cryptoAvailable()) return { ok: false, error: 'Encryption is not available here (it needs https or localhost).' };
    if (String(passphrase).length < 8) return { ok: false, error: 'Use a passphrase of at least 8 characters.' };
    store[name] = { mode: 'encrypted', hint: v.slice(-4), box: await encryptText(v, passphrase) };
    mem.set(name, v);
  } else if (mode === 'plain') {
    store[name] = { mode: 'plain', hint: v.slice(-4), v };
    mem.set(name, v);
  } else { delete store[name]; mem.set(name, v); }
  if (!writeStore(store)) return { ok: false, error: 'Could not save (the browser refused).' };
  return { ok: true };
}

// Read a secret. An encrypted one asks for its passphrase once per visit.
export async function getSecret(name, { ask = askInput } = {}) {
  if (mem.has(name)) return mem.get(name);
  const rec = readStore()[name];
  if (!rec) return '';
  if (rec.mode === 'plain') { mem.set(name, String(rec.v || '')); return mem.get(name); }
  if (rec.mode === 'encrypted' && rec.box) {
    for (let tries = 0; tries < 3; tries++) {
      const pass = await ask(tries ? 'Wrong passphrase. Try again, or leave it empty to cancel.' : 'Passphrase for your saved API key', '', { secret: true });
      if (!pass) return '';
      try { const v = await decryptText(rec.box, pass); mem.set(name, v); return v; } catch (e) { /* wrong passphrase */ }
    }
  }
  return '';
}
export function forgetSecret(name) { mem.delete(name); const s = readStore(); delete s[name]; writeStore(s); }
// Forget everything held in memory (stored copies stay, an encrypted one needs its passphrase again)
export function lockSecrets() { mem.clear(); unlocked.clear(); }
export function forgetAllSecrets() { mem.clear(); unlocked.clear(); writeStore({}); }

// ── Safe fetching ──
export function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}
// Throws a readable error when an address is not safe to send something private to
export function checkEndpoint(raw, { needHttps = true } = {}) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (e) { throw new Error('That is not a web address (it should start with https://).'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http and https addresses are allowed.');
  if (u.username || u.password) throw new Error('Do not put a name or password in the address; use the key field.');
  if (needHttps && u.protocol === 'http:' && !isPrivateHost(u.hostname)) throw new Error('That address must use https, so what you send cannot be read on the way. (http is only allowed for this computer or your home network.)');
  return u;
}
export function secureFetch(url, init = {}, fetchFn = (...a) => fetch(...a)) {
  checkEndpoint(url);
  return fetchFn(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', ...init });
}
// A plain reason for a failed network call, which is usually CORS, a server that is off, or http on an https page
export function explainNetworkError(e, url) {
  if (e && e.name === 'AbortError') return 'Stopped (it took too long or you cancelled).';
  const msg = (e && e.message) || '';
  if (/Failed to fetch|NetworkError|Load failed|redirect/i.test(msg)) {
    let host = ''; try { host = new URL(url).host; } catch (x) { /* ignore */ }
    return `Could not reach ${host || 'that server'}. Check that it is running, that its address is right, and that it allows requests from this site (CORS). Pages on https can only reach http servers on this same computer.`;
  }
  return msg || 'That did not work.';
}
