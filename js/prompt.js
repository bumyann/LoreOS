// ═══════════════════════════════════════════════════════
// PROMPT PACKS — the Prompt tab.
// For frontends with no preset system (JanitorAI, SaucepanAI, ...): build a modular
// prompt stack (one base + optional modules), see its size, and copy it into the
// platform's prompt boxes. The data model lives in prompt_model.js.
// ═══════════════════════════════════════════════════════
import { openFullscreen } from './fullscreen.js';
import { itemHistoryPush, openItemHistory } from './history.js';
import { closeMobSidebar } from './mobile.js';
import {
  applySet, blankPack, buildOutputs, cleanSelection, defaultTarget, estimateTokens, fmtTokens, normalizePack,
  orderedModules, packToJson, packToMarkdown, parseMarkdownPack, parsePackJson, pid, suggestSplit, toggleModule,
} from './prompt_model.js';
import { state } from './state.js';
import { savePromptLibrary } from './storage.js';
import { registerTrashRestorer, trashPush } from './trash.js';
import { askConfirm, askInput, closeModal, copyToClipboard, dlFile, esc, g, openModal, registerMarkup, safeFileName, toast } from './util.js';
import { commitActiveEditor, wsDropItem, wsMarkSaved, wsShowItem } from './workshop.js';

export function promptId() { return 'k' + Date.now() + Math.floor(Math.random() * 1000); }

// ═══════════════════════════════════════════════════════
// LIBRARY (create / open / duplicate / delete / save)
// ═══════════════════════════════════════════════════════
export function createPrompt(name = 'New prompt pack', pack = null) {
  const id = promptId();
  state.promptLibrary[id] = { id, name, pack: normalizePack(pack || blankPack()), savedAt: new Date().toISOString() };
  savePromptLibrary();
  renderPromptSidebar();
  if (!wsShowItem('prompt', id)) openPrompt(id);
  return id;
}

export function openPrompt(id) {
  if (state.activePromptId && state.activePromptId !== id) commitActiveEditor();
  state.promptUnsaved = false;
  state.activePromptId = id;
  state.promptTab = 'build';
  renderPromptSidebar();
  renderPromptEditor();
}

export function duplicatePrompt(id) {
  const src = state.promptLibrary[id]; if (!src) return;
  const copy = JSON.parse(JSON.stringify(src.pack));
  createPrompt((src.name || 'Untitled') + ' (Copy)', copy);
}

export async function deletePrompt(id) {
  if (!await askConfirm('Delete this prompt pack? You can bring it back from Settings > Storage > Recently deleted.')) return;
  if (state.promptLibrary[id]) trashPush('prompt', state.promptLibrary[id].name || 'Unnamed pack', state.promptLibrary[id]);
  delete state.promptLibrary[id];
  wsDropItem('prompt', id);
  if (state.activePromptId === id) state.activePromptId = null;
  savePromptLibrary(); renderPromptSidebar(); renderPromptEditor();
}

// Edits write straight into the pack as you type, so saving is just persisting it
export function savePrompt({ silent = false, noHistory = false } = {}) {
  const id = state.activePromptId;
  const entry = id && state.promptLibrary[id];
  if (!entry) return false;
  entry.savedAt = new Date().toISOString();
  const ok = savePromptLibrary();
  if (!ok) return false;
  state.promptUnsaved = false;
  wsMarkSaved('prompt', id);
  if (!noHistory) itemHistoryPush('prompt', id, JSON.parse(JSON.stringify(entry)));
  if (!silent) toast('Saved.', 'ok');
  renderPromptSidebar();
  return true;
}

function touch() {
  state.promptUnsaved = true;
}

