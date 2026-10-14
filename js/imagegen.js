// ═══════════════════════════════════════════════════════
// IMAGE GENERATION — make a picture from a prompt, or change one with a prompt, and keep it in the Gallery.
//
// Providers:
//   Pollinations           free, no account or key (text to picture only)
//   OpenAI-compatible      your own endpoint: base URL + API key + model (/images/generations, /images/edits)
//   SwarmUI                your own server (default http://localhost:7801), no key
//   ComfyUI                your own server (default http://127.0.0.1:8188), no key; built-in workflows
//                          or your own workflow (API format) with %prompt% style placeholders
//
// What leaves this device: the prompt (and for edits, the picture) goes to the provider you pick. API
// keys are handled by secrets.js: by default they are not kept at all. Settings never include keys and
// are not part of backups or Drive sync.
// ═══════════════════════════════════════════════════════
import { addPicture, hooks } from './gallery.js';
import { closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import { refreshLibrary } from './library_view.js';
import { wsShowItem } from './workshop.js';
import { MODES, checkEndpoint, explainNetworkError, forgetSecret, getSecret, isPrivateHost, secretInfo, setSecret } from './secrets.js';
import { askInput } from './util.js';

export const GEN_KEY = 'loreos_imagegen';
export const SIZES = [['Square', 1024, 1024], ['Portrait', 768, 1024], ['Landscape', 1024, 768], ['Wide', 1280, 720], ['Tall', 720, 1280]];
export const POLLINATIONS_MODELS = ['flux', 'turbo', 'gptimage'];
export const PROVIDERS = [['pollinations', 'Pollinations (free)'], ['openai', 'OpenAI-compatible'], ['swarmui', 'SwarmUI'], ['comfyui', 'ComfyUI']];
export const KEY_NAME = 'openai';
export const DEFAULTS = Object.freeze({
  provider: 'pollinations', model: 'flux', size: 0, suffix: '', negative: '', steps: 25, cfg: 6,
  baseUrl: 'https://api.openai.com/v1', openaiModel: 'gpt-image-1',
  swarmUrl: 'http://localhost:7801', swarmModel: '',
  comfyUrl: 'http://127.0.0.1:8188', comfyCkpt: '', comfyWorkflow: '',
});
const TEXT_KEYS = ['model', 'suffix', 'negative', 'baseUrl', 'openaiModel', 'swarmUrl', 'swarmModel', 'comfyUrl', 'comfyCkpt'];

export function loadGenSettings() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(GEN_KEY) || '{}') || {}; } catch (e) { /* first run */ }
  const out = { ...DEFAULTS };
  if (PROVIDERS.some(p => p[0] === o.provider)) out.provider = o.provider;
  TEXT_KEYS.forEach(k => { if (typeof o[k] === 'string') out[k] = o[k].slice(0, 400); });
  if (typeof o.comfyWorkflow === 'string') out.comfyWorkflow = o.comfyWorkflow.slice(0, 200000);
  if (Number.isInteger(o.size) && SIZES[o.size]) out.size = o.size;
  const steps = Number(o.steps), cfg = Number(o.cfg);
  if (Number.isFinite(steps)) out.steps = Math.max(1, Math.min(150, Math.round(steps)));
  if (Number.isFinite(cfg)) out.cfg = Math.max(0, Math.min(30, Math.round(cfg * 10) / 10));
  return out;
}
// An earlier version kept the key in these settings. Move it to the secrets store and take it out.
export async function migrateOldKey() {
  try {
    const o = JSON.parse(localStorage.getItem(GEN_KEY) || '{}');
    if (o && typeof o.apiKey === 'string') {
      if (o.apiKey.trim()) await setSecret(KEY_NAME, o.apiKey, 'plain');
      delete o.apiKey; localStorage.setItem(GEN_KEY, JSON.stringify(o));
    }
  } catch (e) { /* nothing to move */ }
}
export function saveGenSettings(s) {
  const o = { ...s }; delete o.apiKey;               // keys never go in the settings
  try { localStorage.setItem(GEN_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
}

// ── Small helpers ──
const blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Could not read the picture.')); r.readAsDataURL(blob); });
export const cleanBase = u => String(u || '').trim().replace(/\/+$/, '');
export const isHttp = u => /^https?:\/\//i.test(String(u || ''));
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
export function dataUrlToBlob(url) {
  const m = String(url).match(/^data:([^;,]+)?(;base64)?,(.*)$/s); if (!m) throw new Error('That picture could not be read.');
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: m[1] || 'image/png' });
}
const sizeOf = settings => { const [, w, h] = SIZES[settings.size] || SIZES[0]; return { w, h }; };
const fullPrompt = (prompt, settings) => (String(prompt || '').trim() + (settings.suffix ? ', ' + settings.suffix : '')).slice(0, 3000);
async function jsonOf(res) { try { return await res.json(); } catch (e) { return null; } }
const errText = (data, res) => (data && (data.error && (data.error.message || data.error) || data.message)) ? String((data.error && (data.error.message || data.error)) || data.message).slice(0, 220) : 'The server answered ' + res.status + '.';
// swarm/comfy addresses: https anywhere, or http only on this computer / home network
function mustBeHttp(url) { return cleanBase(checkEndpoint(url).href); }

