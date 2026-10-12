// ═══════════════════════════════════════════════════════
// REGEX SETS — the Regex tab.
// Write and test SillyTavern regex scripts: a live tester shows what each script does to
// sample text, scripts export as SillyTavern files, and a set can be copied in from or
// sent to a character card or a preset. The engine and file format live in regex_model.js.
// ═══════════════════════════════════════════════════════
import { itemHistoryPush, openItemHistory } from './history.js';
import { closeMobSidebar } from './mobile.js';
import {
  PLACEMENTS, SUBSTITUTE_MODES, VIEWS, blankScript, blankSet, highlight, normalizeSet, newId, parseRegexJson,
  lumiRegexFileJson, runPipeline, scriptToJson, scriptsForEmbedding, setToJson,
} from './regex_model.js';
import { state } from './state.js';
import { saveCharLibrary, savePresetLibrary, saveRegexLibrary } from './storage.js';
import { registerTrashRestorer, trashPush } from './trash.js';
import { askConfirm, closeModal, dlFile, esc, g, openModal, registerMarkup, safeFileName, toast } from './util.js';
import { commitActiveEditor, wsDropItem, wsMarkSaved, wsShowItem } from './workshop.js';

export function regexId() { return 'x' + Date.now() + Math.floor(Math.random() * 1000); }

// ═══════════════════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════════════════
export function createRegex(name = 'New regex set', set = null) {
  const id = regexId();
  state.regexLibrary[id] = { id, name, set: normalizeSet(set || blankSet()), savedAt: new Date().toISOString() };
  saveRegexLibrary();
  renderRegexSidebar();
  if (!wsShowItem('regex', id)) openRegex(id);
  return id;
}

export function openRegex(id) {
  if (state.activeRegexId && state.activeRegexId !== id) commitActiveEditor();
  state.regexUnsaved = false;
  state.activeRegexId = id;
  const e = state.regexLibrary[id];
  state.regexOpen = e && e.set.scripts[0] ? e.set.scripts[0].id : null;
  renderRegexSidebar();
  renderRegexEditor();
}

export function duplicateRegex(id) {
  const src = state.regexLibrary[id]; if (!src) return;
  const set = JSON.parse(JSON.stringify(src.set));
  set.scripts.forEach(s => { s.id = newId(); });
  createRegex((src.name || 'Untitled') + ' (Copy)', set);
}

export async function deleteRegex(id) {
  if (!await askConfirm('Delete this regex set? You can bring it back from Settings > Storage > Recently deleted.')) return;
  if (state.regexLibrary[id]) trashPush('regex', state.regexLibrary[id].name || 'Unnamed set', state.regexLibrary[id]);
  delete state.regexLibrary[id];
  wsDropItem('regex', id);
  if (state.activeRegexId === id) state.activeRegexId = null;
  saveRegexLibrary(); renderRegexSidebar(); renderRegexEditor();
}

export function saveRegex({ silent = false, noHistory = false } = {}) {
  const id = state.activeRegexId;
  const entry = id && state.regexLibrary[id];
  if (!entry) return false;
  entry.savedAt = new Date().toISOString();
  if (!saveRegexLibrary()) return false;
  state.regexUnsaved = false;
  wsMarkSaved('regex', id);
  if (!noHistory) itemHistoryPush('regex', id, JSON.parse(JSON.stringify(entry)));
  if (!silent) toast('Saved.', 'ok');
  renderRegexSidebar();
  return true;
}

function touch() { state.regexUnsaved = true; }