// ═══════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════
export function renderPromptSidebar() {
  const list = g('entryList');
  const count = g('entryCount');
  const packs = Object.values(state.promptLibrary).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  count.textContent = `${packs.length} ${packs.length === 1 ? 'pack' : 'packs'}`;
  list.innerHTML = '';
  if (!packs.length) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:1.2rem .75rem;text-align:center;font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:1px';
    li.textContent = 'no prompt packs yet';
    list.append(li); return;
  }
  const q = (g('sbSearch') && g('sbSearch').value || '').toLowerCase();
  packs.filter(e => !q || (e.name || '').toLowerCase().includes(q)).forEach(entry => {
    const li = document.createElement('li');
    li.className = 'ei' + (entry.id === state.activePromptId ? ' open' : '');
    const head = document.createElement('div'); head.className = 'ei-head';
    const emoji = document.createElement('span'); emoji.className = 'ei-emoji'; emoji.textContent = '✎︎';
    const name = document.createElement('div'); name.className = 'ei-name'; name.textContent = entry.name || 'Untitled pack';
    head.append(emoji, name); li.append(head);
    const acts = document.createElement('div'); acts.className = 'ei-acts';
    [['⧉', 'Duplicate', () => duplicatePrompt(entry.id), ''], ['✕', 'Delete', () => deletePrompt(entry.id), 'del']].forEach(([lbl, title, fn, cls]) => {
      const b = document.createElement('button');
      b.className = 'ei-act' + (cls ? ' ' + cls : ''); b.title = title; b.textContent = lbl;
      b.addEventListener('click', e2 => { e2.stopPropagation(); fn(); });
      acts.append(b);
    });
    li.append(acts);
    const meta = document.createElement('div'); meta.className = 'ei-kws';
    const p = entry.pack || {};
    [`${(p.modules || []).length} modules`, `${(p.sets || []).length} sets`].forEach(t => {
      const tag = document.createElement('span'); tag.className = 'kw-tag'; tag.textContent = t; meta.append(tag);
    });
    li.append(meta);
    li.addEventListener('click', () => { if (!wsShowItem('prompt', entry.id)) openPrompt(entry.id); closeMobSidebar(); });
    list.append(li);
  });
}

// ═══════════════════════════════════════════════════════
// EDITOR
// ═══════════════════════════════════════════════════════
const TABS = [['build', 'Build a stack'], ['modules', 'Modules'], ['sets', 'Sets'], ['targets', 'Where it goes'], ['page', 'Page text']];

// Tiny element builder: h('div', { class: 'x', onclick: fn }, child, 'text')
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

function current() {
  const id = state.activePromptId;
  const entry = id && state.promptLibrary[id];
  return entry ? { id, entry, pack: entry.pack } : null;
}

export function renderPromptEditor() {
  const ec = g('editorContent');
  g('tabBar').innerHTML = '';
  const cur = current();
  if (!cur) {
    ec.className = '';
    ec.innerHTML = `<div class="empty-state"><div>// select or create a prompt pack</div><button class="btn btn-ok" id="prNewAlt">+ New Prompt Pack</button></div>`;
    g('prNewAlt').onclick = () => createPrompt();
    return;
  }
  const { entry, pack } = cur;
  ec.className = '';
  ec.innerHTML = '';

  const wrap = h('div', { class: 'pr-wrap' });
  const nameIn = h('input', { id: 'prName', class: 'finput pr-name', value: entry.name || '', placeholder: 'Pack name', oninput: e => {
    entry.name = e.target.value; touch();
  } });
  const actions = h('div', { class: 'pr-top-acts' },
    h('button', { class: 'btn btn-p btn-sm', id: 'prSaveBtn', onclick: () => savePrompt() }, 'Save'),
    h('button', { class: 'btn btn-s btn-sm', onclick: () => openItemHistory('prompt', entry.id) }, 'History'),
  );
  wrap.append(h('div', { class: 'pr-top' }, nameIn, actions));

  const tabs = h('div', { class: 'pr-tabs' });
  TABS.forEach(([key, label]) => tabs.append(h('button', {
    class: 'pr-tab' + (state.promptTab === key ? ' active' : ''), 'data-prtab': key,
    onclick: () => { state.promptTab = key; renderPromptEditor(); },
  }, label)));
  wrap.append(tabs);

  const body = h('div', { class: 'pr-body', id: 'prBody' });
  ({ build: buildTab, modules: modulesTab, sets: setsTab, targets: targetsTab, page: pageTab }[state.promptTab] || buildTab)(body, entry, pack);
  wrap.append(body);
  ec.append(wrap);
}

