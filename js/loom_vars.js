// ═══════════════════════════════════════════════════════
// LOOM PROMPT VARIABLES — the settings a Loom Preset's author builds for its users.
//
// A variable lives on a block: block.variables = [{ id, name, label, description, type, defaultValue,
// options: [{ id, label, value }], min, max, step, rows, separator }]. Types: text, textarea, number,
// slider, select (dropdown), switch (on / off), multiselect.
// What the user picked is saved in the preset: promptVariables = { [blockId]: { [name]: value } }.
// A dropdown stores the option's id; "switch" stores 1 or 0; multi-select stores a list of option ids.
// Only variables of blocks that are switched on are shown, like Lumiverse does.
//
// After import the blocks sit in preset.prompts[i].lumiverse.rest.variables and the picked values in
// preset.extensions.lumiverse.promptVariables, so everything survives the trip back to Lumiverse.
// ═══════════════════════════════════════════════════════
import { state } from './state.js';
import { savePreset } from './preset.js';
import { closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';

export const VAR_TYPES = [
  ['text', 'Text'], ['textarea', 'Text area'], ['number', 'Number'], ['slider', 'Slider'],
  ['select', 'Dropdown'], ['switch', 'On / off'], ['multiselect', 'Multi-select'],
];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export const hasLoom = preset => !!(preset && preset.extensions && isObj(preset.extensions.lumiverse));

function lumiOf(prompt) {
  if (!isObj(prompt.lumiverse)) prompt.lumiverse = {};
  if (!isObj(prompt.lumiverse.rest)) prompt.lumiverse.rest = {};
  return prompt.lumiverse;
}
export const defsOf = prompt => (isObj(prompt.lumiverse) && isObj(prompt.lumiverse.rest) && Array.isArray(prompt.lumiverse.rest.variables) ? prompt.lumiverse.rest.variables.filter(isObj) : []);
function valuesStore(preset) {
  if (!isObj(preset.extensions)) preset.extensions = {};
  if (!isObj(preset.extensions.lumiverse)) preset.extensions.lumiverse = {};
  const l = preset.extensions.lumiverse;
  if (!isObj(l.promptVariables)) l.promptVariables = {};
  return l.promptVariables;
}
const blockKey = p => (isObj(p.lumiverse) && p.lumiverse.id) || p.id || p.identifier;

// [{ prompt, key, defs }] for every block that has variables (all of them, or only the switched-on ones)
export function variableBlocks(preset, { onlyEnabled = false } = {}) {
  return (preset.prompts || []).filter(p => defsOf(p).length && (!onlyEnabled || p.enabled !== false))
    .map(p => ({ prompt: p, key: blockKey(p), defs: defsOf(p) }));
}

export function defaultFor(def) {
  if (def.defaultValue !== undefined && def.defaultValue !== null) return def.defaultValue;
  if (def.type === 'switch') return 0;
  if (def.type === 'multiselect') return [];
  if (def.type === 'number' || def.type === 'slider') return def.min !== undefined ? def.min : 0;
  return '';
}
export function valueOf(preset, key, def) {
  const saved = ((valuesStore(preset)[key]) || {})[def.name];
  return saved === undefined ? defaultFor(def) : saved;
}
export function setValue(preset, key, def, value) {
  const store = valuesStore(preset);
  if (!isObj(store[key])) store[key] = {};
  store[key][def.name] = value;
}
export function resetValues(preset) { valuesStore(preset); preset.extensions.lumiverse.promptVariables = {}; }

// What the variable turns into inside the prompt text
export function resolveVar(def, value) {
  const opts = Array.isArray(def.options) ? def.options.filter(isObj) : [];
  if (def.type === 'select') { const o = opts.find(x => x.id === value); return o ? String(o.value ?? '') : ''; }
  if (def.type === 'switch') return value ? '1' : '0';
  if (def.type === 'multiselect') {
    const on = new Set(Array.isArray(value) ? value : []);
    return opts.filter(o => on.has(o.id)).map(o => String(o.value ?? '')).join(def.separator === undefined ? '\n\n' : def.separator);
  }
  return value === undefined || value === null ? '' : String(value);
}

const newUid = () => (crypto.randomUUID ? crypto.randomUUID() : 'v' + Date.now() + Math.floor(Math.random() * 1e6));
export function blankVariable(name = 'my_setting') {
  return { id: newUid(), name, label: 'My setting', description: '', type: 'text', defaultValue: '' };
}
export const validName = n => /^[A-Za-z0-9_]+$/.test(String(n || ''));

// ── UI ──
const cur = () => state.presetLibrary[state.activePresetId];
let host = null;
function save() { savePreset({ silent: true, noHistory: true }); }

function control(preset, key, def) {
  const v = valueOf(preset, key, def);
  const set = val => { setValue(preset, key, def, val); save(); };
  const id = 'lv-' + key + '-' + def.name;
  const opts = Array.isArray(def.options) ? def.options.filter(isObj) : [];
  let el;
  if (def.type === 'switch') {
    el = document.createElement('label'); el.className = 'cb-row';
    el.innerHTML = '<input type="checkbox" id="' + esc(id) + '"' + (v ? ' checked' : '') + '><span class="flabel-sm">' + (v ? 'On' : 'Off') + '</span>';
    el.firstChild.onchange = e => { set(e.target.checked ? 1 : 0); el.lastChild.textContent = e.target.checked ? 'On' : 'Off'; };
  } else if (def.type === 'select') {
    el = document.createElement('select'); el.className = 'fselect'; el.id = id;
    opts.forEach(o => { const op = document.createElement('option'); op.value = o.id; op.textContent = o.label || o.id; op.selected = o.id === v; el.append(op); });
    el.onchange = e => set(e.target.value);
  } else if (def.type === 'multiselect') {
    el = document.createElement('div'); el.className = 'pr-chips';
    const on = new Set(Array.isArray(v) ? v : []);
    opts.forEach(o => {
      const l = document.createElement('label'); l.className = 'pr-chip' + (on.has(o.id) ? ' on' : '');
      l.innerHTML = '<input type="checkbox"' + (on.has(o.id) ? ' checked' : '') + '>' + esc(o.label || o.id);
      l.firstChild.onchange = e => { if (e.target.checked) on.add(o.id); else on.delete(o.id); l.classList.toggle('on', e.target.checked); set(opts.filter(x => on.has(x.id)).map(x => x.id)); };
      el.append(l);
    });
  } else if (def.type === 'textarea') {
    el = document.createElement('textarea'); el.className = 'ftextarea'; el.id = id; el.rows = Number(def.rows) || 3; el.value = v;
    el.oninput = e => set(e.target.value);
  } else if (def.type === 'slider') {
    el = document.createElement('div'); el.className = 'pr-row';
    const r = document.createElement('input'); r.type = 'range'; r.id = id;
    r.min = def.min ?? 0; r.max = def.max ?? 100; r.step = def.step ?? 1; r.value = v;
    const n = document.createElement('input'); n.type = 'number'; n.className = 'fnum'; n.min = r.min; n.max = r.max; n.step = r.step; n.value = v;
    r.oninput = () => { n.value = r.value; set(Number(r.value)); };
    n.oninput = () => { if (n.value !== '') { r.value = n.value; set(Number(n.value)); } };
    el.append(r, n);
  } else {
    el = document.createElement('input'); el.id = id; el.className = def.type === 'number' ? 'finput fnum' : 'finput';
    el.type = def.type === 'number' ? 'number' : 'text'; el.value = v;
    if (def.type === 'number') { if (def.min !== undefined) el.min = def.min; if (def.max !== undefined) el.max = def.max; if (def.step !== undefined) el.step = def.step; }
    el.oninput = e => set(def.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value);
  }
  return el;
}

function defEditor(preset, b) {
  const det = document.createElement('details'); det.className = 'lv-defs';
  const sum = document.createElement('summary'); sum.textContent = 'Edit the settings of this block (JSON)'; det.append(sum);
  const ta = document.createElement('textarea'); ta.className = 'ftextarea rx-mono'; ta.style.minHeight = '120px'; ta.spellcheck = false;
  ta.value = JSON.stringify(defsOf(b.prompt), null, 2);
  const err = document.createElement('div'); err.className = 'rx-err';
  const ok = document.createElement('button'); ok.className = 'btn btn-s btn-sm'; ok.textContent = 'Apply';
  ok.onclick = () => {
    try {
      const arr = JSON.parse(ta.value);
      if (!Array.isArray(arr) || !arr.every(x => isObj(x) && validName(x.name) && VAR_TYPES.some(t => t[0] === x.type))) throw new Error('Needs a list of settings, each with a name (letters, numbers, _) and a type: ' + VAR_TYPES.map(t => t[0]).join(', '));
      const names = arr.map(x => x.name); if (new Set(names).size !== names.length) throw new Error('Two settings have the same name.');
      arr.forEach(x => { if (!x.id) x.id = newUid(); });
      lumiOf(b.prompt).rest.variables = arr; save(); render();
    } catch (e) { err.textContent = e.message; }
  };
  det.append(ta, err, ok);
  return det;
}

function render() {
  const p = cur(); if (!p || !host) return;
  const preset = p.preset;
  const shown = variableBlocks(preset, { onlyEnabled: true });
  const all = variableBlocks(preset);
  host.innerHTML = '';
  if (!all.length) {
    const e = document.createElement('div'); e.className = 'rx-none'; e.textContent = 'No settings yet. Add one below, then use it in a prompt as {{var::name}}.'; host.append(e);
  } else if (!shown.length) {
    const e = document.createElement('div'); e.className = 'rx-none'; e.textContent = 'The blocks that have settings are all switched off.'; host.append(e);
  }
  shown.forEach(b => {
    const card = document.createElement('div'); card.className = 'lv-block';
    const h = document.createElement('div'); h.className = 'pr-lbl'; h.textContent = b.prompt.name || 'Block'; card.append(h);
    b.defs.forEach(def => {
      const row = document.createElement('div'); row.className = 'lv-var'; row.dataset.lvVar = def.name;
      const lbl = document.createElement('label'); lbl.className = 'flabel-sm'; lbl.textContent = def.label || def.name;
      const code = document.createElement('code'); code.textContent = ' {{var::' + def.name + '}}'; lbl.append(code);
      row.append(lbl);
      if (def.description) { const d = document.createElement('div'); d.className = 'rx-none'; d.textContent = def.description; row.append(d); }
      row.append(control(preset, b.key, def));
      card.append(row);
    });
    host.append(card);
  });
  // authoring
  const edit = document.createElement('div'); edit.className = 'lv-edit';
  all.forEach(b => {
    const w = document.createElement('div'); const t = document.createElement('div'); t.className = 'flabel-sm'; t.textContent = b.prompt.name; w.append(t, defEditor(preset, b)); edit.append(w);
  });
  const add = document.createElement('div'); add.className = 'pr-row';
  const sel = document.createElement('select'); sel.className = 'fselect'; sel.id = 'lvAddBlock';
  (preset.prompts || []).filter(x => !x.marker).forEach(x => { const o = document.createElement('option'); o.value = x.identifier; o.textContent = x.name || x.identifier; sel.append(o); });
  const btn = document.createElement('button'); btn.className = 'btn btn-s btn-sm'; btn.id = 'lvAddBtn'; btn.textContent = '+ Add a setting to this block';
  btn.onclick = () => {
    const pr = (preset.prompts || []).find(x => x.identifier === sel.value); if (!pr) return;
    const l = lumiOf(pr); if (!l.id) l.id = pr.id || pr.identifier;
    const names = new Set(defsOf(pr).map(d => d.name)); let n = 1, nm = 'my_setting'; while (names.has(nm)) nm = 'my_setting_' + (++n);
    l.rest.variables = [...defsOf(pr), blankVariable(nm)]; save(); render();
  };
  add.append(sel, btn);
  edit.append(add);
  host.append(edit);
}

export function openLoomVars() {
  const p = cur(); if (!p) return;
  if (!p.preset.extensions || !isObj(p.preset.extensions)) p.preset.extensions = {};
  host = g('loomVarsBody');
  render();
  openModal('loomVarsModal');
}

export function wireLoomVars() {
  const b = g('psLoomVarsBtn'); if (b) b.onclick = openLoomVars;
  const r = g('loomVarsReset');
  if (r) r.onclick = () => { const p = cur(); if (!p) return; resetValues(p.preset); save(); render(); toast('Settings are back to their defaults.', 'ok'); };
}

registerMarkup(187, `<div id="loomVarsModal" class="modal">
  <div class="modal-box" style="max-width:560px">
    <div class="modal-head"><h2>Preset settings</h2><button class="modal-x" data-close="loomVarsModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.75rem">
      <div class="rx-none">Settings the author of this Loom Preset made for you. Only blocks that are switched on show up. Use a setting inside a prompt as <code>{{var::name}}</code>.</div>
      <div id="loomVarsBody" style="display:flex;flex-direction:column;gap:.9rem"></div>
      <div class="pr-row"><button class="btn btn-s btn-sm" id="loomVarsReset">Reset all to default</button><button class="btn btn-p btn-sm" data-close="loomVarsModal">Done</button></div>
    </div>
  </div>
</div>`);