export function renderRegexSidebar() {
  const list = g('entryList'), count = g('entryCount');
  const sets = Object.values(state.regexLibrary).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  count.textContent = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  list.innerHTML = '';
  if (!sets.length) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:1.2rem .75rem;text-align:center;font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:1px';
    li.textContent = 'no regex sets yet';
    list.append(li); return;
  }
  sets.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'ei' + (entry.id === state.activeRegexId ? ' open' : '');
    const head = document.createElement('div'); head.className = 'ei-head';
    const emoji = document.createElement('span'); emoji.className = 'ei-emoji'; emoji.textContent = '⌕';
    const name = document.createElement('div'); name.className = 'ei-name'; name.textContent = entry.name || 'Untitled set';
    head.append(emoji, name); li.append(head);
    const acts = document.createElement('div'); acts.className = 'ei-acts';
    [['⧉', 'Duplicate', () => duplicateRegex(entry.id), ''], ['✕', 'Delete', () => deleteRegex(entry.id), 'del']].forEach(([lbl, title, fn, cls]) => {
      const b = document.createElement('button');
      b.className = 'ei-act' + (cls ? ' ' + cls : ''); b.title = title; b.textContent = lbl;
      b.addEventListener('click', e2 => { e2.stopPropagation(); fn(); });
      acts.append(b);
    });
    li.append(acts);
    const meta = document.createElement('div'); meta.className = 'ei-kws';
    const sc = (entry.set && entry.set.scripts) || [];
    [`${sc.length} script${sc.length === 1 ? '' : 's'}`, `${sc.filter(s => !s.disabled).length} on`].forEach(t => {
      const tag = document.createElement('span'); tag.className = 'kw-tag'; tag.textContent = t; meta.append(tag);
    });
    li.append(meta);
    li.addEventListener('click', () => { if (!wsShowItem('regex', entry.id)) openRegex(entry.id); closeMobSidebar(); });
    list.append(li);
  });
}