export function pollinationsUrl(prompt, { model, w, h, seed }) {
  const q = new URLSearchParams({ width: String(w), height: String(h), model: model || 'flux', nologo: 'true', private: 'true', seed: String(seed) });
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?' + q.toString();
}

// ── ComfyUI workflows ──
// Built-in text to picture, and picture to picture. A custom workflow (API format) may use these
// placeholders as whole values: %prompt% %negative% %seed% %width% %height% %steps% %cfg% %ckpt% %image% %strength%
export function comfyGraph({ prompt, negative, seed, w, h, steps, cfg, ckpt, image = '', strength = 0.6 }) {
  const g0 = {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: negative || '', clip: ['4', 1] } },
    '3': { class_type: 'KSampler', inputs: { seed, steps, cfg, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'LoreOS', images: ['8', 0] } },
  };
  if (image) {
    g0['10'] = { class_type: 'LoadImage', inputs: { image } };
    g0['11'] = { class_type: 'VAEEncode', inputs: { pixels: ['10', 0], vae: ['4', 2] } };
    g0['5'] = null; delete g0['5'];
    g0['3'].inputs.latent_image = ['11', 0]; g0['3'].inputs.denoise = Math.max(0.05, Math.min(1, strength));
  } else g0['5'] = { class_type: 'EmptyLatentImage', inputs: { width: w, height: h, batch_size: 1 } };
  return g0;
}
export function fillWorkflow(text, vars) {
  let graph; try { graph = JSON.parse(text); } catch (e) { throw new Error('The ComfyUI workflow is not valid JSON. Use "Save (API Format)" in ComfyUI.'); }
  const map = { '%prompt%': vars.prompt, '%negative%': vars.negative || '', '%seed%': vars.seed, '%width%': vars.w, '%height%': vars.h, '%steps%': vars.steps, '%cfg%': vars.cfg, '%ckpt%': vars.ckpt, '%image%': vars.image || '', '%strength%': vars.strength };
  const walk = v => {
    if (typeof v === 'string' && Object.prototype.hasOwnProperty.call(map, v)) return map[v];
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { o[k] = walk(v[k]); }); return o; }
    return v;
  };
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) throw new Error('The ComfyUI workflow must be an object (API format).');
  return walk(graph);
}

