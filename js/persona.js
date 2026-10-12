// ═══════════════════════════════════════════════════════
// PERSONAS — who you are in a story ({{user}}). A Library item with its own small editor,
// not a workshop tab: a persona is short, so it opens in a focused dialog from the Library.
//
//   state.personaLibrary = { [id]: { id, name, persona: { title, description, avatar }, savedAt } }
//
// Which world a persona belongs to (and its tags) lives in the Library organisation layer (meta.js).
// ═══════════════════════════════════════════════════════
import { downscaleAvatar } from './avatar.js';
import { state } from './state.js';
import { savePersonaLibrary } from './storage.js';
import { registerTrashRestorer, trashPush } from './trash.js';
import { askConfirm, closeModal, dlFile, g, openModal, registerMarkup, safeFileName, toast } from './util.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const personaId = () => 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

export function blankPersona() { return { title: '', description: '', avatar: '' }; }
export function normalizePersona(p) {
  const o = isObj(p) ? p : {};
  return { title: typeof o.title === 'string' ? o.title : '', description: typeof o.description === 'string' ? o.description : '', avatar: typeof o.avatar === 'string' ? o.avatar : '' };
}

let onChange = () => {};
export const setPersonaListener = fn => { onChange = typeof fn === 'function' ? fn : () => {}; };

export function createPersona(name = 'New persona', persona = null) {
  const id = personaId();
  state.personaLibrary[id] = { id, name, persona: normalizePersona(persona || blankPersona()), savedAt: new Date().toISOString() };
  savePersonaLibrary(); onChange();
  return id;
}
export function duplicatePersona(id) {
  const src = state.personaLibrary[id]; if (!src) return null;
  return createPersona((src.name || 'Persona') + ' (Copy)', JSON.parse(JSON.stringify(src.persona)));
}
export async function deletePersona(id) {
  const e = state.personaLibrary[id]; if (!e) return false;
  if (!await askConfirm('Delete this persona? You can bring it back from Settings > Storage > Recently deleted.')) return false;
  trashPush('persona', e.name || 'Persona', e);
  delete state.personaLibrary[id];
  if (state.activePersonaId === id) { state.activePersonaId = null; closeModal('personaModal'); }
  savePersonaLibrary(); onChange();
  return true;
}
export function personaToJson(entry) {
  return JSON.stringify({ format: 'loreos-persona', version: 1, name: entry.name, persona: entry.persona }, null, 2);
}
export function parsePersonaJson(text) {
  let d; try { d = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
  if (isObj(d) && d.format === 'loreos-persona' && isObj(d.persona)) return { name: String(d.name || 'Imported persona'), persona: normalizePersona(d.persona) };
  // a bare { name, description }
  if (isObj(d) && typeof d.description === 'string' && (typeof d.name === 'string' || typeof d.title === 'string')) return { name: String(d.name || d.title), persona: normalizePersona(d) };
  throw new Error('That does not look like a persona.');
}
export function importPersonaText(text) {
  const { name, persona } = parsePersonaJson(text);
  return createPersona(name, persona);
}

// ── The dialog ──
let saveTimer = null;
const cur = () => state.personaLibrary[state.activePersonaId];
function commit(immediate = false) {
  const e = cur(); if (!e) return;
  e.name = g('personaName').value.trim() || 'Untitled persona';
  e.persona.title = g('personaTitle').value;
  e.persona.description = g('personaDesc').value;
  e.savedAt = new Date().toISOString();
  const run = () => { saveTimer = null; savePersonaLibrary(); onChange(); };
  clearTimeout(saveTimer);
  if (immediate) run(); else saveTimer = setTimeout(run, 400);
}
export function flushPersona() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; savePersonaLibrary(); onChange(); } }

function paintAvatar() {
  const e = cur(); const box = g('personaAvatar'); if (!e || !box) return;
  box.innerHTML = '';
  if (e.persona.avatar) { const im = document.createElement('img'); im.src = e.persona.avatar; im.alt = ''; box.append(im); } else box.textContent = '☺︎';
  g('personaAvatarClear').style.display = e.persona.avatar ? '' : 'none';
}

