// ═══════════════════════════════════════════════════════
// PRESET EDITOR
// ═══════════════════════════════════════════════════════

// ── Blank preset matching ST chat completion format ──
function blankPreset() {
  return {
    name: 'New Preset',
    temperature: 0.8, top_p: 1, top_k: 0, top_a: 0, min_p: 0,
    frequency_penalty: 0, presence_penalty: 0, repetition_penalty: 1,
    openai_max_context: 16384, openai_max_tokens: 4096,
    stream_openai: false, use_sysprompt: true, squash_system_messages: false,
    send_if_empty: '', assistant_prefill: '', assistant_impersonation: '',
    names_behavior: 0, wi_format: '{0}', scenario_format: '{{scenario}}',
    personality_format: '{{personality}}',
    impersonation_prompt: '[Write your next reply from the point of view of {{user}}.]',
    new_chat_prompt: '[Start a new Chat]',
    new_group_chat_prompt: '[Start a new group chat. Group members: {{group}}]',
    new_example_chat_prompt: '[Example Chat]',
    continue_nudge_prompt: '[Continue the following message: {{lastChatMessage}}]',
    group_nudge_prompt: '[Write the next reply only as {{char}}.]',
    show_thoughts: false, reasoning_effort: 'auto', verbosity: 'auto',
    tool_reasoning_mode: 'disabled', max_context_unlocked: false,
    function_calling: false, enable_web_search: false,
    media_inlining: false, inline_image_quality: 'low',
    seed: -1, n: 1, continue_prefill: false, continue_postfix: ' ',
    tool_call_recurse_limit: 5, request_images: false,
    prompts: [], prompt_order: [{ id: 0, character_id: 0, order: [] }],
    extensions: { regex_scripts: [] }
  };
}

function presetId() { return 'p' + Date.now() + Math.floor(Math.random()*1000); }

function createPreset() {
  const p = blankPreset();
  const id = presetId();
  presetLibrary[id] = { id, name: p.name, preset: p, savedAt: new Date().toISOString() };
  savePresetLibrary();
  renderPresetSidebar();
  openPreset(id);
}

function openPreset(id) {
  activePresetId = id;
  renderPresetSidebar();
  renderPresetEditor();
}

function renderPresetSidebar() {
  const list = g('entryList');
  const count = g('entryCount');
  const presets = Object.values(presetLibrary).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  count.textContent = `${presets.length} ${presets.length === 1 ? 'preset' : 'presets'}`;
  list.innerHTML = '';

  if (!presets.length) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:1.2rem .75rem;text-align:center;font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:1px';
    li.textContent = 'no presets yet';
    list.append(li); return;
  }

  presets.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'ei' + (entry.id === activePresetId ? ' open' : '');
    const head = document.createElement('div'); head.className = 'ei-head';
    const emoji = document.createElement('span'); emoji.className = 'ei-emoji'; emoji.textContent = '⚙';
    const name = document.createElement('div'); name.className = 'ei-name';
    name.textContent = entry.name || 'Untitled Preset';
    head.append(emoji, name); li.append(head);

    const acts = document.createElement('div'); acts.className = 'ei-acts';
    [['⧉','Duplicate',() => duplicatePreset(entry.id),''],
     ['✕','Delete',() => deletePreset(entry.id),'del']].forEach(([lbl,title,fn,cls]) => {
      const b = document.createElement('button');
      b.className = 'ei-act' + (cls?' '+cls:''); b.title = title; b.textContent = lbl;
      b.addEventListener('click', e2 => { e2.stopPropagation(); fn(); });
      acts.append(b);
    });
    li.append(acts);

    const meta = document.createElement('div'); meta.className = 'ei-kws';
    const p = entry.preset;
    [`🌡 ${p.temperature}`,`prompts: ${(p.prompts||[]).length}`].forEach(t => {
      const tag = document.createElement('span'); tag.className = 'kw-tag'; tag.textContent = t; meta.append(tag);
    });
    li.append(meta);
    li.addEventListener('click', () => openPreset(entry.id));
    list.append(li);
  });
}

function duplicatePreset(id) {
  const src = presetLibrary[id]; if (!src) return;
  const newId = presetId();
  const p = JSON.parse(JSON.stringify(src.preset));
  p.name = (p.name || 'Untitled') + ' (Copy)';
  presetLibrary[newId] = { id: newId, name: p.name, preset: p, savedAt: new Date().toISOString() };
  savePresetLibrary(); renderPresetSidebar(); openPreset(newId);
}

async function deletePreset(id) {
  if (!await askConfirm('Delete this preset?')) return;
  delete presetLibrary[id];
  if (activePresetId === id) activePresetId = null;
  savePresetLibrary(); renderPresetSidebar(); renderPresetEditor();
}