// ── One request per provider. `fetchFn` and `sleep` are injectable so the shapes can be tested offline. ──
async function viaPollinations({ prompt, settings, fetchFn, signal, seed }) {
  const { w, h } = sizeOf(settings);
  const res = await fetchFn(pollinationsUrl(fullPrompt(prompt, settings), { model: settings.model, w, h, seed }), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error('Pollinations answered ' + res.status + '.');
  const blob = await res.blob();
  if (!/^image\//.test(blob.type)) throw new Error('Pollinations did not send a picture.');
  return blobToDataUrl(blob);
}
async function viaOpenAi({ prompt, settings, apiKey, fetchFn, signal, image, strength }) {
  const base = cleanBase(settings.baseUrl);
  if (!isHttp(base)) throw new Error('Set the endpoint address (it starts with https://).');
  checkEndpoint(base);
  if (!String(apiKey || '').trim()) throw new Error('Add your API key first.');
  const { w, h } = sizeOf(settings);
  const common = { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', signal };
  let res;
  if (image) {
    const fd = new FormData();
    fd.append('model', settings.openaiModel); fd.append('prompt', fullPrompt(prompt, settings)); fd.append('n', '1');
    fd.append('image', dataUrlToBlob(image), 'picture.png');
    res = await fetchFn(base + '/images/edits', { ...common, method: 'POST', headers: { Authorization: 'Bearer ' + apiKey.trim() }, body: fd });
  } else {
    res = await fetchFn(base + '/images/generations', { ...common, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey.trim() }, body: JSON.stringify({ model: settings.openaiModel, prompt: fullPrompt(prompt, settings), n: 1, size: w + 'x' + h }) });
  }
  const data = await jsonOf(res);
  if (!res.ok) throw new Error(errText(data, res));
  const item = data && Array.isArray(data.data) ? data.data[0] : null;
  if (item && item.b64_json) return 'data:image/png;base64,' + item.b64_json;
  if (item && isHttp(item.url)) {
    checkEndpoint(item.url, { needHttps: true });
    const r2 = await fetchFn(item.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r2.ok) throw new Error('Could not download the generated picture (' + r2.status + ').');
    return blobToDataUrl(await r2.blob());
  }
  throw new Error('The endpoint did not return a picture.');
}
async function swarmSession(base, fetchFn, signal) {
  const r = await fetchFn(base + '/API/GetNewSession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  const d = await jsonOf(r); if (!r.ok || !d || !d.session_id) throw new Error(errText(d, r));
  return d.session_id;
}
async function viaSwarm({ prompt, settings, fetchFn, signal, seed, image, strength }) {
  const base = mustBeHttp(settings.swarmUrl, 'SwarmUI'); const { w, h } = sizeOf(settings);
  const body = sid => {
    const b = { session_id: sid, images: 1, prompt: fullPrompt(prompt, settings), negativeprompt: settings.negative || '', width: w, height: h, steps: settings.steps, cfgscale: settings.cfg, seed };
    if (settings.swarmModel) b.model = settings.swarmModel;
    if (image) { b.initimage = image; b.initimagecreativity = Math.max(0, Math.min(1, strength)); }
    return JSON.stringify(b);
  };
  let sid = await swarmSession(base, fetchFn, signal), data = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetchFn(base + '/API/GenerateText2Image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(sid), signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    data = await jsonOf(res);
    if (data && data.error_id === 'invalid_session_id' && !attempt) { sid = await swarmSession(base, fetchFn, signal); continue; }
    if (!res.ok || (data && data.error)) throw new Error(errText(data, res));
    break;
  }
  const first = data && Array.isArray(data.images) ? data.images[0] : null;
  if (!first) throw new Error('SwarmUI did not return a picture.');
  if (/^data:image\//.test(first)) return first;
  const r2 = await fetchFn(base + '/' + String(first).replace(/^\/+/, ''), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r2.ok) throw new Error('Could not download the picture from SwarmUI (' + r2.status + ').');
  return blobToDataUrl(await r2.blob());
}
async function viaComfy({ prompt, settings, fetchFn, signal, seed, image, strength, sleep = sleepMs }) {
  const base = mustBeHttp(settings.comfyUrl, 'ComfyUI'); const { w, h } = sizeOf(settings);
  const opt = extra => ({ signal, credentials: 'omit', referrerPolicy: 'no-referrer', ...extra });
  let uploaded = '';
  if (image) {
    const fd = new FormData(); fd.append('image', dataUrlToBlob(image), 'loreos-input.png'); fd.append('overwrite', 'true');
    const up = await fetchFn(base + '/upload/image', opt({ method: 'POST', body: fd }));
    const ud = await jsonOf(up); if (!up.ok || !ud || !ud.name) throw new Error(errText(ud, up));
    uploaded = ud.subfolder ? ud.subfolder + '/' + ud.name : ud.name;
  }
  const vars = { prompt: fullPrompt(prompt, settings), negative: settings.negative, seed, w, h, steps: settings.steps, cfg: settings.cfg, ckpt: settings.comfyCkpt, image: uploaded, strength };
  if (!settings.comfyWorkflow.trim() && !settings.comfyCkpt.trim()) throw new Error('Pick a checkpoint (use "Load models"), or paste a workflow.');
  const graph = settings.comfyWorkflow.trim() ? fillWorkflow(settings.comfyWorkflow, vars) : comfyGraph(vars);
  const q = await fetchFn(base + '/prompt', opt({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph, client_id: 'loreos' }) }));
  const qd = await jsonOf(q);
  if (!q.ok || !qd || !qd.prompt_id) throw new Error(qd && qd.node_errors && Object.keys(qd.node_errors).length ? 'ComfyUI rejected the workflow: ' + JSON.stringify(qd.node_errors).slice(0, 200) : errText(qd, q));
  for (let i = 0; i < 240; i++) {
    if (signal && signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    await sleep(750);
    const hr = await fetchFn(base + '/history/' + encodeURIComponent(qd.prompt_id), opt({}));
    const hd = await jsonOf(hr); const entry = hd && hd[qd.prompt_id];
    if (entry && entry.status && entry.status.status_str === 'error') throw new Error('ComfyUI could not finish that picture.');
    if (entry && entry.outputs) {
      const img = Object.values(entry.outputs).flatMap(o => (o && o.images) || []).find(x => x && x.filename);
      if (!img) continue;
      const vr = await fetchFn(base + '/view?' + new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' }).toString(), opt({}));
      if (!vr.ok) throw new Error('Could not download the picture from ComfyUI (' + vr.status + ').');
      return blobToDataUrl(await vr.blob());
    }
  }
  throw new Error('ComfyUI took too long.');
}

const ROUTES = { pollinations: viaPollinations, openai: viaOpenAi, swarmui: viaSwarm, comfyui: viaComfy };
const urlOf = s => s.provider === 'openai' ? s.baseUrl : s.provider === 'swarmui' ? s.swarmUrl : s.provider === 'comfyui' ? s.comfyUrl : 'https://image.pollinations.ai';

// Make a picture from a prompt. Returns a data URL.
export async function generateImage({ prompt, settings, apiKey = '', fetchFn = (...a) => fetch(...a), signal, seed = Math.floor(Math.random() * 1e9), sleep }) {
  if (!String(prompt || '').trim()) throw new Error('Write a prompt first.');
  try { return await ROUTES[settings.provider]({ prompt, settings, apiKey, fetchFn, signal, seed, sleep }); }
  catch (e) { throw Object.assign(new Error(explainNetworkError(e, urlOf(settings))), { name: e && e.name }); }
}
// Change a picture with a prompt (picture to picture). Not every provider can.
export const CAN_EDIT = { pollinations: false, openai: true, swarmui: true, comfyui: true };
export async function editImage({ prompt, image, strength = 0.6, settings, apiKey = '', fetchFn = (...a) => fetch(...a), signal, seed = Math.floor(Math.random() * 1e9), sleep }) {
  if (!CAN_EDIT[settings.provider]) throw new Error('Pollinations cannot change a picture. Pick OpenAI-compatible, SwarmUI or ComfyUI in the generate settings.');
  if (!String(prompt || '').trim()) throw new Error('Say what to change first.');
  if (!/^data:image\//.test(String(image || ''))) throw new Error('There is no picture to change.');
  try { return await ROUTES[settings.provider]({ prompt, settings, apiKey, fetchFn, signal, seed, image, strength, sleep }); }
  catch (e) { throw Object.assign(new Error(explainNetworkError(e, urlOf(settings))), { name: e && e.name }); }
}

// ── Model lists (so you can pick instead of typing) ──
export async function listSwarmModels(settings, fetchFn = (...a) => fetch(...a)) {
  const base = mustBeHttp(settings.swarmUrl, 'SwarmUI'); const sid = await swarmSession(base, fetchFn);
  const r = await fetchFn(base + '/API/ListModels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sid, path: '', depth: 3, subtype: 'Stable-Diffusion' }), credentials: 'omit', referrerPolicy: 'no-referrer' });
  const d = await jsonOf(r); if (!r.ok || !d) throw new Error(errText(d, r));
  return (d.files || []).map(f => String(f.name || f)).filter(Boolean);
}
export async function listComfyCheckpoints(settings, fetchFn = (...a) => fetch(...a)) {
  const base = mustBeHttp(settings.comfyUrl, 'ComfyUI');
  const r = await fetchFn(base + '/object_info/CheckpointLoaderSimple', { credentials: 'omit', referrerPolicy: 'no-referrer' });
  const d = await jsonOf(r); if (!r.ok || !d) throw new Error(errText(d, r));
  const list = d.CheckpointLoaderSimple && d.CheckpointLoaderSimple.input && d.CheckpointLoaderSimple.input.required && d.CheckpointLoaderSimple.input.required.ckpt_name;
  return Array.isArray(list) && Array.isArray(list[0]) ? list[0].map(String) : [];
}

// ── The dialog ──
let result = null, running = null, last = null;
const S = () => loadGenSettings();

// What the settings tell you about the connection, in plain words
export function providerNote(s) {
  if (s.provider === 'pollinations') return 'Your prompt is sent to Pollinations (image.pollinations.ai). No account or key needed.';
  if (s.provider === 'openai') return 'Your prompt (and the picture, when editing) and your API key are sent to the address above. Only https addresses are accepted. The key is handled as you choose below.';
  const name = s.provider === 'swarmui' ? 'SwarmUI' : 'ComfyUI', url = s.provider === 'swarmui' ? s.swarmUrl : s.comfyUrl;
  let local = false; try { local = isPrivateHost(new URL(url).hostname); } catch (e) { /* not an address yet */ }
  return `Your prompt goes to your ${name} server${local ? ' on this computer or your home network, so it stays with you' : ''}. The server must allow requests from this site (CORS)${location.protocol === 'https:' ? ', and browsers only let https pages reach http servers on this same computer' : ''}.`;
}
function paintSettings() {
  const s = S();
  g('genProvider').innerHTML = PROVIDERS.map(([v, l]) => `<option value="${v}"${s.provider === v ? ' selected' : ''}>${l}</option>`).join('');
  g('genModel').innerHTML = POLLINATIONS_MODELS.map(m => `<option value="${m}"${m === s.model ? ' selected' : ''}>${m}</option>`).join('');
  ['pollinations', 'openai', 'swarmui', 'comfyui'].forEach(p => { g('genP-' + p).style.display = s.provider === p ? (p === 'pollinations' ? '' : 'flex') : 'none'; });
  g('genBase').value = s.baseUrl; g('genOModel').value = s.openaiModel;
  g('genSwarmUrl').value = s.swarmUrl; g('genSwarmModel').value = s.swarmModel;
  g('genComfyUrl').value = s.comfyUrl; g('genComfyCkpt').value = s.comfyCkpt; g('genComfyFlow').value = s.comfyWorkflow;
  g('genSuffix').value = s.suffix; g('genNeg').value = s.negative; g('genSteps').value = s.steps; g('genCfg').value = s.cfg;
  g('genAdv').style.display = s.provider === 'swarmui' || s.provider === 'comfyui' ? '' : 'none';
  g('genSizes').innerHTML = SIZES.map((z, i) => `<button class="img-preset${s.size === i ? ' active' : ''}" data-gensize="${i}">${z[0]} <span class="rx-none">${z[1]}×${z[2]}</span></button>`).join('');
  g('genSizes').querySelectorAll('[data-gensize]').forEach(b => b.onclick = () => { const n = S(); n.size = Number(b.dataset.gensize); saveGenSettings(n); paintSettings(); });
  g('genPrivacy').textContent = providerNote(s);
  paintKey();
}
function paintKey() {
  const info = secretInfo(KEY_NAME);
  g('genKeyMode').innerHTML = MODES.map(([v, l]) => `<option value="${v}"${(info.has ? info.mode : g('genKeyMode').dataset.mode || 'session') === v ? ' selected' : ''}>${l}</option>`).join('');
  g('genKeyMode').disabled = false;
  g('genKeyState').textContent = info.has ? `A key is saved (${info.mode === 'session' ? 'for this visit only' : info.mode === 'encrypted' ? 'encrypted' + (info.unlocked ? ', unlocked' : ', locked') : 'plain text'}), ending ${info.hint || '••••'}.` : 'No key saved.';
  g('genKeyForget').style.display = info.has ? '' : 'none';
  g('genKey').placeholder = info.has ? 'Type a new key to replace it' : 'API key';
  g('genKeyWarn').textContent = (info.has ? info.mode : g('genKeyMode').value) === 'plain' ? 'Plain text means anything that can read this site\'s data in this browser can read the key. Prefer the passphrase option.' : (location.protocol === 'https:' || isPrivateHost(location.hostname) ? '' : 'This page is not on https, so passphrase protection is not available.');
}
export function readSettings() {
  const s = S();
  const v = id => g(id).value;
  s.provider = PROVIDERS.some(p => p[0] === v('genProvider')) ? v('genProvider') : 'pollinations';
  if (v('genModel')) s.model = v('genModel');
  s.baseUrl = v('genBase'); s.openaiModel = v('genOModel').trim() || DEFAULTS.openaiModel;
  s.swarmUrl = v('genSwarmUrl'); s.swarmModel = v('genSwarmModel').trim();
  s.comfyUrl = v('genComfyUrl'); s.comfyCkpt = v('genComfyCkpt').trim(); s.comfyWorkflow = v('genComfyFlow');
  s.suffix = v('genSuffix').trim(); s.negative = v('genNeg').trim();
  s.steps = Math.max(1, Math.min(150, Math.round(Number(v('genSteps')) || DEFAULTS.steps))); s.cfg = Math.max(0, Math.min(30, Number(v('genCfg')) || DEFAULTS.cfg));
  saveGenSettings(s); return s;
}
// Save a typed key the way the chosen mode says. Returns false when it could not be saved.
async function commitKey() {
  const typed = g('genKey').value.trim(); if (!typed) return true;
  const mode = g('genKeyMode').value; let pass = '';
  if (mode === 'encrypted') {
    pass = await askInput('Choose a passphrase to lock your API key (8 or more characters). You will be asked for it once per visit, and it cannot be recovered if you forget it.', '', { secret: true });
    if (pass === null || pass === '') return false;
    const again = await askInput('Type the passphrase again', '', { secret: true });
    if (again !== pass) { toast('The passphrases did not match, so the key was not saved.', 'warn'); return false; }
  }
  const r = await setSecret(KEY_NAME, typed, mode, pass);
  if (!r.ok) { toast(r.error, 'err'); return false; }
  g('genKey').value = ''; paintKey(); return true;
}
function showResult(url) {
  result = url;
  g('genResult').innerHTML = url ? `<img src="${esc(url)}" alt="Generated picture">` : '<div class="rx-none">Your picture will show here.</div>';
  ['genSave', 'genSaveEdit'].forEach(id => { g(id).disabled = !url; });
}
async function run() {
  if (running) return;
  const s = readSettings(); const prompt = g('genPrompt').value;
  if (s.provider === 'openai' && !await commitKey()) return;
  const btn = g('genGo'); btn.disabled = true; btn.textContent = 'Generating...'; g('genStatus').textContent = '';
  running = new AbortController();
  const timer = setTimeout(() => running && running.abort(), 180000);
  try {
    const apiKey = s.provider === 'openai' ? await getSecret(KEY_NAME) : '';
    const url = await generateImage({ prompt, settings: s, apiKey, signal: running.signal });
    last = { prompt, model: s.provider === 'pollinations' ? 'pollinations/' + s.model : s.provider === 'openai' ? s.openaiModel : s.provider === 'swarmui' ? 'swarmui/' + (s.swarmModel || 'default') : 'comfyui/' + (s.comfyCkpt || 'workflow') };
    showResult(url);
  } catch (e) {
    g('genStatus').textContent = e && e.name === 'AbortError' ? 'Stopped (it took too long or you cancelled).' : (e && e.message) || 'That did not work.';
  } finally { clearTimeout(timer); running = null; btn.disabled = false; btn.textContent = result ? 'Generate again' : 'Generate'; }
}
async function keep(edit) {
  if (!result || !last) return;
  const id = await addPicture({ dataUrl: result, name: last.prompt.slice(0, 40) || 'Generated picture', source: 'generated', prompt: last.prompt, model: last.model });
  if (!id) { toast('Could not keep that picture (is the storage full?).', 'err'); return; }
  toast('Added to the Gallery.', 'ok');
  closeModal('genModal'); refreshLibrary();
  if (edit) wsShowItem('image', id);
}
export function openGenerate(prompt = '') {
  paintSettings(); showResult(null); g('genStatus').textContent = ''; g('genGo').textContent = 'Generate';
  if (prompt) g('genPrompt').value = prompt;
  openModal('genModal');
}
const fillList = (id, names) => { g(id).innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join(''); };
export function wireImageGen() {
  hooks.generate = () => openGenerate();
  migrateOldKey();
  g('genProvider').onchange = () => { readSettings(); paintSettings(); };
  ['genModel', 'genBase', 'genOModel', 'genSwarmUrl', 'genSwarmModel', 'genComfyUrl', 'genComfyCkpt', 'genComfyFlow', 'genSuffix', 'genNeg', 'genSteps', 'genCfg'].forEach(id => g(id).addEventListener('change', () => { readSettings(); g('genPrivacy').textContent = providerNote(S()); }));
  g('genKeyMode').onchange = () => { g('genKeyMode').dataset.mode = g('genKeyMode').value; paintKey(); };
  g('genKeyForget').onclick = () => { forgetSecret(KEY_NAME); paintKey(); toast('The saved key was removed.', 'ok'); };
  g('genSwarmLoad').onclick = async () => { try { const l = await listSwarmModels(readSettings(), (u, o) => secureFetchLocal(u, o)); fillList('genSwarmModels', l); toast(l.length ? `Found ${l.length} models.` : 'No models found.', l.length ? 'ok' : 'warn'); } catch (e) { g('genStatus').textContent = explainNetworkError(e, S().swarmUrl); } };
  g('genComfyLoad').onclick = async () => { try { const l = await listComfyCheckpoints(readSettings(), (u, o) => secureFetchLocal(u, o)); fillList('genComfyCkpts', l); toast(l.length ? `Found ${l.length} checkpoints.` : 'No checkpoints found.', l.length ? 'ok' : 'warn'); } catch (e) { g('genStatus').textContent = explainNetworkError(e, S().comfyUrl); } };
  g('genGo').onclick = run;
  g('genStop').onclick = () => { if (running) running.abort(); };
  g('genSave').onclick = () => keep(false);
  g('genSaveEdit').onclick = () => keep(true);
}
const secureFetchLocal = (u, o) => fetch(u, { credentials: 'omit', referrerPolicy: 'no-referrer', ...(o || {}) });

registerMarkup(192, `<div id="genModal" class="modal">
  <div class="modal-box" style="max-width:660px">
    <div class="modal-head"><h2>Generate a picture</h2><button class="modal-x" data-close="genModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.6rem">
      <textarea class="ftextarea" id="genPrompt" style="min-height:90px" placeholder="Describe the picture: a candle-lit gothic cathedral at dusk, oil painting..."></textarea>
      <div id="genSizes" class="img-presets"></div>
      <div class="pr-row" style="align-items:center"><select class="finput" id="genProvider" style="max-width:230px" aria-label="Provider"></select></div>
      <div id="genP-pollinations"><select class="finput" id="genModel" style="max-width:160px" aria-label="Pollinations model"></select></div>
      <div id="genP-openai" style="display:none;flex-direction:column;gap:.4rem">
        <input class="finput" id="genBase" placeholder="https://api.openai.com/v1" autocomplete="off" aria-label="Endpoint address">
        <input class="finput" id="genOModel" placeholder="Model, like gpt-image-1" autocomplete="off" aria-label="Model">
        <input class="finput" id="genKey" type="password" placeholder="API key" autocomplete="new-password" aria-label="API key">
        <select class="finput" id="genKeyMode" aria-label="What to do with the key"></select>
        <div class="rx-none" id="genKeyState"></div>
        <div class="rx-none" id="genKeyWarn" style="color:var(--warn,#d9a441)"></div>
        <div><button class="btn btn-s btn-sm" id="genKeyForget" type="button">Forget the saved key</button></div>
      </div>
      <div id="genP-swarmui" style="display:none;flex-direction:column;gap:.4rem">
        <input class="finput" id="genSwarmUrl" placeholder="http://localhost:7801" autocomplete="off" aria-label="SwarmUI address">
        <div class="pr-row"><input class="finput" id="genSwarmModel" list="genSwarmModels" placeholder="Model (optional)" autocomplete="off" aria-label="SwarmUI model" style="flex:1"><datalist id="genSwarmModels"></datalist><button class="btn btn-s btn-sm" id="genSwarmLoad" type="button">Load models</button></div>
      </div>
      <div id="genP-comfyui" style="display:none;flex-direction:column;gap:.4rem">
        <input class="finput" id="genComfyUrl" placeholder="http://127.0.0.1:8188" autocomplete="off" aria-label="ComfyUI address">
        <div class="pr-row"><input class="finput" id="genComfyCkpt" list="genComfyCkpts" placeholder="Checkpoint" autocomplete="off" aria-label="ComfyUI checkpoint" style="flex:1"><datalist id="genComfyCkpts"></datalist><button class="btn btn-s btn-sm" id="genComfyLoad" type="button">Load models</button></div>
        <details><summary class="rx-none" style="cursor:pointer">Use my own workflow (optional)</summary>
          <textarea class="ftextarea" id="genComfyFlow" style="min-height:110px;margin-top:.4rem" placeholder='Paste a workflow saved with "Save (API Format)". Use %prompt% %negative% %seed% %width% %height% %steps% %cfg% %ckpt% as whole values; %image% and %strength% for edits.' aria-label="ComfyUI workflow"></textarea></details>
      </div>
      <div id="genAdv" class="pr-row" style="align-items:center;display:none">
        <input class="finput" id="genNeg" placeholder="Negative prompt (optional)" autocomplete="off" aria-label="Negative prompt" style="flex:1;min-width:180px">
        <label class="rx-none">Steps <input class="finput" id="genSteps" type="number" min="1" max="150" style="width:70px"></label>
        <label class="rx-none">CFG <input class="finput" id="genCfg" type="number" min="0" max="30" step="0.5" style="width:70px"></label>
      </div>
      <input class="finput" id="genSuffix" placeholder="Always add this style to prompts (optional)" autocomplete="off" aria-label="Style added to every prompt">
      <div class="rx-none" id="genPrivacy"></div>
      <div class="gen-result" id="genResult"></div>
      <div class="rx-none" id="genStatus" role="status" style="color:var(--err,#e66)"></div>
      <div class="pr-row">
        <button class="btn btn-p btn-sm" id="genGo">Generate</button>
        <button class="btn btn-s btn-sm" id="genStop">Stop</button>
        <button class="btn btn-ok btn-sm" id="genSave" disabled>Add to Gallery</button>
        <button class="btn btn-s btn-sm" id="genSaveEdit" disabled>Add and edit</button>
      </div>
    </div>
  </div>
</div>`);