// ═══════════════════════════════════════════════════════
// EDITOR
// ═══════════════════════════════════════════════════════
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === false || v === null || v === undefined) return;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  kids.flat().forEach(k => { if (k !== null && k !== undefined && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k))); });
  return el;
}
function swap(arr, i, j) { if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

function current() {
  const id = state.activeRegexId;
  const entry = id && state.regexLibrary[id];
  return entry ? { id, entry, set: entry.set } : null;
}

export function renderRegexEditor() {
  const ec = g('editorContent');
  g('tabBar').innerHTML = '';
  const cur = current();
  if (!cur) {
    ec.className = '';
    ec.innerHTML = `<div class="empty-state"><div>// select or create a regex set</div><button class="btn btn-ok" id="rxNewAlt">+ New Regex Set</button></div>`;
    g('rxNewAlt').onclick = () => createRegex();
    return;
  }
  const { entry, set } = cur;
  ec.className = '';
  ec.innerHTML = '';
  const wrap = h('div', { class: 'pr-wrap' });
  wrap.append(h('div', { class: 'pr-top' },
    h('input', { id: 'rxName', class: 'finput pr-name', value: entry.name || '', placeholder: 'Set name', oninput: e => { entry.name = e.target.value; touch(); } }),
    h('div', { class: 'pr-top-acts' },
      h('button', { class: 'btn btn-p btn-sm', id: 'rxSaveBtn', onclick: () => saveRegex() }, 'Save'),
      h('button', { class: 'btn btn-s btn-sm', onclick: () => openItemHistory('regex', entry.id) }, 'History'))));
  wrap.append(h('p', { class: 'pr-help' }, 'Scripts run top to bottom, each one on the result of the one before. Open a script to edit it; the tester shows what the whole set does to your sample text.'));
  wrap.append(toolsRow(entry, set));

  const grid = h('div', { class: 'pr-build rx-grid' });
  const list = h('div', { class: 'rx-scripts', id: 'rxScripts' });
  set.scripts.forEach((s, i) => list.append(scriptCard(s, i, set)));
  list.append(h('button', { class: 'btn btn-ok btn-sm', id: 'rxAddScript', onclick: () => {
    const s = blankScript(); set.scripts.push(s); state.regexOpen = s.id; touch(); renderRegexEditor();
  } }, '+ Add a script'));
  grid.append(list, testerPanel(set));
  wrap.append(grid);
  ec.append(wrap);
  scheduleTest(0);
}

// ── Tools: copy in from / send to ──
function embeddedOwners() {
  const out = [];
  Object.values(state.charLibrary).forEach(c => {
    const arr = c && c.card && c.card.data && c.card.data.extensions && c.card.data.extensions.regex_scripts;
    out.push({ key: 'char:' + c.id, label: 'Character: ' + (c.name || 'Unnamed'), scripts: Array.isArray(arr) ? arr : [] });
  });
  Object.values(state.presetLibrary).forEach(p => {
    const arr = p && p.preset && p.preset.extensions && p.preset.extensions.regex_scripts;
    out.push({ key: 'preset:' + p.id, label: 'Preset: ' + (p.name || 'Unnamed'), scripts: Array.isArray(arr) ? arr : [] });
  });
  return out;
}

function toolsRow(entry, set) {
  const owners = embeddedOwners();
  const withScripts = owners.filter(o => o.scripts.length);
  const fromSel = h('select', { class: 'fselect', id: 'rxFromSel' },
    h('option', { value: '' }, withScripts.length ? 'Copy scripts in from...' : 'No card or preset has regex scripts yet'),
    withScripts.map(o => h('option', { value: o.key }, `${o.label} (${o.scripts.length})`)));
  const toSel = h('select', { class: 'fselect', id: 'rxToSel' },
    h('option', { value: '' }, owners.length ? 'Send this set to...' : 'No characters or presets yet'),
    owners.map(o => h('option', { value: o.key }, o.label)));
  return h('div', { class: 'pr-row rx-tools' },
    fromSel, h('button', { class: 'btn btn-s btn-sm', id: 'rxFromBtn', onclick: () => {
      const o = owners.find(x => x.key === fromSel.value); if (!o) { toast('Pick a character or preset first.', 'warn'); return; }
      const added = normalizeSet({ scripts: scriptsForEmbedding(o.scripts) }).scripts;
      set.scripts.push(...added); touch();
      toast(`Copied ${added.length} script${added.length === 1 ? '' : 's'} from ${o.label.replace(/^\w+: /, '')}.`, 'ok');
      renderRegexEditor();
    } }, 'Copy in'),
    toSel, h('button', { class: 'btn btn-s btn-sm', id: 'rxToBtn', onclick: () => sendTo(toSel.value, set) }, 'Send'));
}

// Add the set's scripts to a character card or a preset (skipping ones it already has)
export function sendTo(key, set) {
  if (!key) { toast('Pick a character or preset first.', 'warn'); return; }
  const [kind, id] = key.split(':');
  const holder = kind === 'char' ? (state.charLibrary[id] && state.charLibrary[id].card && state.charLibrary[id].card.data)
    : (state.presetLibrary[id] && state.presetLibrary[id].preset);
  if (!holder) { toast('That item no longer exists.', 'err'); return; }
  if (!set.scripts.length) { toast('This set has no scripts yet.', 'warn'); return; }
  if (!holder.extensions || typeof holder.extensions !== 'object') holder.extensions = {};
  const have = Array.isArray(holder.extensions.regex_scripts) ? holder.extensions.regex_scripts : [];
  const sig = s => [s.scriptName, s.findRegex, s.replaceString].join('\u0001');
  const known = new Set(have.map(sig));
  const fresh = scriptsForEmbedding(set.scripts).filter(s => !known.has(sig(s)));
  holder.extensions.regex_scripts = [...have, ...fresh];
  const ok = kind === 'char' ? saveCharLibrary() : savePresetLibrary();
  if (!ok) return;
  const skipped = set.scripts.length - fresh.length;
  const name = kind === 'char' ? state.charLibrary[id].name : state.presetLibrary[id].name;
  toast(`Added ${fresh.length} script${fresh.length === 1 ? '' : 's'} to "${name}"${skipped ? ` (${skipped} already there)` : ''}.`, fresh.length ? 'ok' : 'info');
}

// ── A script card ──
function scriptCard(s, i, set) {
  const open = state.regexOpen === s.id;
  const badge = h('span', { class: 'rx-badge', 'data-rx-badge': s.id }, '');
  const summary = h('summary', { class: s.disabled ? 'rx-off' : '' },
    h('input', { type: 'checkbox', checked: !s.disabled, title: s.disabled ? 'Off. Click to turn on.' : 'On. Click to turn off.', 'data-rx-toggle': s.id,
      onclick: e => e.stopPropagation(), onchange: e => { s.disabled = !e.target.checked; touch(); renderRegexEditor(); } }),
    h('span', { class: 'rx-name', 'data-rx-name': s.id }, s.scriptName || 'Unnamed script'),
    h('span', { class: 'rx-places' }, s.placement.length ? s.placement.map(p => (PLACEMENTS.find(x => x.id === p) || {}).label).join(', ') : 'runs nowhere'),
    badge);
  const det = h('details', { class: 'pr-module rx-script', 'data-rx-id': s.id }, summary);
  det.open = open;
  det.addEventListener('toggle', () => { if (det.open) state.regexOpen = s.id; else if (state.regexOpen === s.id) state.regexOpen = null; });

  const find = h('input', { class: 'finput rx-mono', id: 'rxFind-' + s.id, value: s.findRegex, placeholder: '/pattern/flags   for example   /\\*(.+?)\\*/g', spellcheck: 'false',
    oninput: e => { s.findRegex = e.target.value; touch(); scheduleTest(); } });
  const repl = h('textarea', { class: 'ftextarea rx-mono', id: 'rxRepl-' + s.id, style: 'min-height:64px', placeholder: 'Replace with... use $1 $2 for captured parts, {{match}} for the whole match',
    oninput: e => { s.replaceString = e.target.value; touch(); scheduleTest(); } });
  repl.value = s.replaceString;
  const trims = h('textarea', { class: 'ftextarea rx-mono', style: 'min-height:44px', placeholder: 'Trim out (one per line): text removed from every match before it is used',
    oninput: e => { s.trimStrings = e.target.value.split('\n').filter(x => x !== ''); touch(); scheduleTest(); } });
  trims.value = s.trimStrings.join('\n');

  const placeChips = h('div', { class: 'pr-chips' }, PLACEMENTS.map(p => h('label', { class: 'pr-chip' + (s.placement.includes(p.id) ? ' on' : '') },
    h('input', { type: 'checkbox', checked: s.placement.includes(p.id), onchange: e => {
      s.placement = e.target.checked ? [...new Set([...s.placement, p.id])] : s.placement.filter(x => x !== p.id); touch(); renderRegexEditor();
    } }), p.label)));

  const flag = (key, label, hint) => h('label', { class: 'cb-row', title: hint },
    h('input', { type: 'checkbox', checked: !!s[key], onchange: e => { s[key] = e.target.checked; touch(); scheduleTest(); } }), h('span', { class: 'flabel-sm' }, label));

  const depth = (key, label) => h('label', { class: 'rx-depth' }, h('span', { class: 'flabel-sm' }, label),
    h('input', { type: 'number', min: '0', class: 'fnum', value: s[key] === null ? '' : s[key], placeholder: 'any', oninput: e => { const v = e.target.value; s[key] = v === '' ? null : Math.max(0, Math.floor(Number(v))); touch(); } }));

  det.append(h('div', { class: 'pr-module-body' },
    h('div', { class: 'pr-row' }, h('input', { class: 'finput', value: s.scriptName, placeholder: 'Script name', 'data-rx-name-input': s.id,
      oninput: e => { s.scriptName = e.target.value; touch(); const n = det.querySelector('[data-rx-name]'); if (n) n.textContent = s.scriptName || 'Unnamed script'; } })),
    h('label', { class: 'pr-lbl' }, 'Find'), find,
    h('div', { class: 'rx-err', 'data-rx-err': s.id }),
    h('label', { class: 'pr-lbl' }, 'Replace with'), repl,
    h('label', { class: 'pr-lbl' }, 'Trim out'), trims,
    h('label', { class: 'pr-lbl' }, 'Runs on'), placeChips,
    h('div', { class: 'rx-flags' },
      flag('markdownOnly', 'Display only', 'Changes what you see in chat, not the saved message and not what the model receives'),
      flag('promptOnly', 'Prompt only', 'Changes what the model receives, not what you see or the saved message'),
      flag('runOnEdit', 'Run when a message is edited', '')),
    h('div', { class: 'pr-row' },
      h('select', { class: 'fselect', title: 'Macros in the pattern', onchange: e => { s.substituteRegex = Number(e.target.value); touch(); scheduleTest(); } },
        SUBSTITUTE_MODES.map(m => h('option', { value: m.id, selected: s.substituteRegex === m.id }, m.label))),
      depth('minDepth', 'Min depth'), depth('maxDepth', 'Max depth')),
    actionsPanel(s),
    h('div', { class: 'pr-lbl' }, 'What this script matches in the sample'),
    h('div', { class: 'rx-preview', 'data-rx-preview': s.id }),
    h('div', { class: 'pr-row' },
      h('button', { class: 'btn btn-s btn-sm', onclick: () => { swap(set.scripts, i, i - 1); touch(); renderRegexEditor(); }, disabled: i === 0 }, '↑'),
      h('button', { class: 'btn btn-s btn-sm', onclick: () => { swap(set.scripts, i, i + 1); touch(); renderRegexEditor(); }, disabled: i === set.scripts.length - 1 }, '↓'),
      h('button', { class: 'btn btn-s btn-sm', onclick: () => {
        const copy = { ...JSON.parse(JSON.stringify(s)), id: newId(), scriptName: s.scriptName + ' (copy)' };
        set.scripts.splice(i + 1, 0, copy); state.regexOpen = copy.id; touch(); renderRegexEditor();
      } }, 'Duplicate'),
      h('button', { class: 'btn btn-s btn-sm', onclick: () => exportRegexScript(s.id) }, 'Export (SillyTavern)'),
      h('button', { class: 'btn btn-err btn-sm', onclick: async () => {
        if (!await askConfirm(`Delete the script "${s.scriptName}"?`)) return;
        set.scripts = set.scripts.filter(x => x.id !== s.id); touch(); renderRegexEditor();
      } }, 'Delete'))));
  return det;
}

// ── Interactive buttons (Lumiverse regex actions) ──
// A Lumiverse script can turn parts of a message into buttons. The replacement text marks a button with
// data-regex-action="the-action-id", and the script's `actions` list says what a click does.
// SillyTavern ignores this, so the list is kept on the script and goes back out with Lumiverse exports.
const ACTION_TYPES = [['send', 'Send a message'], ['append', 'Add hidden guidance'], ['effects', 'Only run effects']];
function actionsOf(s) { return s.lumiverse && Array.isArray(s.lumiverse.actions) ? s.lumiverse.actions : []; }
function setActions(s, list) { if (!s.lumiverse || typeof s.lumiverse !== 'object') s.lumiverse = {}; s.lumiverse.actions = list; }
function actionsPanel(s) {
  const list = actionsOf(s);
  const det = h('details', { class: 'rx-actions', 'data-rx-actions': s.id });
  det.open = list.length > 0;
  det.append(h('summary', {}, 'Interactive buttons (Lumiverse)' + (list.length ? ' · ' + list.length : '')));
  det.append(h('div', { class: 'rx-none' }, 'Mark a button in the replacement with data-regex-action="id". Titles, content, cost and limit can use $1, $2 and so on from the match. SillyTavern ignores buttons.'));
  list.forEach((a, k) => {
    const upd = (key, val) => { a[key] = val; touch(); };
    const fld = (label, key, ph, tall) => h('label', { class: 'rx-act-f' }, h('span', { class: 'flabel-sm' }, label),
      h(tall ? 'textarea' : 'input', { class: tall ? 'ftextarea' : 'finput', style: tall ? 'min-height:54px' : '', placeholder: ph || '', value: a[key] === undefined ? '' : String(a[key]),
        oninput: e => upd(key, e.target.value) }));
    const used = new RegExp('data-regex-action\\s*=\\s*["\']' + String(a.id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']').test(s.replaceString || '');
    const box = h('div', { class: 'rx-act', 'data-rx-act': String(a.id) },
      h('div', { class: 'pr-row' },
        h('input', { class: 'finput rx-mono', value: a.id || '', placeholder: 'id', title: 'Matches data-regex-action in the replacement', oninput: e => upd('id', e.target.value) }),
        h('select', { class: 'fselect', onchange: e => { upd('type', e.target.value); } }, ACTION_TYPES.map(([v, l]) => h('option', { value: v, selected: a.type === v }, l))),
        h('label', { class: 'cb-row' }, h('input', { type: 'checkbox', checked: !!a.multi_select, onchange: e => upd('multi_select', e.target.checked) }), h('span', { class: 'flabel-sm' }, 'Multi-select')),
        h('button', { class: 'btn btn-err btn-sm', onclick: () => { setActions(s, list.filter((_, j) => j !== k)); touch(); renderRegexEditor(); } }, 'Remove')),
      used ? '' : h('div', { class: 'rx-err', style: 'display:block' }, 'No button in the replacement uses this id yet.'),
      h('div', { class: 'pr-row' }, fld('Cost', 'cost', '1 or $3'), fld('Limit', 'limit', '3 or $2')),
      fld('Title', 'title', 'Choose: $3'), fld('Subtitle', 'subtitle', 'Scene: $1'), fld('Content', 'content', 'I choose to $3.', true));
    if (a.effects !== undefined || a.type === 'effects') {
      const fx = h('textarea', { class: 'ftextarea rx-mono', style: 'min-height:54px', placeholder: '[{"type":"set_state","key":"seen","value":"yes"}]',
        oninput: e => { try { a.effects = JSON.parse(e.target.value || '[]'); e.target.classList.remove('bad'); touch(); } catch (err) { e.target.classList.add('bad'); } } });
      fx.value = JSON.stringify(a.effects || [], null, 1);
      box.append(h('label', { class: 'pr-lbl' }, 'Effects (JSON: set_state, fork, draft)'), fx);
    }
    det.append(box);
  });
  det.append(h('div', { class: 'pr-row' },
    h('button', { class: 'btn btn-s btn-sm', 'data-rx-add-action': s.id, onclick: () => {
      const ids = new Set(list.map(a => a.id)); let n = list.length + 1; while (ids.has('action-' + n)) n++;
      const id = 'action-' + n;
      setActions(s, [...list, { id, type: 'send', multi_select: false, cost: '1', limit: '', title: '', subtitle: '', content: '' }]);
      s.replaceString = (s.replaceString || '') + '<button type="button" data-regex-action="' + id + '">Click me</button>';
      touch(); renderRegexEditor();
    } }, '+ Add a button action')));
  return det;
}

// ── Tester ──
function testerPanel(set) {
  const t = set.test;
  const sample = h('textarea', { class: 'ftextarea', id: 'rxSample', style: 'min-height:150px', placeholder: 'Paste a message here to see what the scripts do to it...', oninput: e => { t.sample = e.target.value; touch(); scheduleTest(); } });
  sample.value = t.sample;
  const place = h('select', { class: 'fselect', id: 'rxPlace', onchange: e => { t.placement = Number(e.target.value); touch(); scheduleTest(0); } },
    PLACEMENTS.map(p => h('option', { value: p.id, selected: t.placement === p.id }, 'Text is: ' + p.label)));
  const view = h('select', { class: 'fselect', id: 'rxView', onchange: e => { t.view = e.target.value; touch(); scheduleTest(0); } },
    VIEWS.map(v => h('option', { value: v.id, selected: t.view === v.id }, 'Show: ' + v.label)));
  return h('div', { class: 'pr-out rx-tester' },
    h('div', { class: 'pr-lbl' }, 'Tester'),
    sample,
    h('div', { class: 'pr-row' }, place, view),
    h('div', { class: 'pr-names' },
      h('input', { class: 'finput', placeholder: 'Character name (for {{char}})', value: t.char, id: 'rxChar', oninput: e => { t.char = e.target.value; touch(); scheduleTest(); } }),
      h('input', { class: 'finput', placeholder: 'Your name (for {{user}})', value: t.user, id: 'rxUser', oninput: e => { t.user = e.target.value; touch(); scheduleTest(); } })),
    h('div', { class: 'pr-lbl' }, 'Result'),
    h('pre', { class: 'rx-result', id: 'rxResult' }, ''),
    h('div', { class: 'rx-steps', id: 'rxSteps' }),
    h('p', { class: 'pr-help' }, 'The tester follows SillyTavern closely but is not SillyTavern. Depth limits are not tested because they depend on where a message sits in a chat.'));
}

// A worker runs the tests so a runaway pattern (catastrophic backtracking) cannot freeze the page
let worker = null, seq = 0;
const waiting = new Map();
function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./regex_worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => { const w = waiting.get(e.data.id); if (w) { waiting.delete(e.data.id); clearTimeout(w.timer); w.resolve(e.data); } };
    worker.onerror = () => { worker = null; waiting.forEach(w => { clearTimeout(w.timer); w.resolve({ ok: false, error: 'The tester could not start.' }); }); waiting.clear(); };
  } catch (e) { worker = null; }
  return worker;
}

