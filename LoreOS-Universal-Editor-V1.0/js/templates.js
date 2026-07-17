
let tplMode = 'lore';
let tplTargetFieldId = null;
let lastFocusedField = null; // tracks last focused textarea/input before focus is stolen by button clicks

// Track the last focused field globally — needed because clicking a button
// steals focus before the click handler can read document.activeElement
document.addEventListener('focusin', e => {
  if (['TEXTAREA','INPUT'].includes(e.target.tagName) && e.target.id !== 'tplNewName' && e.target.id !== 'tplNewContent') {
    lastFocusedField = e.target;
  }
});

function tplKey(m) { return m === 'lore' ? 'aet_tpl_lore' : m === 'preset' ? 'aet_tpl_preset' : 'aet_tpl_char'; }
function tplGet(m) { try { return JSON.parse(localStorage.getItem(tplKey(m)) || '{}'); } catch(e) { return {}; } }
function tplSet(m, d) { localStorage.setItem(tplKey(m), JSON.stringify(d)); }
function tplNewId() { return 't' + Date.now() + Math.floor(Math.random()*1000); }

function openTemplateLibrary(m, fieldId) {
  tplMode = m;
  tplTargetFieldId = fieldId || null;
  g('tplModalTitle').textContent = m === 'lore' ? '// Lorebook Templates' : m === 'preset' ? '// Prompt Library' : '// Character Templates';
  g('tplSaveBtn').onclick = () => tplSaveCurrent(m, fieldId || null);
  renderTemplateList(m);
  openModal('tplModal');
}

function renderTemplateList(m) {
  const list = g('tplList');
  list.innerHTML = '';

  // For preset mode: show ST anchor blocks at the top, then saved prompts below
  if (m === 'preset') {
    // ST Anchors section
    const anchorHeader = document.createElement('div');
    anchorHeader.style.cssText = 'font-family:var(--fx);font-size:.72rem;color:var(--p);letter-spacing:1px;padding:.25rem 0 .4rem;border-bottom:1px solid var(--bd);margin-bottom:.4rem';
    anchorHeader.textContent = '// ST System Anchors';
    list.append(anchorHeader);

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
        const entry2 = presetLibrary[activePresetId];
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

    // Saved prompts section
    const tpls = tplGet(m);
    const items = Object.values(tpls).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
    if (items.length) {
      const savedHeader = document.createElement('div');
      savedHeader.style.cssText = 'font-family:var(--fx);font-size:.72rem;color:var(--p);letter-spacing:1px;padding:.5rem 0 .4rem;border-bottom:1px solid var(--bd);margin-bottom:.4rem;margin-top:.5rem';
      savedHeader.textContent = '// Saved Prompts';
      list.append(savedHeader);
      renderSavedTemplates(items, m, list);
    }
    return;
  }

  // Lore / char modes — just saved templates
  const tpls = tplGet(m);
  const items = Object.values(tpls).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  if (!items.length) {
    list.innerHTML = '<div class="lib-empty">// no templates yet — save a field to get started</div>';
    return;
  }
  renderSavedTemplates(items, m, list);
}

function renderSavedTemplates(items, m, list) {
  items.forEach(tpl => {
    const item = document.createElement('div');
    item.className = 'tpl-item';
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="tpl-name">${tpl.name}</div>
        <div class="tpl-preview">${(tpl.content||'').substring(0,80).replace(/\n/g,' ')}</div>
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

function tplPaste(tpl) {
  // If a target field is set, paste there; otherwise paste into last focused field
  const el = tplTargetFieldId ? g(tplTargetFieldId) : lastFocusedField;
  if (!el || !['TEXTAREA','INPUT'].includes(el.tagName)) {
    toast('Focus a field first, then paste.', 'warn'); return;
  }
  el.value = tpl.content;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  closeModal('tplModal');
  toast(`Pasted "${tpl.name}".`, 'ok');
}

async function tplSaveCurrent(m, fieldId) {
  const name = g('tplNewName').value.trim();
  if (!name) { toast('Enter a template name.', 'warn'); return; }

  // prefer content typed/pasted directly; fall back to focused field
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

function wireTplLibrary() {
  // Template buttons also openable from right-click context on textareas?
  // For now: dedicated buttons in header already wired in wireEvents
  // Ctrl+T shortcut within char/lore mode
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      const fieldId = lastFocusedField?.id || null;
      openTemplateLibrary(mode === 'char' ? 'char' : 'lore', fieldId);
    }
  });
}

