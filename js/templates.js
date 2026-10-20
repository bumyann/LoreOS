// ═══════════════════════════════════════════════════════
// TEMPLATES — the template library: built-in and saved templates for lorebook entries,
// character fields and prompts, plus the new-entry type picker.
// ═══════════════════════════════════════════════════════

import { createEntry, openInTab, renderList } from './lorebook.js';
import { blankEntry } from './lorebook_model.js';
import { renderPromptList, ST_SPECIAL, syncPromptOrder } from './preset.js';
import { state } from './state.js';
import { safeSet } from './storage.js';
import { BUILTIN_TEMPLATES } from './templates_data.js';
import { askConfirm, closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import { store } from './kv.js';

export let tplMode = 'lore';
export let tplTargetFieldId = null;
export let lastFocusedField = null;

document.addEventListener('focusin', e => {
  if (['TEXTAREA','INPUT'].includes(e.target.tagName) && e.target.id !== 'tplNewName' && e.target.id !== 'tplNewContent') {
    lastFocusedField = e.target;
  }
});

export function tplKey(m) { return m === 'lore' ? 'aet_tpl_lore' : m === 'preset' ? 'aet_tpl_preset' : 'aet_tpl_char'; }
export function tplGet(m) { try { return JSON.parse(store.get(tplKey(m)) || '{}'); } catch(e) { return {}; } }
export function tplSet(m, d) { return safeSet(tplKey(m), JSON.stringify(d)); }
export function tplNewId() { return 't' + Date.now() + Math.floor(Math.random()*1000); }

// ═══════════════════════════════════════════════════════
// TEMPLATE LIBRARY MODAL
// ═══════════════════════════════════════════════════════
export function openTemplateLibrary(m, fieldId) {
  tplMode = m;
  tplTargetFieldId = fieldId || null;
  g('tplModalTitle').textContent = m === 'lore' ? 'Lorebook Templates' : m === 'preset' ? 'Prompt Library' : 'Character Templates';
  g('tplSaveBtn').onclick = () => tplSaveCurrent(m, fieldId || null);
  renderTemplateList(m);
  openModal('tplModal');
}

export function renderTemplateList(m) {
  const list = g('tplList');
  list.innerHTML = '';

  if (m === 'preset') {
    renderPresetAnchors(list);
    const tpls = tplGet(m);
    const items = Object.values(tpls).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
    if (items.length) {
      list.append(makeSectionHeader('Saved Prompts'));
      renderSavedTemplates(items, m, list);
    }
    return;
  }

  // Built-in collapsible groups
  const builtins = BUILTIN_TEMPLATES[m] || [];
  builtins.forEach(group => {
    const groupEl = makeCollapsibleGroup(group.category, group.items, m);
    list.append(groupEl);
  });

  // User-saved templates
  const tpls = tplGet(m);
  const items = Object.values(tpls).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  if (items.length) {
    list.append(makeSectionHeader('Saved'));
    renderSavedTemplates(items, m, list);
  } else if (!builtins.length) {
    list.innerHTML = '<div class="lib-empty">// no templates yet — save a field to get started</div>';
  }
}

export function makeSectionHeader(text) {
  const el = document.createElement('div');
  el.style.cssText = 'font-family:var(--fx);font-size:.72rem;color:var(--p);letter-spacing:1px;padding:.35rem 0 .3rem;border-bottom:1px solid var(--bd);margin:.3rem 0 .2rem';
  el.textContent = text;
  return el;
}

export function makeCollapsibleGroup(categoryName, items, m) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'border:1px solid var(--bd);border-radius:4px;overflow:hidden;margin-bottom:.3rem';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.4rem .65rem;background:var(--bg3);cursor:pointer;user-select:none';
  header.innerHTML = `
    <span style="font-family:var(--fx);font-size:.75rem;color:var(--txd);letter-spacing:.5px">${categoryName}</span>
    <span class="tpl-chevron" style="font-size:.65rem;color:var(--txm);transition:transform .15s">▼</span>
  `;

  const body = document.createElement('div');
  body.style.cssText = 'display:none;flex-direction:column;gap:.25rem;padding:.3rem .4rem';

  items.forEach(tpl => {
    const item = makeBuiltinItem(tpl, m);
    body.append(item);
  });

  header.addEventListener('click', () => {
    const isOpen = body.style.display === 'flex';
    body.style.display = isOpen ? 'none' : 'flex';
    header.querySelector('.tpl-chevron').style.transform = isOpen ? '' : 'rotate(180deg)';
  });

  wrapper.append(header, body);
  return wrapper;
}