export function testScripts(scripts, text, opts, ms = 1500) {
  const w = getWorker();
  if (!w) { // no module workers: run here
    try { return Promise.resolve({ ok: true, result: runPipeline(scripts, text, opts) }); }
    catch (e) { return Promise.resolve({ ok: false, error: e.message }); }
  }
  return new Promise(resolve => {
    const id = ++seq;
    const timer = setTimeout(() => {
      waiting.delete(id);
      try { w.terminate(); } catch (e) { /* already gone */ }
      worker = null;
      resolve({ ok: false, timeout: true });
    }, ms);
    waiting.set(id, { resolve, timer });
    w.postMessage({ id, scripts, text, opts });
  });
}

let testTimer = null, testRun = 0;
export function scheduleTest(delay = 250) {
  clearTimeout(testTimer);
  testTimer = setTimeout(runTest, delay);
}

async function runTest() {
  const cur = current(); if (!cur || !g('rxResult')) return;
  const run = ++testRun;
  const { set } = cur, t = set.test;
  const res = await testScripts(set.scripts, t.sample, { placement: t.placement, view: t.view, char: t.char, user: t.user });
  if (run !== testRun || !g('rxResult')) return; // a newer run or another set took over
  const out = g('rxResult'), steps = g('rxSteps');
  if (res.timeout) {
    out.textContent = '';
    steps.innerHTML = '<div class="rx-step bad">A script took too long. This usually means a pattern with runaway backtracking (for example nested + or * groups). The tester stopped it; fix the pattern and it will run again.</div>';
    return;
  }
  if (!res.ok) { out.textContent = ''; steps.innerHTML = '<div class="rx-step bad">' + esc(res.error || 'The test failed.') + '</div>'; return; }
  const { output, steps: list } = res.result;
  out.textContent = output;
  steps.innerHTML = list.map(s => {
    const cls = s.error ? 'bad' : s.applied ? (s.count ? 'ok' : 'none') : 'skip';
    const msg = s.error ? esc(s.error) : s.applied ? `${s.count} match${s.count === 1 ? '' : 'es'}` : esc(s.skipped || 'skipped');
    return `<div class="rx-step ${cls}"><span>${esc(s.name)}</span><span>${msg}</span></div>`;
  }).join('') || '<div class="rx-step skip">No scripts yet.</div>';
  // Per-script badges, errors and highlighted previews
  list.forEach(s => {
    const b = document.querySelector(`[data-rx-badge="${CSS.escape(s.id)}"]`);
    if (b) { b.textContent = s.error ? '⚠ error' : s.applied ? `${s.count}` : '–'; b.className = 'rx-badge ' + (s.error ? 'bad' : s.applied && s.count ? 'ok' : ''); b.title = s.error || (s.applied ? `${s.count} match(es) in the sample` : s.skipped || ''); }
    const er = document.querySelector(`[data-rx-err="${CSS.escape(s.id)}"]`);
    if (er) er.textContent = s.error || '';
    const pv = document.querySelector(`[data-rx-preview="${CSS.escape(s.id)}"]`);
    if (pv) {
      if (s.applied && !s.error) { const src = (s.input || '').slice(0, 3000); pv.innerHTML = src ? highlight(src, s.matches.filter(m => m.index < 3000)) : '<span class="rx-none">Add sample text in the tester.</span>'; }
      else pv.innerHTML = '<span class="rx-none">' + esc(s.error || ('Not applied: ' + (s.skipped || ''))) + '</span>';
    }
  });
}

