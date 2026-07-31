// ═══════════════════════════════════════════════════════
// PROMPT_WORKBENCH.JS — modular prompt builder
// Storage: localStorage 'loreos_prompts' → { id: ConfigObj }
// ConfigObj: { id, name, basePrompt, modules: [{id,name,content,enabled}], savedAt }
// ═══════════════════════════════════════════════════════

let promptLibrary = {};
let activePromptId = null;

const PLATFORM_TIPS = {
  st:        { label: 'SillyTavern',  tip: 'Paste into ST → Settings → System Prompt, or use as a "Main Prompt" in a preset.' },
  janitor:   { label: 'JanitorAI',    tip: 'Paste into the character\'s System Prompt field when editing a bot, or into the custom instructions box in a chat.' },
  saucepan:  { label: 'SaucepanAI',   tip: 'Paste into the Persona or System field when setting up a scenario. Use line breaks to separate sections.' },
};

// Rough token estimate: ~4 chars per token
function estimateTokens(str) { return Math.ceil((str||'').length / 4); }

function promptGet() {
  try { return JSON.parse(localStorage.getItem('loreos_prompts') || '{}'); } catch(e) { return {}; }
}
function promptSet(d) { try { localStorage.setItem('loreos_prompts', JSON.stringify(d)); } catch(e) {} }
function promptNewId()  { return 'pt_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function moduleNewId()  { return 'md_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

function loadPrompts() { promptLibrary = promptGet(); }
function savePrompts() { promptSet(promptLibrary); }

// ── Sidebar ──────────────────────────────────────────
function renderPromptSidebar() {
  const list = g('entryList');
  const sbTitle = g('sbTitle');
  if (sbTitle) sbTitle.textContent = 'Prompt Configs';
  list.innerHTML = '';

  const configs = Object.values(promptLibrary).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  if (!configs.length) {
    list.innerHTML = '<li style="font-family:var(--fx);font-size:.72rem;color:var(--txm);padding:.75rem;letter-spacing:.5px">no prompt configs yet</li>';
    return;
  }
  configs.forEach(c => {
    const li = document.createElement('li');
    li.className = 'ei' + (c.id === activePromptId ? ' active' : '');
    const enabledMods = (c.modules||[]).filter(m=>m.enabled!==false).length;
    li.innerHTML = `<div class="ei-name">${esc(c.name||'Untitled Config')}</div><div class="ei-meta">${enabledMods} active module${enabledMods!==1?'s':''}</div>`;
    li.addEventListener('click', () => openPromptConfig(c.id));
    list.appendChild(li);
  });
}

// ── Editor ───────────────────────────────────────────
function renderPromptEditor() {
  const ec = g('editorContent');
  if (!activePromptId || !promptLibrary[activePromptId]) {
    ec.innerHTML = `
      <div class="empty-state">
        <div>select a config or create one</div>
        <button class="btn btn-ok" onclick="createPromptConfig()">+ New Config</button>
      </div>`;
    return;
  }
  const c = promptLibrary[activePromptId];
  const platform = c.platform || 'st';
  const tip = PLATFORM_TIPS[platform] || PLATFORM_TIPS.st;

  ec.className = '';
  ec.innerHTML = `
    <div class="entry-editor pw-layout">

      <!-- Left: builder -->
      <div class="pw-builder">
        <div class="fg">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
            <label class="flabel">Config Name</label>
            <div style="display:flex;gap:.3rem">
              <button class="btn btn-p btn-sm" id="pwSaveBtn">Save</button>
              <button class="btn btn-err btn-sm" id="pwDeleteBtn">Delete</button>
            </div>
          </div>
          <input id="pwName" class="finput" value="${esc(c.name||'')}" placeholder="My Prompt Config">
        </div>

        <div class="fg" style="margin-top:.65rem">
          <label class="flabel">Base Prompt</label>
          <textarea id="pwBase" class="ftextarea pw-base-ta" placeholder="Your core system prompt...">${esc(c.basePrompt||'')}</textarea>
          <div class="pw-char-count" id="pwBaseCount">${(c.basePrompt||'').length} chars · ~${estimateTokens(c.basePrompt)} tok</div>
        </div>

        <div style="margin-top:.75rem">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem">
            <label class="flabel">Modules</label>
            <button class="btn btn-s btn-sm" id="pwAddModule">+ Add Module</button>
          </div>
          <div id="pwModuleList" class="pw-module-list"></div>
        </div>
      </div>

      <!-- Right: assembled preview -->
      <div class="pw-preview-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;flex-wrap:wrap;gap:.4rem">
          <label class="flabel">Assembled Prompt</label>
          <div style="display:flex;gap:.3rem;align-items:center">
            <select id="pwPlatform" class="fselect" style="font-size:.72rem;padding:.22rem .5rem">
              ${Object.entries(PLATFORM_TIPS).map(([k,v]) => `<option value="${k}" ${k===platform?'selected':''}>${v.label}</option>`).join('')}
            </select>
            <button class="btn btn-p btn-sm" id="pwCopyBtn">Copy</button>
          </div>
        </div>
        <div id="pwTip" class="pw-tip">${tip.tip}</div>
        <div id="pwTokenCount" class="pw-token-count">0 chars · ~0 tok</div>
        <textarea id="pwOutput" class="pw-output-ta" readonly placeholder="Enable modules and see your assembled prompt here..."></textarea>
      </div>

    </div>`;

  renderModules(c);
  assemblePrompt(c);
  wirePromptEditor(c);
}

function renderModules(c) {
  const container = g('pwModuleList');
  if (!container) return;
  const modules = c.modules || [];
  if (!modules.length) {
    container.innerHTML = '<div style="font-family:var(--fx);font-size:.72rem;color:var(--txm);padding:.4rem 0;letter-spacing:.4px">no modules — add one above</div>';
    return;
  }
  container.innerHTML = modules.map((m, i) => `
    <div class="pw-module ${m.enabled!==false?'':'pw-module-disabled'}" data-mod-id="${m.id}">
      <div class="pw-module-head">
        <label class="pw-mod-toggle cb-row" title="Enable/disable module">
          <input type="checkbox" class="pw-mod-en" data-mod-idx="${i}" ${m.enabled!==false?'checked':''}>
        </label>
        <input class="pw-mod-name finput" data-mod-idx="${i}" value="${esc(m.name||'')}" placeholder="Module name">
        <div style="display:flex;gap:.2rem">
          ${i > 0 ? `<button class="btn btn-s btn-sm pw-mod-up" data-mod-idx="${i}" title="Move up">↑</button>` : '<span style="width:1.9rem"></span>'}
          ${i < modules.length-1 ? `<button class="btn btn-s btn-sm pw-mod-down" data-mod-idx="${i}" title="Move down">↓</button>` : '<span style="width:1.9rem"></span>'}
          <button class="btn btn-err btn-sm pw-mod-del" data-mod-idx="${i}" title="Remove">✕</button>
        </div>
      </div>
      <textarea class="pw-mod-ta ftextarea" data-mod-idx="${i}" placeholder="Module content...">${esc(m.content||'')}</textarea>
      <div class="pw-char-count">${(m.content||'').length} chars · ~${estimateTokens(m.content)} tok</div>
    </div>
  `).join('');

  // Wire module interactions
  container.querySelectorAll('.pw-mod-en').forEach(cb => {
    cb.addEventListener('change', () => {
      const i = +cb.dataset.modIdx;
      promptLibrary[activePromptId].modules[i].enabled = cb.checked;
      const mod = cb.closest('.pw-module');
      if (mod) mod.classList.toggle('pw-module-disabled', !cb.checked);
      assemblePrompt(promptLibrary[activePromptId]);
    });
  });
  container.querySelectorAll('.pw-mod-name').forEach(inp => {
    inp.addEventListener('input', () => {
      promptLibrary[activePromptId].modules[+inp.dataset.modIdx].name = inp.value;
    });
  });
  container.querySelectorAll('.pw-mod-ta').forEach(ta => {
    ta.addEventListener('input', () => {
      const i = +ta.dataset.modIdx;
      promptLibrary[activePromptId].modules[i].content = ta.value;
      const countEl = ta.nextElementSibling;
      if (countEl) countEl.textContent = `${ta.value.length} chars · ~${estimateTokens(ta.value)} tok`;
      assemblePrompt(promptLibrary[activePromptId]);
    });
  });
  container.querySelectorAll('.pw-mod-up').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.modIdx;
      const mods = promptLibrary[activePromptId].modules;
      [mods[i-1], mods[i]] = [mods[i], mods[i-1]];
      renderModules(promptLibrary[activePromptId]);
      assemblePrompt(promptLibrary[activePromptId]);
    });
  });
  container.querySelectorAll('.pw-mod-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.modIdx;
      const mods = promptLibrary[activePromptId].modules;
      [mods[i], mods[i+1]] = [mods[i+1], mods[i]];
      renderModules(promptLibrary[activePromptId]);
      assemblePrompt(promptLibrary[activePromptId]);
    });
  });
  container.querySelectorAll('.pw-mod-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.modIdx;
      promptLibrary[activePromptId].modules.splice(i, 1);
      renderModules(promptLibrary[activePromptId]);
      assemblePrompt(promptLibrary[activePromptId]);
    });
  });
}