export function makeBuiltinItem(tpl, m) {
  const item = document.createElement('div');
  item.className = 'tpl-item';
  item.innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="tpl-name" style="display:flex;align-items:center;gap:.4rem">
        ${esc(tpl.name)}
        <span style="font-family:var(--fx);font-size:.56rem;padding:1px 4px;background:var(--sf2);border:1px solid var(--bd);border-radius:2px;color:var(--txm)">built-in</span>
      </div>
      <div class="tpl-preview">${tpl.hint ? esc(tpl.hint) : esc(tpl.content.substring(0,60).replace(/\n/g,' ')) + '…'}</div>
    </div>
    <div class="tpl-acts">
      <button class="btn btn-p btn-sm tpl-paste">Paste</button>
    </div>`;
  item.querySelector('.tpl-name').addEventListener('click', () => tplPaste(tpl));
  item.querySelector('.tpl-paste').addEventListener('click', () => tplPaste(tpl));
  return item;
}

export function renderPresetAnchors(list) {
  list.append(makeSectionHeader('ST System Anchors'));
  Object.entries(ST_SPECIAL).forEach(([id, info]) => {
    const item = document.createElement('div');
    item.className = 'tpl-item';
    item.style.background = 'var(--bg3)';
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="tpl-name" style="display:flex;align-items:center;gap:.4rem">
          ${info.label}
          <span style="font-family:var(--fx);font-size:.58rem;padding:1px 4px;background:var(--sf2);border:1px solid var(--bd);border-radius:2px;color:var(--p)">${id}</span>
        </div>
        <div class="tpl-preview">${info.desc}</div>
      </div>
      <div class="tpl-acts">
        <button class="btn btn-p btn-sm tpl-anchor-add">+ Add</button>
      </div>`;
    item.querySelector('.tpl-anchor-add').addEventListener('click', () => {
      const entry2 = state.presetLibrary[state.activePresetId];
      if (!entry2) { toast('Open a preset first.', 'warn'); return; }
      const newPr = {
        id, identifier: id,
        name: info.label.replace(/[^\w\s\-—]/g,'').trim(),
        content: '', enabled: true, role: 'system',
        system_prompt: id === 'main', marker: true,
        injection_position: 0, injection_depth: 4,
        injection_order: 100, injection_trigger: [], forbid_overrides: false
      };
      if (!entry2.preset.prompts) entry2.preset.prompts = [];
      entry2.preset.prompts.push(newPr);
      syncPromptOrder(entry2.preset);
      renderPromptList(entry2.preset.prompts);
      closeModal('tplModal');
      toast(`Added ${info.label} anchor.`, 'ok');
    });
    list.append(item);
  });
}