// ── Build a stack ──
function buildTab(body, entry, pack) {
  pack.selection = cleanSelection(pack, pack.selection);

  // Sets
  if (pack.sets.length) {
    const row = h('div', { class: 'pr-sets' }, h('span', { class: 'pr-lbl' }, 'Start from a set:'));
    pack.sets.forEach(s => row.append(h('button', {
      class: 'btn btn-s btn-sm', title: s.description || s.raw || '',
      onclick: () => { pack.selection = applySet(pack, s.id); touch(); renderPromptEditor(); },
    }, s.name)));
    row.append(h('button', { class: 'btn btn-s btn-sm', onclick: () => { pack.selection = []; touch(); renderPromptEditor(); } }, 'Clear'));
    body.append(row);
  }

  const grid = h('div', { class: 'pr-build' });
  const left = h('div', { class: 'pr-picker' });
  pack.groups.forEach(group => {
    const mods = pack.modules.filter(m => m.groupId === group.id);
    if (!mods.length) return;
    const card = h('div', { class: 'pr-group' },
      h('div', { class: 'pr-group-head' }, h('span', {}, group.name), h('span', { class: 'pr-badge' }, group.pick === 'one' ? 'pick one' : 'pick any')));
    mods.forEach(m => {
      const on = pack.selection.includes(m.id);
      const cb = h('input', { type: 'checkbox', checked: on, class: group.pick === 'one' ? 'pr-radio' : '', 'data-mod': m.id,
        onchange: () => { pack.selection = toggleModule(pack, pack.selection, m.id); touch(); renderPromptEditor(); } });
      card.append(h('label', { class: 'pr-mod' + (on ? ' on' : '') }, cb,
        h('span', { class: 'pr-mod-name' }, m.name),
        h('span', { class: 'pr-tok' }, fmtTokens(estimateTokens(m.text))),
        m.notes ? h('span', { class: 'pr-mod-notes' }, m.notes) : null));
    });
    left.append(card);
  });
  if (!left.children.length) left.append(h('div', { class: 'pr-empty' }, 'No modules yet. Add some on the Modules tab.'));

  const right = h('div', { class: 'pr-out' });
  // Names to fill in
  const pv = pack.preview;
  const refresh = () => renderOutputs(outBox, pack);
  right.append(h('div', { class: 'pr-names' },
    h('input', { class: 'finput', placeholder: 'Character name', value: pv.char, id: 'prCharName', oninput: e => { pv.char = e.target.value; touch(); refresh(); } }),
    h('input', { class: 'finput', placeholder: 'Your name', value: pv.user, id: 'prUserName', oninput: e => { pv.user = e.target.value; touch(); refresh(); } }),
    h('label', { class: 'cb-row' }, h('input', { type: 'checkbox', id: 'prReplace', checked: pv.replace, onchange: e => { pv.replace = e.target.checked; touch(); refresh(); } }),
      h('span', { class: 'flabel-sm' }, 'Fill in {{char}} and {{user}} in the copy'))));
  if (pack.targets.length > 1) {
    const sel = h('select', { class: 'fselect', id: 'prTarget', onchange: e => { pack.activeTarget = e.target.value; touch(); refresh(); } },
      pack.targets.map(t => h('option', { value: t.id, selected: t.id === pack.activeTarget }, t.name)));
    right.append(h('div', { class: 'pr-lbl' }, 'Copy for: ', sel));
  }
  const outBox = h('div', { id: 'prOutputs' });
  right.append(outBox);
  grid.append(left, right);
  body.append(grid);
  refresh();
}