// ═══════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════
export function importRegexText(text, filename = '') {
  const { name, set } = parseRegexJson(text);
  const id = createRegex(name || filename.replace(/\.[^.]+$/, '') || 'Imported set', set);
  const n = state.regexLibrary[id].set.scripts.length;
  toast(`Imported ${n} script${n === 1 ? '' : 's'}.`, 'ok');
  return id;
}

export function handleRegexImport(e) {
  const files = [...(e.target.files || [])]; if (!files.length) return;
  files.forEach(file => {
    const r = new FileReader();
    r.onload = ev => { try { importRegexText(String(ev.target.result), file.name); } catch (err) { toast('Import failed: ' + err.message, 'err'); } };
    r.readAsText(file);
  });
  e.target.value = '';
}

export function exportRegexScript(scriptId) {
  commitActiveEditor();
  const cur = current(); if (!cur) { toast('Open a regex set first.', 'warn'); return; }
  const s = cur.set.scripts.find(x => x.id === (scriptId || state.regexOpen));
  if (!s) { toast('Open a script first (click its name), then export.', 'warn'); return; }
  const fn = 'regex-' + safeFileName(s.scriptName, 'script') + '.json';
  dlFile(scriptToJson(s), fn, 'application/json');
  toast('Exported ' + fn, 'ok');
}