export function openPersona(id) {
  const e = state.personaLibrary[id]; if (!e) return;
  flushPersona();
  state.activePersonaId = id;
  g('personaName').value = e.name || '';
  g('personaTitle').value = e.persona.title || '';
  g('personaDesc').value = e.persona.description || '';
  updateCount(); paintAvatar();
  openModal('personaModal');
}
function updateCount() { const t = g('personaDesc').value; g('personaCount').textContent = t.length + ' characters · about ' + Math.ceil(t.length / 4) + ' tokens'; }

export function wirePersona() {
  ['personaName', 'personaTitle', 'personaDesc'].forEach(id => g(id).addEventListener('input', () => { commit(); updateCount(); }));
  g('personaAvatarBtn').onclick = () => g('personaAvatarFile').click();
  g('personaAvatarFile').onchange = ev => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      const e = cur(); if (!e) return;
      e.persona.avatar = await Promise.resolve(downscaleAvatar(String(r.result)));
      commit(true); paintAvatar();
    };
    r.readAsDataURL(f); ev.target.value = '';
  };
  g('personaAvatarClear').onclick = () => { const e = cur(); if (!e) return; e.persona.avatar = ''; commit(true); paintAvatar(); };
  g('personaExport').onclick = () => { const e = cur(); if (!e) return; commit(true); dlFile(personaToJson(e), safeFileName(e.name, 'persona') + '.persona.json', 'application/json'); toast('Exported the persona.', 'ok'); };
  g('personaDelete').onclick = () => { deletePersona(state.activePersonaId); };
  g('personaDone').onclick = () => { commit(true); closeModal('personaModal'); };
  g('personaImportFile').onchange = ev => {
    const files = [...(ev.target.files || [])];
    files.forEach(f => { const r = new FileReader(); r.onload = () => { try { importPersonaText(String(r.result)); toast('Imported the persona.', 'ok'); } catch (err) { toast('Import failed: ' + err.message, 'err'); } }; r.readAsText(f); });
    ev.target.value = '';
  };
}

registerMarkup(76, `<input type="file" id="personaImportFile" accept=".json" multiple style="display:none">`);
registerMarkup(188, `<div id="personaModal" class="modal">
  <div class="modal-box" style="max-width:560px">
    <div class="modal-head"><h2>Persona</h2><button class="modal-x" data-close="personaModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.7rem">
      <div class="pr-row" style="align-items:center">
        <div id="personaAvatar" class="persona-avatar"></div>
        <div style="display:flex;flex-direction:column;gap:.35rem">
          <button class="btn btn-s btn-sm" id="personaAvatarBtn">Choose a picture</button>
          <button class="btn btn-s btn-sm" id="personaAvatarClear">Remove picture</button>
          <input type="file" id="personaAvatarFile" accept="image/*" style="display:none">
        </div>
      </div>
      <label class="pr-lbl" for="personaName">Name</label>
      <input class="finput" id="personaName" placeholder="Who you are in the story">
      <label class="pr-lbl" for="personaTitle">Label (optional)</label>
      <input class="finput" id="personaTitle" placeholder="A short note to tell personas apart, like 'detective AU'">
      <label class="pr-lbl" for="personaDesc">Description</label>
      <textarea class="ftextarea" id="personaDesc" style="min-height:170px" placeholder="What the bot should know about {{user}}: looks, personality, background..."></textarea>
      <div class="rx-none" id="personaCount"></div>
      <div class="pr-row">
        <button class="btn btn-p btn-sm" id="personaDone">Done</button>
        <button class="btn btn-s btn-sm" id="personaExport">Export</button>
        <button class="btn btn-err btn-sm" id="personaDelete">Delete</button>
      </div>
    </div>
  </div>
</div>`);

registerTrashRestorer('persona', data => {
  const id = data.id && !state.personaLibrary[data.id] ? data.id : personaId();
  state.personaLibrary[id] = { ...data, id };
  savePersonaLibrary(); onChange();
});