function renderOutputs(box, pack) {
  box.innerHTML = '';
  const target = pack.targets.find(t => t.id === pack.activeTarget) || pack.targets[0];
  const names = pack.preview.replace ? { char: pack.preview.char, user: pack.preview.user } : {};
  const outs = buildOutputs(pack, pack.selection, target, names);
  const total = outs.reduce((n, o) => n + o.tokens, 0);
  box.append(h('div', { class: 'pr-total', id: 'prTotal' }, `Stack: ${pack.selection.length} module${pack.selection.length === 1 ? '' : 's'}, ${fmtTokens(total)} (a rough estimate; real counts vary by model)`));
  outs.forEach((o, i) => {
    const f = target.fields[i];
    const ta = h('textarea', { class: 'ftextarea pr-out-ta', readonly: true, rows: 10, 'data-field': String(i), placeholder: f && !f.all && !f.groupIds.length ? 'Nothing is assigned to this box. Tick groups for it on the "Where it goes" tab.' : 'Nothing picked for this box yet.' });
    ta.value = o.text;
    box.append(h('div', { class: 'pr-field' },
      h('div', { class: 'pr-field-head' },
        h('span', { class: 'pr-field-label' }, o.label, f && f.where ? h('span', { class: 'pr-where' }, ' (' + f.where + ')') : null),
        h('span', { class: 'pr-tok' }, fmtTokens(o.tokens)),
        h('button', { class: 'btn btn-ok btn-sm pr-copy', 'data-field': String(i), onclick: async () => {
          if (!o.text) { toast('"' + o.label + '" is empty. Pick modules for it first.', 'warn'); return; }
          await copyToClipboard(o.text); toast(`Copied "${o.label}" (${fmtTokens(o.tokens)}).`, 'ok');
        } }, 'Copy')),
      ta));
  });
}

// ── Modules ──
function modulesTab(body, entry, pack) {
  const rerender = () => renderPromptEditor();
  pack.groups.forEach((group, gi) => {
    const mods = pack.modules.filter(m => m.groupId === group.id);
    const card = h('div', { class: 'pr-group pr-edit-group' });
    card.append(h('div', { class: 'pr-group-edit-head' },
      h('input', { class: 'finput', value: group.name, 'data-group-name': group.id, oninput: e => { group.name = e.target.value; touch(); } }),
      h('select', { class: 'fselect', onchange: e => { group.pick = e.target.value; touch(); } },
        h('option', { value: 'one', selected: group.pick === 'one' }, 'Pick one'), h('option', { value: 'any', selected: group.pick === 'any' }, 'Pick any')),
      h('button', { class: 'btn btn-s btn-sm', title: 'Move group up', disabled: gi === 0, onclick: () => { swap(pack.groups, gi, gi - 1); touch(); rerender(); } }, '↑'),
      h('button', { class: 'btn btn-s btn-sm', title: 'Move group down', disabled: gi === pack.groups.length - 1, onclick: () => { swap(pack.groups, gi, gi + 1); touch(); rerender(); } }, '↓'),
      h('button', { class: 'btn btn-err btn-sm', title: 'Delete group', onclick: async () => {
        if (!await askConfirm(`Delete the group "${group.name}"${mods.length ? ' and its ' + mods.length + ' module' + (mods.length > 1 ? 's' : '') : ''}?`)) return;
        const ids = new Set(mods.map(m => m.id));
        pack.modules = pack.modules.filter(m => !ids.has(m.id));
        pack.groups = pack.groups.filter(x => x.id !== group.id);
        pack.targets.forEach(t => t.fields.forEach(f => { f.groupIds = f.groupIds.filter(i => i !== group.id); }));
        pack.sets.forEach(s => { s.moduleIds = s.moduleIds.filter(i => !ids.has(i)); });
        pack.selection = pack.selection.filter(i => !ids.has(i));
        touch(); rerender();
      } }, '✕')));
    mods.forEach(m => card.append(moduleEditor(m, pack, rerender)));
    card.append(h('button', { class: 'btn btn-s btn-sm', 'data-add-module': group.id, onclick: () => {
      pack.modules.push({ id: pid('m'), groupId: group.id, name: 'New module', text: '', notes: '' }); touch(); rerender();
    } }, '+ Add module'));
    body.append(card);
  });
  body.append(h('button', { class: 'btn btn-ok btn-sm', id: 'prAddGroup', onclick: () => {
    pack.groups.push({ id: pid('g'), name: 'New group', pick: 'any' }); touch(); rerender();
  } }, '+ Add group'));
}