export async function exportRegexZip() {
  commitActiveEditor();
  const cur = current(); if (!cur) { toast('Open a regex set first.', 'warn'); return; }
  if (!cur.set.scripts.length) { toast('This set has no scripts yet.', 'warn'); return; }
  if (typeof JSZip === 'undefined') { toast('The zip library did not load. Try exporting scripts one at a time.', 'err'); return; }
  const zip = new JSZip();
  const used = new Set();
  cur.set.scripts.forEach((s, i) => {
    let base = 'regex-' + safeFileName(s.scriptName, 'script-' + (i + 1)), n = base, k = 2;
    while (used.has(n)) n = base + '-' + k++;
    used.add(n); zip.file(n + '.json', scriptToJson(s));
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const fn = safeFileName(cur.entry.name, 'regex-set') + '-scripts.zip';
  dlFile(blob, fn, 'application/zip');
  toast('Exported ' + fn, 'ok');
}

export function exportRegexLumiverse() {
  commitActiveEditor();
  const cur = current(); if (!cur) { toast('Open a regex set first.', 'warn'); return; }
  if (!cur.set.scripts.length) { toast('This set has no scripts yet.', 'warn'); return; }
  const fn = safeFileName(cur.entry.name, 'regex-set') + '-lumiverse-regex.json';
  dlFile(lumiRegexFileJson(cur.set.scripts), fn, 'application/json');
  toast('Exported ' + fn, 'ok');
}

export function exportRegexSet() {
  commitActiveEditor();
  const cur = current(); if (!cur) { toast('Open a regex set first.', 'warn'); return; }
  const fn = safeFileName(cur.entry.name, 'regex-set') + '.loreos-regex.json';
  dlFile(setToJson(cur.entry.name, cur.set), fn, 'application/json');
  toast('Exported ' + fn, 'ok');
}

// ═══════════════════════════════════════════════════════
// WIRING + MARKUP
// ═══════════════════════════════════════════════════════
export function wireRegexActions() {
  const on = (id, fn) => { const el = g(id); if (el) el.onclick = fn; };
  on('regexNewBtn', () => createRegex());
  on('regexImportBtn', () => g('fileRegexInput').click());
  on('regexExportScriptBtn', () => exportRegexScript());
  on('regexExportZipBtn', () => exportRegexZip());
  on('regexExportSetBtn', () => exportRegexSet());
  on('regexExportLumiBtn', () => exportRegexLumiverse());
  const fi = g('fileRegexInput'); if (fi) fi.onchange = handleRegexImport;
  on('mobRegexNew', () => createRegex());
  on('mobRegexImport', () => g('fileRegexInput').click());
  on('mobRegexExport', () => openModal('mobRegexExportModal'));
  on('mobRegexExportScript', () => { closeModal('mobRegexExportModal'); exportRegexScript(); });
  on('mobRegexExportZip', () => { closeModal('mobRegexExportModal'); exportRegexZip(); });
  on('mobRegexExportSet', () => { closeModal('mobRegexExportModal'); exportRegexSet(); });
  on('mobRegexExportLumi', () => { closeModal('mobRegexExportModal'); exportRegexLumiverse(); });
}

registerMarkup(75, `<input type="file" id="fileRegexInput" accept=".json" multiple style="display:none">`);
registerMarkup(186, `<div id="mobRegexExportModal" class="modal">
  <div class="modal-box" style="max-width:340px">
    <div class="modal-head"><h2>Export Regex</h2><button class="modal-x" data-close="mobRegexExportModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <button class="btn btn-p" id="mobRegexExportScript" style="width:100%;justify-content:center;padding:.65rem">Open script (SillyTavern)</button>
      <button class="btn btn-s" id="mobRegexExportZip" style="width:100%;justify-content:center;padding:.65rem">All scripts (.zip)</button>
      <button class="btn btn-s" id="mobRegexExportLumi" style="width:100%;justify-content:center;padding:.65rem">Lumiverse regex scripts (JSON)</button>
      <button class="btn btn-s" id="mobRegexExportSet" style="width:100%;justify-content:center;padding:.65rem">LoreOS set (JSON)</button>
    </div>
  </div>
</div>`);

registerTrashRestorer('regex', data => {
  const id = data.id && !state.regexLibrary[data.id] ? data.id : regexId();
  state.regexLibrary[id] = { ...data, id };
  saveRegexLibrary();
  if (state.mode === 'regex') renderRegexSidebar();
});
