// ═══════════════════════════════════════════════════════
// IMAGE GENERATION — make a picture from a text prompt and keep it in the Gallery.
//
// Two kinds of provider:
//   Pollinations           free, no account or key. A prompt is sent in a web address.
//   OpenAI-compatible      your own endpoint (OpenAI, or any server that speaks POST /images/generations):
//                          base URL + API key + model.
//
// The prompt, and for the second kind your key, leave this device when you press Generate. The settings
// (including the key) are kept only in this browser; they are never part of backups or Drive sync.
// ═══════════════════════════════════════════════════════
import { addPicture, hooks } from './gallery.js';
import { closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import { refreshLibrary } from './library_view.js';
import { wsShowItem } from './workshop.js';

export const GEN_KEY = 'loreos_imagegen';
export const SIZES = [['Square', 1024, 1024], ['Portrait', 768, 1024], ['Landscape', 1024, 768], ['Wide', 1280, 720], ['Tall', 720, 1280]];
export const POLLINATIONS_MODELS = ['flux', 'turbo', 'gptimage'];
export const DEFAULTS = Object.freeze({ provider: 'pollinations', model: 'flux', size: 0, baseUrl: 'https://api.openai.com/v1', apiKey: '', openaiModel: 'gpt-image-1', suffix: '' });

export function loadGenSettings() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(GEN_KEY) || '{}') || {}; } catch (e) { /* first run */ }
  const out = { ...DEFAULTS };
  if (o.provider === 'pollinations' || o.provider === 'openai') out.provider = o.provider;
  ['model', 'baseUrl', 'apiKey', 'openaiModel', 'suffix'].forEach(k => { if (typeof o[k] === 'string') out[k] = o[k].slice(0, 400); });
  if (Number.isInteger(o.size) && SIZES[o.size]) out.size = o.size;
  return out;
}
export function saveGenSettings(s) { try { localStorage.setItem(GEN_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }

const blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Could not read the picture.')); r.readAsDataURL(blob); });
export const cleanBase = u => String(u || '').trim().replace(/\/+$/, '');
export const isHttp = u => /^https?:\/\//i.test(String(u || ''));

export function pollinationsUrl(prompt, { model, w, h, seed }) {
  const q = new URLSearchParams({ width: String(w), height: String(h), model: model || 'flux', nologo: 'true', private: 'true', seed: String(seed) });
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?' + q.toString();
}

// Returns a data URL. `fetchFn` is injectable so the request shapes can be tested without a network.
export async function generateImage({ prompt, settings, fetchFn = (...a) => fetch(...a), signal, seed = Math.floor(Math.random() * 1e9) }) {
  const text = String(prompt || '').trim();
  if (!text) throw new Error('Write a prompt first.');
  const full = (text + (settings.suffix ? ', ' + settings.suffix : '')).slice(0, 3000);
  const [, w, h] = SIZES[settings.size] || SIZES[0];
  if (settings.provider === 'pollinations') {
    const res = await fetchFn(pollinationsUrl(full, { model: settings.model, w, h, seed }), { signal });
    if (!res.ok) throw new Error('Pollinations answered ' + res.status + '.');
    const blob = await res.blob();
    if (!/^image\//.test(blob.type)) throw new Error('Pollinations did not send a picture.');
    return blobToDataUrl(blob);
  }
  const base = cleanBase(settings.baseUrl);
  if (!isHttp(base)) throw new Error('Set the endpoint address (it starts with https://).');
  if (!settings.apiKey.trim()) throw new Error('Add your API key in the settings first.');
  const res = await fetchFn(base + '/images/generations', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.apiKey.trim() },
    body: JSON.stringify({ model: settings.openaiModel, prompt: full, n: 1, size: w + 'x' + h }),
  });
  let data = null; try { data = await res.json(); } catch (e) { /* not json */ }
  if (!res.ok) throw new Error((data && data.error && (data.error.message || data.error)) ? String(data.error.message || data.error).slice(0, 200) : 'The endpoint answered ' + res.status + '.');
  const item = data && Array.isArray(data.data) ? data.data[0] : null;
  if (item && item.b64_json) return 'data:image/png;base64,' + item.b64_json;
  if (item && isHttp(item.url)) {
    const r2 = await fetchFn(item.url, { signal });
    if (!r2.ok) throw new Error('Could not download the generated picture (' + r2.status + ').');
    return blobToDataUrl(await r2.blob());
  }
  throw new Error('The endpoint did not return a picture.');
}

// ── The dialog ──
let result = null, running = null, last = null;
const S = () => loadGenSettings();

function paintSettings() {
  const s = S();
  g('genProvider').value = s.provider;
  g('genModel').innerHTML = (s.provider === 'pollinations' ? POLLINATIONS_MODELS : []).map(m => `<option value="${m}"${m === s.model ? ' selected' : ''}>${m}</option>`).join('');
  g('genModelWrap').style.display = s.provider === 'pollinations' ? '' : 'none';
  g('genOpenAi').style.display = s.provider === 'openai' ? 'flex' : 'none';
  g('genBase').value = s.baseUrl; g('genKey').value = s.apiKey; g('genOModel').value = s.openaiModel; g('genSuffix').value = s.suffix;
  g('genSizes').innerHTML = SIZES.map((z, i) => `<button class="img-preset${s.size === i ? ' active' : ''}" data-gensize="${i}">${z[0]} <span class="rx-none">${z[1]}×${z[2]}</span></button>`).join('');
  g('genSizes').querySelectorAll('[data-gensize]').forEach(b => b.onclick = () => { const n = S(); n.size = Number(b.dataset.gensize); saveGenSettings(n); paintSettings(); });
  g('genPrivacy').textContent = s.provider === 'pollinations'
    ? 'Your prompt is sent to Pollinations (image.pollinations.ai). No account or key needed.'
    : 'Your prompt and API key are sent to the endpoint above. The key is stored only in this browser, never in backups or Drive.';
}
function readSettings() {
  const s = S();
  s.provider = g('genProvider').value === 'openai' ? 'openai' : 'pollinations';
  if (g('genModel').value) s.model = g('genModel').value;
  s.baseUrl = g('genBase').value; s.apiKey = g('genKey').value; s.openaiModel = g('genOModel').value.trim() || DEFAULTS.openaiModel; s.suffix = g('genSuffix').value.trim();
  saveGenSettings(s); return s;
}
function showResult(url) {
  result = url;
  const box = g('genResult');
  box.innerHTML = url ? `<img src="${esc(url)}" alt="Generated picture">` : '<div class="rx-none">Your picture will show here.</div>';
  ['genSave', 'genSaveEdit'].forEach(id => { g(id).disabled = !url; });
}
async function run() {
  if (running) return;
  const s = readSettings(); const prompt = g('genPrompt').value;
  const btn = g('genGo'); btn.disabled = true; btn.textContent = 'Generating...'; g('genStatus').textContent = '';
  running = new AbortController();
  const timer = setTimeout(() => running && running.abort(), 120000);
  try {
    const url = await generateImage({ prompt, settings: s, signal: running.signal });
    last = { prompt, model: s.provider === 'pollinations' ? 'pollinations/' + s.model : s.openaiModel };
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
export function wireImageGen() {
  hooks.generate = () => openGenerate();
  g('genProvider').onchange = () => { readSettings(); paintSettings(); };
  ['genModel', 'genBase', 'genKey', 'genOModel', 'genSuffix'].forEach(id => g(id).addEventListener('change', readSettings));
  g('genGo').onclick = run;
  g('genStop').onclick = () => { if (running) running.abort(); };
  g('genSave').onclick = () => keep(false);
  g('genSaveEdit').onclick = () => keep(true);
}

registerMarkup(192, `<div id="genModal" class="modal">
  <div class="modal-box" style="max-width:640px">
    <div class="modal-head"><h2>Generate a picture</h2><button class="modal-x" data-close="genModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.6rem">
      <textarea class="ftextarea" id="genPrompt" style="min-height:90px" placeholder="Describe the picture: a candle-lit gothic cathedral at dusk, oil painting..."></textarea>
      <div id="genSizes" class="img-presets"></div>
      <div class="pr-row" style="align-items:center">
        <select class="finput" id="genProvider" style="max-width:220px"><option value="pollinations">Pollinations (free)</option><option value="openai">OpenAI-compatible</option></select>
        <span id="genModelWrap"><select class="finput" id="genModel" style="max-width:140px"></select></span>
      </div>
      <div id="genOpenAi" style="display:none;flex-direction:column;gap:.4rem">
        <input class="finput" id="genBase" placeholder="https://api.openai.com/v1" autocomplete="off">
        <input class="finput" id="genKey" type="password" placeholder="API key" autocomplete="off">
        <input class="finput" id="genOModel" placeholder="Model, like gpt-image-1" autocomplete="off">
      </div>
      <input class="finput" id="genSuffix" placeholder="Always add this style to prompts (optional)" autocomplete="off">
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