function swap(arr, i, j) { if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

function moduleEditor(m, pack, rerender) {
  const tokEl = h('span', { class: 'pr-tok' }, fmtTokens(estimateTokens(m.text)));
  const taId = 'prText-' + m.id;
  const idx = pack.modules.indexOf(m);
  // Move within the group: swap with the neighbour that is in the same group
  const move = dir => {
    let j = idx + dir;
    while (j >= 0 && j < pack.modules.length && pack.modules[j].groupId !== m.groupId) j += dir;
    if (j < 0 || j >= pack.modules.length) return;
    swap(pack.modules, idx, j); touch(); rerender();
  };
  const ta = h('textarea', { id: taId, class: 'ftextarea', style: 'min-height:170px', placeholder: 'The prompt text, exactly as it should be pasted...', oninput: e => {
    m.text = e.target.value; tokEl.textContent = fmtTokens(estimateTokens(m.text)); touch();
  } });
  ta.value = m.text;
  const nameShown = h('span', { class: 'pr-mod-title' }, m.name);
  return h('details', { class: 'pr-module' },
    h('summary', {}, nameShown, tokEl),
    h('div', { class: 'pr-module-body' },
      h('div', { class: 'pr-row' },
        h('input', { class: 'finput', value: m.name, placeholder: 'Module name', 'data-mod-name': m.id, oninput: e => { m.name = e.target.value; nameShown.textContent = m.name; touch(); } }),
        h('select', { class: 'fselect', title: 'Group', onchange: e => { m.groupId = e.target.value; touch(); rerender(); } },
          pack.groups.map(gp => h('option', { value: gp.id, selected: gp.id === m.groupId }, gp.name)))),
      h('input', { class: 'finput', value: m.notes, placeholder: 'Notes (shown on the exported page, not part of the prompt)', oninput: e => { m.notes = e.target.value; touch(); } }),
      h('div', { class: 'pr-ta-wrap' }, ta, h('button', { class: 'expand-btn', onclick: ev => { ev.preventDefault(); openFullscreen(taId, m.name || 'Prompt'); } }, '⛶ expand')),
      h('div', { class: 'pr-row' },
        h('button', { class: 'btn btn-s btn-sm', onclick: () => move(-1) }, '↑'),
        h('button', { class: 'btn btn-s btn-sm', onclick: () => move(1) }, '↓'),
        h('button', { class: 'btn btn-s btn-sm', onclick: () => {
          pack.modules.splice(idx + 1, 0, { ...m, id: pid('m'), name: m.name + ' (copy)' }); touch(); rerender();
        } }, 'Duplicate'),
        h('button', { class: 'btn btn-err btn-sm', onclick: async () => {
          if (!await askConfirm(`Delete the module "${m.name}"?`)) return;
          pack.modules = pack.modules.filter(x => x.id !== m.id);
          pack.sets.forEach(s => { s.moduleIds = s.moduleIds.filter(i => i !== m.id); });
          pack.selection = pack.selection.filter(i => i !== m.id);
          touch(); rerender();
        } }, 'Delete'))));
}

// ── Sets ──
function setsTab(body, entry, pack) {
  body.append(h('p', { class: 'pr-help' }, 'A set is a ready-made combination (for example "Maiden" = base + a gentle intimacy module). Sets are one click on the Build tab. Sets usually leave out the base prompt, so your chosen base stays.'));
  pack.sets.forEach((s, i) => {
    const card = h('div', { class: 'pr-group pr-set' },
      h('div', { class: 'pr-row' },
        h('input', { class: 'finput', value: s.name, placeholder: 'Set name', oninput: e => { s.name = e.target.value; touch(); } }),
        h('button', { class: 'btn btn-err btn-sm', onclick: () => { pack.sets.splice(i, 1); touch(); renderPromptEditor(); } }, '✕')),
      h('input', { class: 'finput', value: s.description, placeholder: 'Short description', oninput: e => { s.description = e.target.value; touch(); } }));
    const chips = h('div', { class: 'pr-chips' });
    orderedModules(pack).forEach(m => {
      const on = s.moduleIds.includes(m.id);
      chips.append(h('label', { class: 'pr-chip' + (on ? ' on' : '') },
        h('input', { type: 'checkbox', checked: on, onchange: e => {
          s.moduleIds = e.target.checked ? [...s.moduleIds, m.id] : s.moduleIds.filter(x => x !== m.id);
          s.raw = ''; touch(); renderPromptEditor();
        } }), m.name));
    });
    card.append(chips);
    body.append(card);
  });
  body.append(h('div', { class: 'pr-row' },
    h('button', { class: 'btn btn-ok btn-sm', id: 'prSaveAsSet', onclick: async () => {
      const name = (await askInput('Name this set', '')) || '';
      if (!name.trim()) return;
      pack.sets.push({ id: pid('s'), name: name.trim(), description: '', raw: '', moduleIds: pack.selection.slice() });
      touch(); renderPromptEditor();
    } }, 'Save the current stack as a set'),
    h('button', { class: 'btn btn-s btn-sm', onclick: () => { pack.sets.push({ id: pid('s'), name: 'New set', description: '', raw: '', moduleIds: [] }); touch(); renderPromptEditor(); } }, '+ Empty set')));
}

// ── Where it goes ──
function targetsTab(body, entry, pack) {
  body.append(h('p', { class: 'pr-help' }, 'Some platforms have several prompt boxes. A platform here lists its boxes and which groups go in each, so Copy gives you one block per box. SaucepanAI has Provider Pre-Content and Provider Post-Content (LLM settings) plus Advanced Prompt and Formatting Instructions (advanced chat settings). JanitorAI has Global Prompt and Prefill. A box with nothing ticked stays empty.'));
  pack.targets.forEach((t, ti) => {
    const card = h('div', { class: 'pr-group pr-target' },
      h('div', { class: 'pr-row' },
        h('input', { class: 'finput', value: t.name, placeholder: 'Platform', oninput: e => { t.name = e.target.value; touch(); } }),
        h('button', { class: 'btn btn-err btn-sm', disabled: pack.targets.length < 2, title: 'Delete target', onclick: () => {
          pack.targets.splice(ti, 1); if (pack.activeTarget === t.id) pack.activeTarget = pack.targets[0].id; touch(); renderPromptEditor();
        } }, '✕')));
    t.fields.forEach((f, fi) => {
      const chips = h('div', { class: 'pr-chips' + (f.all ? ' pr-chips-off' : '') });
      pack.groups.forEach(gp => {
        const on = f.all || f.groupIds.includes(gp.id);
        chips.append(h('label', { class: 'pr-chip' + (on ? ' on' : '') },
          h('input', { type: 'checkbox', checked: on, disabled: f.all, onchange: e => {
            f.groupIds = e.target.checked ? [...f.groupIds, gp.id] : f.groupIds.filter(x => x !== gp.id); touch(); renderPromptEditor();
          } }), gp.name));
      });
      card.append(h('div', { class: 'pr-field-edit' },
        h('div', { class: 'pr-row' },
          h('input', { class: 'finput', value: f.label, placeholder: 'Prompt box name', oninput: e => { f.label = e.target.value; touch(); } }),
          h('input', { class: 'finput', value: f.where, placeholder: 'Where it lives (a reminder, e.g. LLM settings)', oninput: e => { f.where = e.target.value; touch(); } }),
          h('button', { class: 'btn btn-s btn-sm', disabled: t.fields.length < 2, onclick: () => { t.fields.splice(fi, 1); touch(); renderPromptEditor(); } }, 'Remove box')),
        h('label', { class: 'cb-row' },
          h('input', { type: 'checkbox', checked: f.all, 'data-all-box': f.id, onchange: e => { f.all = e.target.checked; touch(); renderPromptEditor(); } }),
          h('span', { class: 'flabel-sm' }, 'Takes everything')),
        chips,
        !f.all && !f.groupIds.length ? h('div', { class: 'pr-help' }, 'No groups ticked: this box stays empty.') : null));
    });
    card.append(h('button', { class: 'btn btn-s btn-sm', onclick: () => { t.fields.push({ id: pid('f'), label: 'Another box', where: '', all: false, groupIds: [] }); touch(); renderPromptEditor(); } }, '+ Add a prompt box'));
    body.append(card);
  });
  body.append(h('div', { class: 'pr-row' },
    h('button', { class: 'btn btn-ok btn-sm', onclick: () => { pack.targets.push({ ...defaultTarget(), name: 'New platform' }); touch(); renderPromptEditor(); } }, '+ Add a platform'),
    h('button', { class: 'btn btn-s btn-sm', id: 'prAddSauce', title: 'Provider Pre-Content, Provider Post-Content, Advanced Prompt, Formatting Instructions', onclick: () => { pack.targets.push(suggestSplit(pack, 'saucepan')); touch(); renderPromptEditor(); } }, '+ SaucepanAI layout'),
    h('button', { class: 'btn btn-s btn-sm', id: 'prAddJanitor', title: 'Global Prompt, Chat Memory (for game modules) and Prefill', onclick: () => { pack.targets.push(suggestSplit(pack, 'janitor')); touch(); renderPromptEditor(); } }, '+ JanitorAI layout')));
}

// ── Page text (what the exported page says around the modules) ──
function pageTab(body, entry, pack) {
  body.append(h('p', { class: 'pr-help' }, 'This text is only for the exported Markdown page: a short description, a lead-in, and guide sections (like "How to use" or recommended settings). It is never part of the copied prompt.'));
  const desc = h('textarea', { class: 'ftextarea', style: 'min-height:60px', id: 'prDesc', oninput: e => { pack.description = e.target.value; touch(); } });
  desc.value = pack.description;
  body.append(h('label', { class: 'pr-lbl' }, 'Description'), desc);
  body.append(h('label', { class: 'pr-lbl' }, 'Lead-in'));
  const intro = h('textarea', { class: 'ftextarea', style: 'min-height:80px', id: 'prIntro', oninput: e => { pack.intro = e.target.value; touch(); } });
  intro.value = pack.intro; body.append(intro);
  pack.docSections.forEach((d, i) => {
    const ta = h('textarea', { class: 'ftextarea', style: 'min-height:140px', oninput: e => { d.markdown = e.target.value; touch(); } });
    ta.value = d.markdown;
    body.append(h('div', { class: 'pr-group' },
      h('div', { class: 'pr-row' }, h('input', { class: 'finput', value: d.title, placeholder: 'Section title', oninput: e => { d.title = e.target.value; touch(); } }),
        h('button', { class: 'btn btn-err btn-sm', onclick: () => { pack.docSections.splice(i, 1); touch(); renderPromptEditor(); } }, '✕')), ta));
  });
  body.append(h('button', { class: 'btn btn-ok btn-sm', onclick: () => { pack.docSections.push({ title: 'New section', markdown: '## New section\n\n' }); touch(); renderPromptEditor(); } }, '+ Add a section'));
}

// ═══════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════
export function importPromptText(text, filename = '') {
  const isJson = /\.json$/i.test(filename) || /^\s*\{/.test(text);
  let name, pack, report = null;
  if (isJson) { ({ name, pack } = parsePackJson(text)); }
  else { ({ name, pack, report } = parseMarkdownPack(text)); if (!pack.modules.length) throw new Error('No prompts found. Each prompt should sit in a ``` code block under a ### heading.'); }
  const id = createPrompt(name || filename.replace(/\.[^.]+$/, '') || 'Imported pack', pack);
  if (report) {
    toast(`Imported ${report.modules} modules in ${report.groups} groups, ${report.sets} sets, ${report.docSections} text sections.`, 'ok');
    if (report.unresolved.length) toast('Some set entries could not be matched to a module: ' + report.unresolved.join(', '), 'warn');
  } else toast('Imported "' + name + '".', 'ok');
  return id;
}

export function handlePromptImport(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try { importPromptText(String(ev.target.result), file.name); }
    catch (err) { toast('Import failed: ' + err.message, 'err'); }
  };
  r.readAsText(file);
  e.target.value = '';
}

export function exportPromptMarkdown(id = state.activePromptId) {
  commitActiveEditor();
  const entry = state.promptLibrary[id]; if (!entry) { toast('Open a prompt pack first.', 'warn'); return; }
  const fn = safeFileName(entry.name, 'prompt-pack') + '.md';
  dlFile(packToMarkdown(entry.name, entry.pack), fn, 'text/markdown');
  toast('Exported ' + fn, 'ok');
}

export function exportPromptJson(id = state.activePromptId) {
  commitActiveEditor();
  const entry = state.promptLibrary[id]; if (!entry) { toast('Open a prompt pack first.', 'warn'); return; }
  const fn = safeFileName(entry.name, 'prompt-pack') + '.loreos-pack.json';
  dlFile(packToJson(entry.name, entry.pack), fn, 'application/json');
  toast('Exported ' + fn, 'ok');
}

// The current stack as one plain text file (all boxes of the chosen platform, labelled)
export function exportPromptStackText(id = state.activePromptId) {
  commitActiveEditor();
  const entry = state.promptLibrary[id]; if (!entry) { toast('Open a prompt pack first.', 'warn'); return; }
  const pack = entry.pack;
  const target = pack.targets.find(t => t.id === pack.activeTarget) || pack.targets[0];
  const names = pack.preview.replace ? { char: pack.preview.char, user: pack.preview.user } : {};
  const outs = buildOutputs(pack, pack.selection, target, names);
  if (!outs.some(o => o.text)) { toast('Pick a base prompt first, there is nothing in the stack yet.', 'warn'); return; }
  const text = outs.map(o => (outs.length > 1 ? `===== ${o.label} =====\n\n` : '') + o.text).join('\n\n\n') + '\n';
  const fn = safeFileName(entry.name, 'prompt') + '-stack.txt';
  dlFile(text, fn, 'text/plain');
  toast('Exported ' + fn, 'ok');
}

// ═══════════════════════════════════════════════════════
// WIRING (header buttons) + MARKUP
// ═══════════════════════════════════════════════════════
export function wirePromptActions() {
  const on = (id, fn) => { const el = g(id); if (el) el.onclick = fn; };
  on('promptNewBtn', () => createPrompt());
  on('promptImportBtn', () => g('filePromptInput').click());
  on('promptExportMdBtn', () => exportPromptMarkdown());
  on('promptExportJsonBtn', () => exportPromptJson());
  on('promptExportTxtBtn', () => exportPromptStackText());
  const fi = g('filePromptInput'); if (fi) fi.onchange = handlePromptImport;
  // mobile
  on('mobPromptNew', () => createPrompt());
  on('mobPromptImport', () => g('filePromptInput').click());
  on('mobPromptExport', () => openModal('mobPromptExportModal'));
  on('mobPromptExportMd', () => { closeModal('mobPromptExportModal'); exportPromptMarkdown(); });
  on('mobPromptExportJson', () => { closeModal('mobPromptExportModal'); exportPromptJson(); });
  on('mobPromptExportTxt', () => { closeModal('mobPromptExportModal'); exportPromptStackText(); });
}

registerMarkup(70, `<input type="file" id="filePromptInput" accept=".md,.markdown,.json,.txt" style="display:none">`);
registerMarkup(185, `<div id="mobPromptExportModal" class="modal">
  <div class="modal-box" style="max-width:340px">
    <div class="modal-head"><h2>Export Prompt Pack</h2><button class="modal-x" data-close="mobPromptExportModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <button class="btn btn-p" id="mobPromptExportMd" style="width:100%;justify-content:center;padding:.65rem">Markdown page</button>
      <button class="btn btn-s" id="mobPromptExportTxt" style="width:100%;justify-content:center;padding:.65rem">Current stack (text)</button>
      <button class="btn btn-s" id="mobPromptExportJson" style="width:100%;justify-content:center;padding:.65rem">LoreOS pack (JSON)</button>
    </div>
  </div>
</div>`);

registerTrashRestorer('prompt', data => {
  const id = data.id && !state.promptLibrary[data.id] ? data.id : promptId();
  state.promptLibrary[id] = { ...data, id };
  savePromptLibrary();
  if (state.mode === 'prompt') renderPromptSidebar();
});