function renderPresetEditor() {
  const ec = g('editorContent');
  g('tabBar').innerHTML = '';
  if (!activePresetId || !presetLibrary[activePresetId]) {
    ec.className = '';
    ec.innerHTML = `<div class="empty-state"><div>// select or create a preset</div><button class="btn btn-ok" id="newEntryBtnAlt">+ New Preset</button></div>`;
    g('newEntryBtnAlt').onclick = createPreset; return;
  }
  const entry = presetLibrary[activePresetId];
  const p = entry.preset;
  const esc = t => { const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; };

  ec.className = '';
  ec.innerHTML = `<div class="entry-editor" style="max-width:960px">

    <div class="fg">
      <label class="flabel">Preset Name</label>
      <input id="psName" class="finput" value="${esc(p.name)}" placeholder="Preset name...">
    </div>

    <!-- SAMPLERS -->
    <div class="adv open" style="border:1px solid var(--bdb)">
      <div class="adv-head open" id="psSamplerHead">
        <span class="adv-title" style="color:var(--p)">⚗ Sampler Settings</span>
        <span class="adv-arr open" id="psSamplerArr">▶</span>
      </div>
      <div class="adv-body open" id="psSamplerBody">
        <div class="adv-grid">
          ${presetSlider('psTemp','Temperature',p.temperature,0,2,0.01)}
          ${presetSlider('psTopP','Top P',p.top_p,0,1,0.01)}
          ${presetSlider('psTopK','Top K',p.top_k,0,200,1)}
          ${presetSlider('psTopA','Top A',p.top_a,0,1,0.01)}
          ${presetSlider('psMinP','Min P',p.min_p,0,1,0.01)}
          ${presetSlider('psRepPen','Repetition Penalty',p.repetition_penalty,1,2,0.01)}
          ${presetSlider('psFreqPen','Frequency Penalty',p.frequency_penalty,0,2,0.01)}
          ${presetSlider('psPresPen','Presence Penalty',p.presence_penalty,0,2,0.01)}
          <div class="fg"><label class="flabel-sm">Max Context</label><input type="number" id="psMaxCtx" class="fnum" style="width:100px" value="${p.openai_max_context}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Max Tokens</label><input type="number" id="psMaxTok" class="fnum" style="width:100px" value="${p.openai_max_tokens}" min="0"></div>
          <div class="fg"><label class="flabel-sm">Seed (-1 = random)</label><input type="number" id="psSeed" class="fnum" style="width:100px" value="${p.seed}"></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="psMaxCtxUnlocked" ${p.max_context_unlocked?'checked':''}><span class="flabel-sm">Unlock Max Context</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="psStream" ${p.stream_openai?'checked':''}><span class="flabel-sm">Stream</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="psUseSys" ${p.use_sysprompt?'checked':''}><span class="flabel-sm">Use System Prompt</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="psSquash" ${p.squash_system_messages?'checked':''}><span class="flabel-sm">Squash System Messages</span></label></div>
          <div class="fg"><label class="cb-row"><input type="checkbox" id="psShowThoughts" ${p.show_thoughts?'checked':''}><span class="flabel-sm">Show Thoughts</span></label></div>
          <div class="fg"><label class="flabel-sm">Reasoning Effort</label>
            <select id="psReasoningEffort" class="fselect">
              ${['auto','low','medium','high','disabled'].map(v=>`<option value="${v}" ${p.reasoning_effort===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="fg"><label class="flabel-sm">Verbosity</label>
            <select id="psVerbosity" class="fselect">
              ${['auto','concise','detailed'].map(v=>`<option value="${v}" ${p.verbosity===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="fg"><label class="flabel-sm">Tool Reasoning Mode</label>
            <select id="psTRMode" class="fselect">
              ${['disabled','auto','chain_of_thought'].map(v=>`<option value="${v}" ${p.tool_reasoning_mode===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="fg"><label class="flabel-sm">Names Behavior</label>
            <select id="psNamesBehavior" class="fselect">
              <option value="0" ${p.names_behavior===0?'selected':''}>Default</option>
              <option value="1" ${p.names_behavior===1?'selected':''}>Always</option>
              <option value="2" ${p.names_behavior===2?'selected':''}>Never</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- PROMPT STRING FIELDS -->
    <div class="adv">
      <div class="adv-head" id="psStringsHead"><span class="adv-title">📝 Prompt Strings</span><span class="adv-arr" id="psStringsArr">▶</span></div>
      <div class="adv-body" id="psStringsBody">
        <div style="display:flex;flex-direction:column;gap:.65rem">
          ${presetStringField('psAssistPrefill','Assistant Prefill',p.assistant_prefill)}
          ${presetStringField('psAssistImperson','Assistant Impersonation',p.assistant_impersonation)}
          ${presetStringField('psSendEmpty','Send If Empty',p.send_if_empty)}
          ${presetStringField('psWiFormat','WI Format',p.wi_format)}
          ${presetStringField('psScenarioFmt','Scenario Format',p.scenario_format)}
          ${presetStringField('psPersonalityFmt','Personality Format',p.personality_format)}
          ${presetStringField('psImpersonPrompt','Impersonation Prompt',p.impersonation_prompt,true)}
          ${presetStringField('psNewChatPrompt','New Chat Prompt',p.new_chat_prompt)}
          ${presetStringField('psNewGroupPrompt','New Group Chat Prompt',p.new_group_chat_prompt)}
          ${presetStringField('psNewExamplePrompt','New Example Chat Prompt',p.new_example_chat_prompt)}
          ${presetStringField('psContinueNudge','Continue Nudge Prompt',p.continue_nudge_prompt,true)}
          ${presetStringField('psContinuePostfix','Continue Postfix',p.continue_postfix)}
          ${presetStringField('psGroupNudge','Group Nudge Prompt',p.group_nudge_prompt)}
        </div>
      </div>
    </div>

    <!-- PROMPTS LIST -->
    <div class="adv open" style="border:1px solid var(--bdb)">
      <div class="adv-head open" id="psPromptsHead" style="flex-wrap:wrap;gap:.4rem">
        <span class="adv-title" style="color:var(--p)">📋 Prompts <span style="color:var(--txm);font-size:.7em">(drag to reorder)</span></span>
        <div style="display:flex;gap:.3rem;margin-left:auto;flex-wrap:wrap">
          <button class="btn btn-s btn-sm" id="psScrollBot">⬇ Jump to Bottom</button>
          <button class="btn btn-s btn-sm" id="psCollapseAll">▶ Collapse All</button>
          <button class="btn btn-s btn-sm" id="psExpandAll">▼ Expand All</button>
        </div>
      </div>
      <div id="psSearchBarWrap" style="padding:.4rem .75rem;border-bottom:1px solid var(--bdb);background:var(--bg2);display:flex;gap:.4rem;align-items:center">
        <input type="text" id="psPromptSearch" class="finput" style="flex:1;font-size:.78rem;padding:.28rem .55rem" placeholder="Search prompts by name or content...">
        <span id="psPromptSearchCount" style="font-family:var(--fx);font-size:.65rem;color:var(--txm);white-space:nowrap"></span>
        <button class="btn btn-s btn-sm" id="psPromptSearchPrev">↑</button>
        <button class="btn btn-s btn-sm" id="psPromptSearchNext">↓</button>
      </div>
      <div class="adv-body open" id="psPromptList" style="display:flex;flex-direction:column;gap:.4rem;padding:.75rem"></div>
      <!-- bottom bar: just back-to-top -->
      <div style="padding:.45rem .75rem;border-top:1px solid var(--bd);display:flex;justify-content:flex-start">
        <button class="btn btn-s btn-sm" id="psScrollTop">⬆ Back to Top</button>
      </div>
    </div>

    <!-- VARIABLES PANEL -->
    <div class="adv">
      <div class="adv-head" id="psVarsHead">
        <span class="adv-title">🔡 Variables <span style="color:var(--txm);font-size:.7em">(setvar/getvar)</span></span>
        <div style="display:flex;gap:.3rem;align-items:center">
          <button class="btn btn-s btn-sm" id="psScanVars">Scan</button>
          <span class="adv-arr" id="psVarsArr">▶</span>
        </div>
      </div>
      <div class="adv-body" id="psVarsBody">
        <div id="psVarsList" style="display:flex;flex-direction:column;gap:.65rem">
          <div style="font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:.5px">// press Scan to detect variables from prompt content</div>
        </div>
      </div>
    </div>

    <div class="editor-actions">
      <button class="btn btn-p" id="psSaveBtn">Save Preset</button>
      <button class="btn btn-s item-ur-btn" id="psUndoBtn" title="Undo last change" disabled>↩ Undo</button>
      <button class="btn btn-s item-ur-btn" id="psRedoBtn" title="Redo" disabled>Redo ↪</button>
      <button class="btn btn-s" id="psExportBtn">Export JSON</button>
      <button class="btn btn-err" id="psDeleteBtn">Delete Preset</button>
    </div>
  </div>`;

  // Render prompt list
  renderPromptList(p.prompts || []);

  // Wire events
  g('psStringsHead').addEventListener('click', () => {
    g('psStringsBody').classList.toggle('open');
    g('psStringsArr').classList.toggle('open');
    g('psStringsHead').classList.toggle('open');
  });

  // Inject expand buttons + tok-count into string textareas
  ec.querySelectorAll('.ftextarea').forEach(ta => {
    if (!ta.id) return;
    const label = ta.closest('.fg')?.querySelector('.flabel-sm')?.textContent || ta.id;
    if (!ta.parentElement.classList.contains('content-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'content-wrap';
      ta.parentNode.insertBefore(wrap, ta);
      wrap.appendChild(ta);
    }
    const wrap = ta.parentElement;
    const tok = document.createElement('span');
    tok.className = 'tok-count';
    const updateTok = () => {
      const t = Math.round((ta.value || '').length / 3.5);
      tok.textContent = (ta.value || '').length + ' chars · ~' + t + ' tokens';
      tok.className = 'tok-count';
    };
    ta.addEventListener('input', updateTok);
    updateTok();
    const btn = document.createElement('button');
    btn.className = 'expand-btn'; btn.textContent = '⛶ expand';
    btn.dataset.fieldId = ta.id; btn.dataset.label = label;
    btn.addEventListener('click', e => { e.preventDefault(); openFullscreen(ta.id, label); });
    wrap.append(tok, btn);
  });

  // Sampler collapse toggle
  g('psSamplerHead').addEventListener('click', () => {
    g('psSamplerBody').classList.toggle('open');
    g('psSamplerArr').classList.toggle('open');
    g('psSamplerHead').classList.toggle('open');
  });

  // Prompts collapse toggle — only clicking the title area, not buttons inside the head
  g('psPromptsHead').addEventListener('click', e => {
    if (e.target.closest('button')) return; // don't collapse when clicking action buttons
    g('psPromptList').classList.toggle('open');
    g('psPromptsHead').classList.toggle('open');
  });

  g('psScrollTop').addEventListener('click', () => { g('editorContent').scrollTop = 0; });
  g('psScrollBot').addEventListener('click', () => { g('editorContent').scrollTop = g('editorContent').scrollHeight; });

  g('psCollapseAll').addEventListener('click', () => {
    const entry2 = presetLibrary[activePresetId]; if (!entry2) return;
    getOrderedPrompts(entry2.preset).forEach(pr => collapsedPrompts.add(pr.identifier || pr.id));
    renderPromptList(entry2.preset.prompts);
  });

  g('psExpandAll').addEventListener('click', () => {
    collapsedPrompts.clear();
    const entry2 = presetLibrary[activePresetId]; if (!entry2) return;
    renderPromptList(entry2.preset.prompts);
  });

  // Prompt search
  let psSearchMatches = [], psSearchIdx = 0;

  function runPromptSearch() {
    const q = g('psPromptSearch').value.trim().toLowerCase();
    const nodes = [...g('psPromptList').querySelectorAll('[data-prompt-id]')];
    psSearchMatches = [];

    nodes.forEach(node => {
      const name = (node.querySelector('input.finput')?.value || node.querySelector('.tpl-name')?.textContent || '').toLowerCase();
      const content = (node.querySelector('textarea')?.value || '').toLowerCase();
      const hit = q && (name.includes(q) || content.includes(q));
      node.style.outline = '';
      node.style.outlineOffset = '';
      if (hit) psSearchMatches.push(node);
    });

    if (!q) {
      g('psPromptSearchCount').textContent = '';
      return;
    }
    if (!psSearchMatches.length) {
      g('psPromptSearchCount').textContent = 'no matches';
      return;
    }
    psSearchIdx = 0;
    jumpToMatch();
  }

  function jumpToMatch() {
    if (!psSearchMatches.length) return;
    psSearchMatches.forEach(n => { n.style.outline = '1px solid var(--bdb)'; n.style.outlineOffset = '1px'; });
    const current = psSearchMatches[psSearchIdx];
    current.style.outline = '2px solid var(--p)';
    current.style.outlineOffset = '2px';
    current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    g('psPromptSearchCount').textContent = `${psSearchIdx + 1} / ${psSearchMatches.length}`;
  }

  g('psPromptSearch').addEventListener('input', runPromptSearch);
  g('psPromptSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.shiftKey ? psSearchPrev() : psSearchNext(); }
    if (e.key === 'Escape') { g('psPromptSearch').value = ''; runPromptSearch(); }
  });
  g('psPromptSearchNext').addEventListener('click', psSearchNext);
  g('psPromptSearchPrev').addEventListener('click', psSearchPrev);

  // Sticky search bar — CSS sticky doesn't work in nested overflow containers,
  // so we watch the scroll position and pin via fixed positioning when needed
  const searchBar = g('psSearchBarWrap');
  const editorScroll = g('editorContent');

  function updateSearchBarSticky() {
    if (!searchBar || !editorScroll) return;
    const barTop = searchBar.getBoundingClientRect().top;
    const editorTop = editorScroll.getBoundingClientRect().top;
    if (barTop <= editorTop) {
      // Bar has scrolled past the top — pin it
      const barRect = searchBar.getBoundingClientRect();
      if (!searchBar._sticky) {
        searchBar._placeholder = document.createElement('div');
        searchBar._placeholder.style.height = searchBar.offsetHeight + 'px';
        searchBar.parentNode.insertBefore(searchBar._placeholder, searchBar);
        searchBar.style.cssText += `;position:fixed;top:${editorTop}px;left:${editorScroll.getBoundingClientRect().left}px;width:${editorScroll.clientWidth}px;z-index:20;box-shadow:0 2px 8px rgba(0,0,0,.4)`;
        searchBar._sticky = true;
      }
    } else {
      if (searchBar._sticky) {
        searchBar._placeholder?.remove();
        searchBar._placeholder = null;
        searchBar.style.position = '';
        searchBar.style.top = '';
        searchBar.style.left = '';
        searchBar.style.width = '';
        searchBar.style.zIndex = '';
        searchBar.style.boxShadow = '';
        searchBar._sticky = false;
      }
    }
  }

  editorScroll.addEventListener('scroll', updateSearchBarSticky);
  // Clean up on mode switch or preset change
  const _origOpenPreset = openPreset;
  // Store scroll listener ref for cleanup when preset re-renders
  searchBar._scrollCleanup = () => editorScroll.removeEventListener('scroll', updateSearchBarSticky);

  function psSearchNext() { if (!psSearchMatches.length) return; psSearchIdx = (psSearchIdx + 1) % psSearchMatches.length; jumpToMatch(); }
  function psSearchPrev() { if (!psSearchMatches.length) return; psSearchIdx = (psSearchIdx - 1 + psSearchMatches.length) % psSearchMatches.length; jumpToMatch(); }

  // (special prompt buttons moved to Prompt Library)

  g('psSaveBtn').addEventListener('click', savePreset);
  g('psExportBtn').addEventListener('click', exportPreset);
  g('psDeleteBtn').addEventListener('click', () => deletePreset(activePresetId));

  // Item-level undo/redo
  if (g('psUndoBtn')) g('psUndoBtn').addEventListener('click', () => {
    const snap = itemUndoGet('preset', activePresetId, 'undo');
    if (!snap) return;
    presetFormState = snap;
    renderPresetEditor();
    syncItemUndoButtons('preset', activePresetId);
  });
  if (g('psRedoBtn')) g('psRedoBtn').addEventListener('click', () => {
    const snap = itemUndoGet('preset', activePresetId, 'redo');
    if (!snap) return;
    presetFormState = snap;
    renderPresetEditor();
    syncItemUndoButtons('preset', activePresetId);
  });

  // Wire field-level undo/redo on preset textareas
  if (typeof wireFieldUndoRedo === 'function') wireFieldUndoRedo(g('editorContent'));

  // Push undo baseline after editor renders
  if (typeof itemUndoPush === 'function') {
    setTimeout(() => {
      const snap = {}; document.querySelectorAll('#editorContent input,#editorContent select').forEach(el => { snap[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
      itemUndoPush('preset', activePresetId, snap);
      syncItemUndoButtons('preset', activePresetId);
    }, 0);
  }

  // Variables panel
  g('psVarsHead').addEventListener('click', () => {
    g('psVarsBody').classList.toggle('open');
    g('psVarsArr').classList.toggle('open');
    g('psVarsHead').classList.toggle('open');
  });
  g('psScanVars').addEventListener('click', e => {
    e.stopPropagation(); // don't toggle collapse
    scanAndRenderVars();
  });
}

function presetSlider(id, label, val, min, max, step) {
  return `<div class="fg" style="grid-column:span 1">
    <label class="flabel-sm" style="display:flex;justify-content:space-between">
      <span>${label}</span><span id="${id}Val" style="color:var(--p)">${val}</span>
    </label>
    <div style="display:flex;gap:.4rem;align-items:center">
      <input type="range" id="${id}Range" min="${min}" max="${max}" step="${step}" value="${val}"
        style="flex:1;accent-color:var(--p)" oninput="g('${id}Val').textContent=this.value;g('${id}Num').value=this.value">
      <input type="number" id="${id}Num" class="fnum" style="width:60px" min="${min}" max="${max}" step="${step}" value="${val}"
        oninput="g('${id}Val').textContent=this.value;g('${id}Range').value=this.value">
    </div>
  </div>`;
}

function presetStringField(id, label, val, tall=false) {
  const esc = t => { const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; };
  return `<div class="fg">
    <label class="flabel-sm">${label}</label>
    ${tall
      ? `<div style="position:relative"><textarea id="${id}" class="ftextarea" style="min-height:60px">${esc(val)}</textarea></div>`
      : `<input id="${id}" class="finput" value="${esc(val)}">`}
  </div>`;
}

// ST special identifiers — fixed positions, ST injects these automatically
const ST_SPECIAL = {
  'main':               { label: '🔧 Main Prompt',           desc: 'ST main system prompt' },
  'nsfw':               { label: '🔞 NSFW',                  desc: 'NSFW/adult content block' },
  'jailbreak':          { label: '🔓 Jailbreak',             desc: 'Jailbreak / post-history block' },
  'dialogueExamples':   { label: '💬 Dialogue Examples',     desc: 'Example messages block' },
  'chatHistory':        { label: '📜 Chat History',          desc: 'Chat messages inject here' },
  'enhanceDefinitions': { label: '📖 Enhance Definitions',   desc: 'Definition enhancement block' },
  'charDescription':    { label: '👤 Char Description',      desc: 'Character description field' },
  'charPersonality':    { label: '🎭 Char Personality',      desc: 'Character personality field' },
  'scenario':           { label: '🎬 Scenario',              desc: 'Scenario field' },
  'personaDescription': { label: '🪞 Persona Description',   desc: 'User persona description' },
  'worldInfoBefore':    { label: '🌍 World Info — Before',   desc: 'World info before char' },
  'worldInfoAfter':     { label: '🌍 World Info — After',    desc: 'World info after char' },
};

// Which prompts are collapsed (by identifier)
const collapsedPrompts = new Set();

function getOrderedPrompts(preset) {
  // Use prompt_order[0].order as the canonical sequence if available
  const order = preset.prompt_order?.[0]?.order;
  if (!order?.length) return preset.prompts || [];

  const byId = {};
  (preset.prompts || []).forEach(pr => { byId[pr.identifier] = pr; byId[pr.id] = pr; });

  const result = [];
  order.forEach(o => {
    const pr = byId[o.identifier];
    if (pr) result.push(pr);
  });
  // Append any prompts not in order (shouldn't happen but just in case)
  (preset.prompts || []).forEach(pr => {
    if (!result.includes(pr)) result.push(pr);
  });
  return result;
}

function renderPromptList(prompts) {
  const list = g('psPromptList'); if (!list) return;
  list.innerHTML = '';

  const entry = presetLibrary[activePresetId]; if (!entry) return;
  // Use order from prompt_order for display
  const ordered = getOrderedPrompts(entry.preset);

  ordered.forEach((prompt, i) => {
    const isSpecial = !!ST_SPECIAL[prompt.identifier];
    const specialInfo = ST_SPECIAL[prompt.identifier];
    const isCollapsed = collapsedPrompts.has(prompt.identifier || prompt.id);

    const row = document.createElement('div');
    row.dataset.promptId = prompt.identifier || prompt.id;
    row.style.cssText = `display:flex;flex-direction:column;gap:.35rem;padding:.5rem .65rem;
      background:${isSpecial ? 'var(--bg3)' : 'var(--sf)'};
      border:1px solid ${isSpecial ? 'var(--bdb)' : 'var(--bd)'};
      border-radius:3px;${!prompt.enabled ? 'opacity:.5' : ''}`;
    row.draggable = true;

    // Drag handlers
    row.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed='move'; row.style.opacity='.4'; row.dataset.dragIdx=String(i); });
    row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop='2px solid var(--p)'; });
    row.addEventListener('dragleave', () => row.style.borderTop='');
    row.addEventListener('drop', e => {
      e.stopPropagation(); row.style.borderTop='';
      const from = parseInt(document.querySelector('[data-drag-idx]')?.dataset.dragIdx ?? -1);
      if (from !== -1 && from !== i) {
        const [moved] = ordered.splice(from, 1);
        ordered.splice(i, 0, moved);
        entry.preset.prompts = ordered;
        syncPromptOrder(entry.preset);
        renderPromptList(entry.preset.prompts);
      }
    });
    row.addEventListener('dragend', () => { row.style.opacity='1'; delete row.dataset.dragIdx; list.querySelectorAll('[data-prompt-id]').forEach(d => d.style.borderTop=''); });

    // ── Header ──
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;gap:.4rem;align-items:center';

    // Collapse toggle
    const collapseBtn = document.createElement('button');
    collapseBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--txm);font-size:.85rem;padding:0 2px;flex-shrink:0;line-height:1;transition:transform .15s';
    collapseBtn.textContent = isCollapsed ? '▶' : '▼';
    collapseBtn.title = isCollapsed ? 'Expand' : 'Collapse';
    collapseBtn.addEventListener('click', () => {
      const pid = prompt.identifier || prompt.id;
      if (collapsedPrompts.has(pid)) collapsedPrompts.delete(pid); else collapsedPrompts.add(pid);
      renderPromptList(entry.preset.prompts);
    });

    // Drag handle
    const drag = document.createElement('span');
    drag.textContent = '⠿'; drag.style.cssText = 'color:var(--txm);cursor:grab;font-size:.9rem;flex-shrink:0';

    // Enable toggle
    const en = document.createElement('input'); en.type='checkbox';
    en.style.cssText='accent-color:var(--p);width:13px;height:13px;flex-shrink:0';
    en.checked = prompt.enabled !== false;
    en.addEventListener('change', () => {
      prompt.enabled = en.checked;
      syncPromptOrder(entry.preset);
      row.style.opacity = en.checked ? '1' : '.5';
    });

    // Name/label
    const nameWrap = document.createElement('div');
    nameWrap.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;gap:.4rem';

    if (isSpecial) {
      // Editable name + read-only identifier badge
      const nameIn = document.createElement('input'); nameIn.className='finput';
      nameIn.style.cssText='flex:1;font-size:.78rem;padding:.22rem .5rem';
      nameIn.value = prompt.name || specialInfo.label.replace(/[^\w\s\-—]/g,'').trim();
      nameIn.placeholder='Prompt name...';
      nameIn.addEventListener('input', () => { prompt.name = nameIn.value; });
      const idBadge = document.createElement('span');
      idBadge.style.cssText='font-family:var(--fx);font-size:.58rem;padding:1px 5px;background:var(--sf2);border:1px solid var(--bd);border-radius:2px;color:var(--p);white-space:nowrap;flex-shrink:0';
      idBadge.textContent = prompt.identifier;
      idBadge.title = specialInfo.desc;
      nameWrap.append(nameIn, idBadge);
    } else {
      const nameIn = document.createElement('input'); nameIn.className='finput';
      nameIn.style.cssText='flex:1;font-size:.78rem;padding:.22rem .5rem';
      nameIn.value = prompt.name || ''; nameIn.placeholder='Prompt name...';
      nameIn.addEventListener('input', () => { prompt.name = nameIn.value; });
      nameWrap.append(nameIn);
    }

    // Role selector (skip for special)
    const roleEl = document.createElement('select'); roleEl.className='fselect';
    roleEl.style.cssText='width:88px;font-size:.72rem;padding:.22rem .4rem';
    ['system','user','assistant'].forEach(r => {
      const o=document.createElement('option'); o.value=r; o.textContent=r; if(prompt.role===r) o.selected=true; roleEl.append(o);
    });
    roleEl.addEventListener('change', () => { prompt.role = roleEl.value; });

    // Injection position
    const posEl = document.createElement('select'); posEl.className='fselect';
    posEl.style.cssText='width:88px;font-size:.72rem;padding:.22rem .4rem';
    [['0','↑Char'],['1','↓Char'],['2','↑AN'],['3','↓AN'],['4','@Depth'],['5','↑EM'],['6','↓EM']].forEach(([v,lbl]) => {
      const o=document.createElement('option'); o.value=v; o.textContent=lbl;
      if(String(prompt.injection_position)===v) o.selected=true; posEl.append(o);
    });
    posEl.addEventListener('change', () => { prompt.injection_position = parseInt(posEl.value); });

    const depthIn = document.createElement('input'); depthIn.type='number'; depthIn.className='fnum'; depthIn.style.width='50px';
    depthIn.value = prompt.injection_depth ?? 4; depthIn.min=0; depthIn.title='Injection depth';
    depthIn.addEventListener('input', () => { prompt.injection_depth = parseInt(depthIn.value)||0; });

    // Action buttons: insert above, insert below, delete
    const insAbove = document.createElement('button'); insAbove.className='btn btn-s btn-sm'; insAbove.textContent='↑+'; insAbove.title='Insert prompt above';
    insAbove.style.flexShrink='0';
    insAbove.addEventListener('click', () => {
      const newPr = makeBlankPrompt();
      ordered.splice(i, 0, newPr);
      entry.preset.prompts = ordered;
      syncPromptOrder(entry.preset);
      renderPromptList(entry.preset.prompts);
    });

    const insBelow = document.createElement('button'); insBelow.className='btn btn-s btn-sm'; insBelow.textContent='↓+'; insBelow.title='Insert prompt below';
    insBelow.style.flexShrink='0';
    insBelow.addEventListener('click', () => {
      const newPr = makeBlankPrompt();
      ordered.splice(i + 1, 0, newPr);
      entry.preset.prompts = ordered;
      syncPromptOrder(entry.preset);
      renderPromptList(entry.preset.prompts);
    });

    const delBtn = document.createElement('button'); delBtn.className='btn btn-err btn-sm'; delBtn.textContent='✕'; delBtn.style.flexShrink='0';
    delBtn.addEventListener('click', async () => {
      if (!await askConfirm('Delete this prompt?')) return;
      ordered.splice(i, 1);
      entry.preset.prompts = ordered;
      syncPromptOrder(entry.preset);
      renderPromptList(entry.preset.prompts);
    });

    head.append(collapseBtn, drag, en, nameWrap, roleEl, posEl, depthIn, insAbove, insBelow, delBtn);
    row.append(head);

    // ── Body (hidden when collapsed) ──
    if (!isCollapsed) {
      const ta = document.createElement('textarea'); ta.className='ftextarea'; ta.style.minHeight='75px';
      ta.value = prompt.content || ''; ta.placeholder='Prompt content...';
      ta.id = `psPromptContent-${prompt.identifier || i}`;
      ta.addEventListener('input', () => { prompt.content = ta.value; });

      const expBtn = document.createElement('button'); expBtn.className='expand-btn'; expBtn.textContent='⛶ expand';
      expBtn.addEventListener('click', e => { e.preventDefault(); openFullscreen(ta.id, prompt.name || specialInfo?.label || 'Prompt Content'); });

      const tok = document.createElement('span'); tok.className = 'tok-count';
      const updateTok = () => {
        const t = Math.round((ta.value || '').length / 3.5);
        tok.textContent = (ta.value || '').length + ' chars · ~' + t + ' tokens';
        tok.className = 'tok-count';
      };
      ta.addEventListener('input', updateTok); updateTok();

      const taWrap = document.createElement('div'); taWrap.className = 'content-wrap';
      taWrap.append(ta, tok, expBtn);

      // Flags row — marker + system_prompt auto-managed, only expose forbid_overrides
      const flags = document.createElement('div'); flags.style.cssText='display:flex;gap:.65rem;flex-wrap:wrap;align-items:center';
      [['forbid_overrides','Forbid Overrides',prompt.forbid_overrides]].forEach(([key,lbl,val]) => {
        const label=document.createElement('label'); label.className='cb-row';
        const cb=document.createElement('input'); cb.type='checkbox'; cb.style.cssText='accent-color:var(--p);width:12px;height:12px';
        cb.checked=!!val;
        cb.addEventListener('change',()=>{ prompt[key]=cb.checked; });
        const sp=document.createElement('span'); sp.className='flabel-sm'; sp.textContent=lbl;
        label.append(cb,sp); flags.append(label);
      });

      row.append(taWrap, flags);
    }

    list.append(row);
  });
}

function makeBlankPrompt() {
  const id = crypto.randomUUID();
  return {
    id, identifier: id, name: 'New Prompt', content: '',
    enabled: true, role: 'system', system_prompt: false, marker: false,
    injection_position: 0, injection_depth: 4,
    injection_order: 100, injection_trigger: [], forbid_overrides: false
  };
}

function syncPromptOrder(preset) {
  // Rebuild prompt_order to match current prompts array order + enabled state
  preset.prompt_order = [{
    id: preset.prompt_order?.[0]?.id ?? 0,
    character_id: preset.prompt_order?.[0]?.character_id ?? 0,
    order: (preset.prompts || []).map(pr => ({ identifier: pr.identifier, enabled: pr.enabled !== false }))
  }];
}

function savePreset() {
  const entry = presetLibrary[activePresetId]; if (!entry) return;
  const p = entry.preset;
  const gv = id => g(id)?.value;
  const gc = id => g(id)?.checked;

  p.name = gv('psName') || 'Untitled';
  p.temperature    = parseFloat(gv('psTempNum'))    || 0;
  p.top_p          = parseFloat(gv('psTopPNum'))    || 0;
  p.top_k          = parseFloat(gv('psTopKNum'))    || 0;
  p.top_a          = parseFloat(gv('psTopANum'))    || 0;
  p.min_p          = parseFloat(gv('psMinPNum'))    || 0;
  p.repetition_penalty  = parseFloat(gv('psRepPenNum'))  || 1;
  p.frequency_penalty   = parseFloat(gv('psFreqPenNum')) || 0;
  p.presence_penalty    = parseFloat(gv('psPresPenNum')) || 0;
  p.openai_max_context  = parseInt(gv('psMaxCtx'))  || 16384;
  p.openai_max_tokens   = parseInt(gv('psMaxTok'))  || 4096;
  p.seed           = parseInt(gv('psSeed'))         ?? -1;
  p.max_context_unlocked = gc('psMaxCtxUnlocked');
  p.stream_openai  = gc('psStream');
  p.use_sysprompt  = gc('psUseSys');
  p.squash_system_messages = gc('psSquash');
  p.show_thoughts  = gc('psShowThoughts');
  p.reasoning_effort   = gv('psReasoningEffort') || 'auto';
  p.verbosity          = gv('psVerbosity')       || 'auto';
  p.tool_reasoning_mode= gv('psTRMode')          || 'disabled';
  p.names_behavior     = parseInt(gv('psNamesBehavior')) || 0;

  // String fields
  p.assistant_prefill       = gv('psAssistPrefill')    || '';
  p.assistant_impersonation = gv('psAssistImperson')   || '';
  p.send_if_empty           = gv('psSendEmpty')        || '';
  p.wi_format               = gv('psWiFormat')         || '{0}';
  p.scenario_format         = gv('psScenarioFmt')      || '{{scenario}}';
  p.personality_format      = gv('psPersonalityFmt')   || '{{personality}}';
  p.impersonation_prompt    = gv('psImpersonPrompt')   || '';
  p.new_chat_prompt         = gv('psNewChatPrompt')    || '';
  p.new_group_chat_prompt   = gv('psNewGroupPrompt')   || '';
  p.new_example_chat_prompt = gv('psNewExamplePrompt') || '';
  p.continue_nudge_prompt   = gv('psContinueNudge')    || '';
  p.continue_postfix        = gv('psContinuePostfix')  ?? ' ';
  p.group_nudge_prompt      = gv('psGroupNudge')       || '';

  // Rebuild prompt_order to mirror current prompts array order + enabled state
  syncPromptOrder(p);

  entry.name = p.name;
  entry.savedAt = new Date().toISOString();
  // Snapshot on every explicit save
  if (typeof itemHistoryPush === 'function') itemHistoryPush('preset', activePresetId, JSON.parse(JSON.stringify(entry)));
  savePresetLibrary();
  renderPresetSidebar();
  toast('Preset saved.', 'ok');
}

function exportPreset() {
  const entry = presetLibrary[activePresetId]; if (!entry) return;
  savePreset(); // save first to capture any unsaved edits
  const fn = (entry.preset.name || 'preset').replace(/[^a-z0-9_\- ]/gi, '_') + '.json';
  dlFile(JSON.stringify(entry.preset, null, 4), fn, 'application/json');
  toast('Exported: ' + fn, 'ok');
}

function handlePresetImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const p = JSON.parse(ev.target.result);
      if (!p.prompts && !p.temperature === undefined) { toast('Doesn\'t look like an ST preset.', 'err'); return; }
      if (!p.name) p.name = file.name.replace(/\.json$/i, '');
      const id = presetId();
      presetLibrary[id] = { id, name: p.name, preset: p, savedAt: new Date().toISOString() };
      savePresetLibrary(); renderPresetSidebar(); openPreset(id);
      toast('Imported: ' + p.name, 'ok');
    } catch(err) { toast('Import error: ' + err.message, 'err'); console.error(err); }
  };
  r.readAsText(file);
  e.target.value = '';
}

function openPresetLibrary() {
  g('libModalTitle').textContent = 'Preset Library';
  const list = g('libList');
  list.innerHTML = '';
  const presets = Object.values(presetLibrary).sort((a,b) => b.savedAt.localeCompare(a.savedAt));

  if (!presets.length) {
    list.innerHTML = '<div class="lib-empty">// no presets yet</div>';
  } else {
    presets.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'lib-item' + (entry.id === activePresetId ? ' active' : '');
      const date = new Date(entry.savedAt).toLocaleDateString();
      item.innerHTML = `
        <span class="lib-name">${entry.name || 'Unnamed'}</span>
        <span class="lib-meta">${(entry.preset.prompts||[]).length} prompts · ${date}</span>
        <div class="lib-acts">
          <button class="btn btn-p btn-sm lib-load">Load</button>
          <button class="btn btn-s btn-sm lib-hist lib-item-hist" title="Version history">🕓</button>
          <button class="btn btn-err btn-sm lib-del">✕</button>
        </div>`;
      item.querySelector('.lib-name').addEventListener('click', () => { openPreset(entry.id); closeModal('libModal'); });
      item.querySelector('.lib-load').addEventListener('click', () => { openPreset(entry.id); closeModal('libModal'); });
      item.querySelector('.lib-hist').addEventListener('click', () => { if (typeof openItemHistory === 'function') openItemHistory('preset', entry.id); });
      item.querySelector('.lib-del').addEventListener('click', () => { deletePreset(entry.id); openPresetLibrary(); });
      list.append(item);
    });
  }
  g('libSaveBtn').parentElement.style.display = 'none';
  openModal('libModal');
}