function assemblePrompt(c) {
  const base = g('pwBase')?.value ?? c.basePrompt ?? '';
  const enabledModules = (c.modules||[]).filter(m => m.enabled !== false);
  const parts = [base, ...enabledModules.map(m => m.content)].filter(Boolean);
  const assembled = parts.join('\n\n');
  const out = g('pwOutput');
  const countEl = g('pwTokenCount');
  if (out) out.value = assembled;
  if (countEl) countEl.textContent = `${assembled.length} chars · ~${estimateTokens(assembled)} tokens`;
}

function wirePromptEditor(c) {
  g('pwBase').addEventListener('input', () => {
    const val = g('pwBase').value;
    promptLibrary[activePromptId].basePrompt = val;
    const countEl = g('pwBaseCount');
    if (countEl) countEl.textContent = `${val.length} chars · ~${estimateTokens(val)} tok`;
    assemblePrompt(promptLibrary[activePromptId]);
  });

  g('pwPlatform').addEventListener('change', () => {
    const platform = g('pwPlatform').value;
    promptLibrary[activePromptId].platform = platform;
    const tip = PLATFORM_TIPS[platform] || PLATFORM_TIPS.st;
    const tipEl = g('pwTip');
    if (tipEl) tipEl.textContent = tip.tip;
  });

  g('pwAddModule').addEventListener('click', () => {
    const c2 = promptLibrary[activePromptId];
    if (!c2) return;
    c2.modules = c2.modules || [];
    c2.modules.push({ id: moduleNewId(), name: 'New Module', content: '', enabled: true });
    renderModules(c2);
  });

  g('pwCopyBtn').addEventListener('click', () => {
    const out = g('pwOutput');
    if (!out || !out.value) { toast('Nothing to copy.', 'warn'); return; }
    navigator.clipboard.writeText(out.value).then(() => toast('Prompt copied!', 'ok')).catch(() => {
      out.select(); document.execCommand('copy'); toast('Prompt copied!', 'ok');
    });
  });

  g('pwSaveBtn').addEventListener('click', () => {
    const c2 = promptLibrary[activePromptId];
    if (!c2) return;
    c2.name = g('pwName').value.trim() || 'Untitled Config';
    c2.basePrompt = g('pwBase').value;
    c2.savedAt = new Date().toISOString();
    savePrompts();
    renderPromptSidebar();
    toast('Config saved.', 'ok');
  });

  g('pwDeleteBtn').addEventListener('click', async () => {
    if (!await askConfirm('Delete this prompt config?')) return;
    delete promptLibrary[activePromptId];
    savePrompts();
    activePromptId = null;
    renderPromptSidebar();
    renderPromptEditor();
  });
}

function openPromptConfig(id) {
  activePromptId = id;
  renderPromptSidebar();
  renderPromptEditor();
}

function createPromptConfig() {
  const id = promptNewId();
  promptLibrary[id] = {
    id, name: 'New Config', basePrompt: '',
    platform: 'st', modules: [], savedAt: new Date().toISOString(),
  };
  savePrompts();
  openPromptConfig(id);
  renderPromptSidebar();
}

function exportPromptConfig() {
  const c = promptLibrary[activePromptId];
  if (!c) { toast('No config selected.', 'warn'); return; }
  const fn = (c.name||'prompt').replace(/[^a-z0-9_\- ]/gi,'_') + '_prompt.json';
  dlFile(JSON.stringify(c, null, 2), fn, 'application/json');
  toast('Prompt config exported.', 'ok');
}
