// ═══════════════════════════════════════════════════════
// REGEX_EDITOR.JS — ST-format regex rule editor
// Storage: localStorage 'loreos_regex' → { id: RuleObj }
// RuleObj: { id, scriptName, findRegex, replaceString,
//   trimStrings, substituteRegex, markdownOnly, promptOnly,
//   runOnEdit, runOnUser, runOnAi, enabled }
// ═══════════════════════════════════════════════════════

let regexLibrary = {};
let activeRegexId = null;

function regexGet() {
  try { return JSON.parse(localStorage.getItem('loreos_regex') || '{}'); } catch(e) { return {}; }
}
function regexSet(d) { try { localStorage.setItem('loreos_regex', JSON.stringify(d)); } catch(e) {} }
function regexNewId() { return 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

function loadRegex() { regexLibrary = regexGet(); }
function saveRegex() { regexSet(regexLibrary); }

// ── Sidebar ──────────────────────────────────────────
function renderRegexSidebar() {
  const list = g('entryList');
  const sbTitle = g('sbTitle');
  if (sbTitle) sbTitle.textContent = 'Regex Rules';
  list.innerHTML = '';

  const rules = Object.values(regexLibrary).sort((a,b) => (a.order??0)-(b.order??0));
  if (!rules.length) {
    list.innerHTML = '<li style="font-family:var(--fx);font-size:.72rem;color:var(--txm);padding:.75rem;letter-spacing:.5px">no rules yet</li>';
    return;
  }
  rules.forEach(rule => {
    const li = document.createElement('li');
    li.className = 'ei' + (rule.id === activeRegexId ? ' active' : '');
    li.innerHTML = `
      <div style="display:flex;align-items:center;gap:.4rem">
        <span style="width:.45rem;height:.45rem;border-radius:50%;background:${rule.enabled!==false?'var(--ok)':'var(--err)'};flex-shrink:0"></span>
        <div class="ei-name">${esc(rule.scriptName || 'Unnamed Rule')}</div>
      </div>
      <div class="ei-meta">${esc(rule.findRegex || '').slice(0,30) || 'no pattern'}</div>`;
    li.addEventListener('click', () => openRegexRule(rule.id));
    list.appendChild(li);
  });
}

// ── Editor ───────────────────────────────────────────
function renderRegexEditor() {
  const ec = g('editorContent');
  if (!activeRegexId || !regexLibrary[activeRegexId]) {
    ec.innerHTML = `
      <div class="empty-state">
        <div>select a rule or create one</div>
        <button class="btn btn-ok" onclick="createRegexRule()">+ New Rule</button>
      </div>`;
    return;
  }
  const r = regexLibrary[activeRegexId];
  const checked = (v) => v !== false ? 'checked' : '';
  ec.className = '';
  ec.innerHTML = `
    <div class="entry-editor">
      <div class="fg">
        <label class="flabel">Script Name</label>
        <input id="rxName" class="finput" value="${esc(r.scriptName||'')}" placeholder="My Regex Rule">
      </div>

      <div class="kw-row" style="margin-top:.55rem">
        <div class="fg">
          <label class="flabel">Find (regex pattern)</label>
          <input id="rxFind" class="finput" value="${esc(r.findRegex||'')}" placeholder="/pattern/flags or just pattern">
        </div>
        <div class="fg">
          <label class="flabel">Replace with</label>
          <input id="rxReplace" class="finput" value="${esc(r.replaceString||'')}" placeholder="replacement (use $1, $2 for groups)">
        </div>
      </div>

      <div style="margin-top:.65rem;display:flex;flex-wrap:wrap;gap:.5rem 1.2rem">
        <label class="cb-row"><input type="checkbox" id="rxEnabled" ${checked(r.enabled)}><span class="flabel-sm">Enabled</span></label>
        <label class="cb-row"><input type="checkbox" id="rxTrim" ${r.trimStrings?'checked':''}><span class="flabel-sm">Trim Strings</span></label>
        <label class="cb-row"><input type="checkbox" id="rxMarkdown" ${r.markdownOnly?'checked':''}><span class="flabel-sm">Markdown Only</span></label>
        <label class="cb-row"><input type="checkbox" id="rxPromptOnly" ${r.promptOnly?'checked':''}><span class="flabel-sm">Prompt Only</span></label>
      </div>

      <div class="fg" style="margin-top:.65rem">
        <label class="flabel">Affected outputs</label>
        <div style="display:flex;flex-wrap:wrap;gap:.5rem .9rem;margin-top:.3rem">
          <label class="cb-row"><input type="checkbox" id="rxUser" ${checked(r.runOnUser)}><span class="flabel-sm">User Input</span></label>
          <label class="cb-row"><input type="checkbox" id="rxAi" ${checked(r.runOnAi)}><span class="flabel-sm">AI Output</span></label>
          <label class="cb-row"><input type="checkbox" id="rxSlash" ${r.runOnEdit?'checked':''}><span class="flabel-sm">Slash Commands</span></label>
        </div>
      </div>

      <div class="fg" style="margin-top:.55rem">
        <label class="flabel">Substitute Regex <span style="font-weight:400;color:var(--txm)">(optional)</span></label>
        <input id="rxSub" class="finput" value="${esc(r.substituteRegex||'')}" placeholder="Alternative pattern for substitution">
      </div>

      <div style="display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap">
        <button class="btn btn-p" id="rxSaveBtn">Save Rule</button>
        <button class="btn btn-err btn-sm" id="rxDeleteBtn">Delete</button>
      </div>

      <div class="fg" style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--bd)">
        <label class="flabel">Test Pattern</label>
        <textarea id="rxTestInput" class="ftextarea" style="min-height:60px" placeholder="Paste sample text to test against..."></textarea>
        <button class="btn btn-s btn-sm" id="rxTestBtn" style="margin-top:.4rem">Run Test</button>
        <div id="rxTestOutput" style="margin-top:.45rem;font-family:var(--fb);font-size:.82rem;color:var(--txd);background:var(--sf);border:1px solid var(--bd);border-radius:3px;padding:.5rem .65rem;display:none;white-space:pre-wrap;word-break:break-word"></div>
      </div>
    </div>`;

  wireRegexEditor();
}

function wireRegexEditor() {
  g('rxSaveBtn').addEventListener('click', () => {
    const rule = regexLibrary[activeRegexId];
    if (!rule) return;
    rule.scriptName    = g('rxName').value.trim() || 'Unnamed Rule';
    rule.findRegex     = g('rxFind').value;
    rule.replaceString = g('rxReplace').value;
    rule.substituteRegex = g('rxSub').value;
    rule.enabled       = g('rxEnabled').checked;
    rule.trimStrings   = g('rxTrim').checked;
    rule.markdownOnly  = g('rxMarkdown').checked;
    rule.promptOnly    = g('rxPromptOnly').checked;
    rule.runOnUser     = g('rxUser').checked;
    rule.runOnAi       = g('rxAi').checked;
    rule.runOnEdit     = g('rxSlash').checked;
    saveRegex();
    renderRegexSidebar();
    toast('Rule saved.', 'ok');
  });

  g('rxDeleteBtn').addEventListener('click', async () => {
    if (!await askConfirm('Delete this rule?')) return;
    delete regexLibrary[activeRegexId];
    saveRegex();
    activeRegexId = null;
    renderRegexSidebar();
    renderRegexEditor();
  });

  g('rxTestBtn').addEventListener('click', () => {
    const pattern = g('rxFind').value.trim();
    const replace = g('rxReplace').value;
    const input   = g('rxTestInput').value;
    const out     = g('rxTestOutput');
    if (!pattern || !input) { out.style.display='none'; return; }
    try {
      // Parse /pattern/flags or bare pattern
      let re;
      const m = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
      if (m) re = new RegExp(m[1], m[2] || 'g');
      else re = new RegExp(pattern, 'g');
      const result = input.replace(re, replace);
      out.textContent = result;
      out.style.display = '';
      out.style.color = 'var(--ok)';
    } catch(err) {
      out.textContent = 'Error: ' + err.message;
      out.style.display = '';
      out.style.color = 'var(--err)';
    }
  });
}

function openRegexRule(id) {
  activeRegexId = id;
  renderRegexSidebar();
  renderRegexEditor();
}

function createRegexRule() {
  const id = regexNewId();
  const order = Object.keys(regexLibrary).length;
  regexLibrary[id] = {
    id, scriptName: 'New Rule', findRegex: '', replaceString: '',
    substituteRegex: '', enabled: true, trimStrings: false,
    markdownOnly: false, promptOnly: false,
    runOnUser: true, runOnAi: true, runOnEdit: false,
    order,
  };
  saveRegex();
  openRegexRule(id);
  renderRegexSidebar();
}

function exportRegexJson() {
  const rules = Object.values(regexLibrary).sort((a,b)=>(a.order??0)-(b.order??0)).map(r => ({
    scriptName:     r.scriptName     || '',
    findRegex:      r.findRegex      || '',
    replaceString:  r.replaceString  || '',
    substituteRegex:r.substituteRegex|| '',
    trimStrings:    r.trimStrings    || false,
    markdownOnly:   r.markdownOnly   || false,
    promptOnly:     r.promptOnly     || false,
    runOnEdit:      r.runOnEdit      || false,
    runOnUser:      r.runOnUser      !== false,
    runOnAi:        r.runOnAi        !== false,
    enabled:        r.enabled        !== false,
  }));
  dlFile(JSON.stringify(rules, null, 2), 'regex_rules.json', 'application/json');
  toast('Regex rules exported.', 'ok');
}

function importRegexJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r2 = new FileReader();
  r2.onload = ev => {
    try {
      const rules = JSON.parse(ev.target.result);
      if (!Array.isArray(rules)) { toast('Expected a JSON array of rules.', 'err'); return; }
      rules.forEach((rule, i) => {
        const id = regexNewId();
        regexLibrary[id] = Object.assign({ id, order: i }, rule);
      });
      saveRegex();
      activeRegexId = null;
      renderRegexSidebar();
      renderRegexEditor();
      toast(`Imported ${rules.length} regex rules.`, 'ok');
    } catch(e2) { toast('Failed to parse JSON.', 'err'); }
  };
  r2.readAsText(file);
  e.target.value = '';
}