export function renderSavedTemplates(items, m, list) {
  items.forEach(tpl => {
    const item = document.createElement('div');
    item.className = 'tpl-item';
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="tpl-name">${esc(tpl.name)}</div>
        <div class="tpl-preview">${esc((tpl.content||'').substring(0,80).replace(/\n/g,' '))}</div>
      </div>
      <div class="tpl-acts">
        <button class="btn btn-p btn-sm tpl-paste">Paste</button>
        <button class="btn btn-err btn-sm tpl-del">✕</button>
      </div>`;
    item.querySelector('.tpl-name').addEventListener('click', () => tplPaste(tpl));
    item.querySelector('.tpl-paste').addEventListener('click', () => tplPaste(tpl));
    item.querySelector('.tpl-del').addEventListener('click', async () => {
      if (!await askConfirm(`Delete "${tpl.name}"?`)) return;
      const d = tplGet(m); delete d[tpl.id]; tplSet(m, d);
      renderTemplateList(m);
    });
    list.append(item);
  });
}

export function tplPaste(tpl) {
  const el = tplTargetFieldId ? g(tplTargetFieldId) : lastFocusedField;
  if (!el || !['TEXTAREA','INPUT'].includes(el.tagName)) {
    toast('Focus a field first, then paste.', 'warn'); return;
  }
  el.value = tpl.content;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  // Lorebook entry templates carry suggested keywords: fill them in only if
  // the entry's Primary keywords field is still empty
  const m = /^eContent-(\d+)$/.exec(el.id || '');
  if (m && Array.isArray(tpl.keys) && tpl.keys.length) {
    const kw = g('eKw-' + m[1]);
    if (kw && !kw.value.trim()) {
      kw.value = tpl.keys.join(', ');
      kw.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  closeModal('tplModal');
  toast(`Pasted "${tpl.name}".`, 'ok');
}

export async function tplSaveCurrent(m, fieldId) {
  const name = g('tplNewName').value.trim();
  if (!name) { toast('Enter a template name.', 'warn'); return; }
  const directContent = g('tplNewContent')?.value || '';
  let content = directContent.trim();
  if (!content) {
    const el = fieldId ? g(fieldId) : lastFocusedField;
    content = (el && ['TEXTAREA','INPUT'].includes(el.tagName)) ? el.value.trim() : '';
  }
  if (!content) { toast('No content — paste into the box or focus a field.', 'warn'); return; }
  const d = tplGet(m);
  const id = tplNewId();
  d[id] = { id, name, content, savedAt: new Date().toISOString() };
  tplSet(m, d);
  g('tplNewName').value = '';
  if (g('tplNewContent')) g('tplNewContent').value = '';
  renderTemplateList(m);
  toast(`Saved template "${name}".`, 'ok');
}

// ═══════════════════════════════════════════════════════
// ENTRY TYPE PICKER (+ New Entry flow)
// ═══════════════════════════════════════════════════════
export function openEntryPicker() {
  const categories = g('pickerCategories');
  categories.innerHTML = '';

  BUILTIN_TEMPLATES.lore.forEach(group => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-s';
    btn.style.cssText = 'justify-content:flex-start;padding:.5rem .75rem;text-align:left';
    btn.textContent = group.category;
    btn.addEventListener('click', () => {
      closeModal('entryPickerModal');
      // Create entry first, then open template library scoped to this category
      const uid = state.nextUid++;
      state.lorebook.entries[uid] = blankEntry(uid);
      renderList();
      openInTab(uid);
      // Open template library filtered to this category
      openTemplateLibraryFiltered('lore', group.category, `eContent-${uid}`);
    });
    categories.append(btn);
  });

  openModal('entryPickerModal');
}

export function openTemplateLibraryFiltered(m, categoryFilter, fieldId) {
  tplMode = m;
  tplTargetFieldId = fieldId;
  g('tplModalTitle').textContent = `// ${categoryFilter}`;
  g('tplSaveBtn').onclick = () => tplSaveCurrent(m, fieldId);

  const list = g('tplList');
  list.innerHTML = '';

  const builtins = BUILTIN_TEMPLATES[m] || [];
  const group = builtins.find(g => g.category === categoryFilter);
  if (group) {
    group.items.forEach(tpl => {
      list.append(makeBuiltinItem(tpl, m));
    });
  }

  // Also show user saved
  const tpls = tplGet(m);
  const items = Object.values(tpls).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  if (items.length) {
    list.append(makeSectionHeader('Saved'));
    renderSavedTemplates(items, m, list);
  }

  openModal('tplModal');
}

// ═══════════════════════════════════════════════════════
// WIRE
// ═══════════════════════════════════════════════════════
export function wireTplLibrary() {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      const fieldId = lastFocusedField?.id || null;
      openTemplateLibrary(state.mode === 'char' ? 'char' : 'lore', fieldId);
    }
  });

  // Entry picker button
  g('pickerBlank').addEventListener('click', () => {
    closeModal('entryPickerModal');
    createEntry();
  });
}

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(210, `<!-- TEMPLATE LIBRARY MODAL -->
<div id="tplModal" class="modal">
  <div class="modal-box">
    <div class="modal-head"><h2 id="tplModalTitle">Templates</h2><button class="modal-x" data-close="tplModal">×</button></div>
    <div class="modal-body">
      <div id="tplList" class="tpl-list"></div>
      <div class="tpl-save-row">
        <input type="text" id="tplNewName" placeholder="Template name...">
        <textarea id="tplNewContent" style="width:100%;min-height:80px;background:var(--sf);border:1px solid var(--bd);border-radius:3px;color:var(--tx);font-family:var(--fb);font-size:.82rem;padding:.45rem .6rem;resize:vertical;line-height:1.6" placeholder="Paste or write template content here... (leave blank to save from focused field)"></textarea>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-ok" id="tplSaveBtn" style="flex:1">Save Template</button>
        </div>
      </div>
      <div style="display:flex;gap:.4rem;margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--bd);flex-wrap:wrap">
        <button class="btn btn-s btn-sm" id="tplExportSelBtn">⬇ Export Templates</button>
        <button class="btn btn-s btn-sm" id="tplImportSelBtn">⬆ Import Templates</button>
        <input type="file" id="tplImportSelFile" accept=".json" style="display:none">
      </div>
    </div>
  </div>
</div>`);

registerMarkup(320, `<!-- ENTRY TYPE PICKER MODAL -->
<div id="entryPickerModal" class="modal">
  <div class="modal-box" style="max-width:420px">
    <div class="modal-head"><h2>New Entry</h2><button class="modal-x" data-close="entryPickerModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.5rem">
      <button class="btn btn-ok" id="pickerBlank" style="justify-content:center;padding:.65rem">✦ Blank Entry</button>
      <div style="font-family:var(--fx);font-size:.68rem;color:var(--txm);letter-spacing:1px;padding:.3rem 0 .1rem">// or start from a template</div>
      <div id="pickerCategories" style="display:flex;flex-direction:column;gap:.3rem"></div>
    </div>
  </div>
</div>`);

