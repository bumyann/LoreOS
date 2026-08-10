// ═══════════════════════════════════════════════════════
// CHARACTER CARD EDITOR
// ═══════════════════════════════════════════════════════

// Active format picker state: 'st' | 'saucepan' | 'lumiverse'
let charActiveFormat = 'st';

// ── Lumiverse alternate_fields helpers ──
function getLumiVariants(card, field) {
  return card?.data?.extensions?._lumiverse?.alternate_fields?.[field] || [];
}
function setLumiVariants(card, field, variants) {
  if (!card.data.extensions) card.data.extensions = {};
  if (!card.data.extensions._lumiverse) card.data.extensions._lumiverse = {};
  if (!card.data.extensions._lumiverse.alternate_fields) card.data.extensions._lumiverse.alternate_fields = {};
  card.data.extensions._lumiverse.alternate_fields[field] = variants;
}
function lumiGenId() {
  return 'xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function blankCharCard() {
  return {
    id: 'c' + Date.now() + Math.floor(Math.random()*1000),
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'New Character',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      tags: [],
      creator: '',
      character_version: '',
      extensions: {},
      character_book: null
    }
  };
}

function normalizeCharCard(card) {
  if (!card.data) card.data = {};
  const d = card.data;
  if (typeof d.name !== 'string') d.name = card.name || 'Unnamed';
  if (typeof d.description !== 'string') d.description = '';
  if (typeof d.personality !== 'string') d.personality = '';
  if (typeof d.scenario !== 'string') d.scenario = '';
  if (typeof d.first_mes !== 'string') d.first_mes = '';
  if (typeof d.mes_example !== 'string') d.mes_example = '';
  if (typeof d.creator_notes !== 'string') d.creator_notes = '';
  if (typeof d.system_prompt !== 'string') d.system_prompt = '';
  if (typeof d.post_history_instructions !== 'string') d.post_history_instructions = '';
  if (!Array.isArray(d.alternate_greetings)) d.alternate_greetings = [];
  if (!Array.isArray(d.tags)) d.tags = [];
  if (typeof d.creator !== 'string') d.creator = '';
  if (typeof d.character_version !== 'string') d.character_version = '';
  if (!d.extensions) d.extensions = {};
  if (!card.spec) card.spec = 'chara_card_v2';
  if (!card.spec_version) card.spec = 'chara_card_v3'; card.spec_version = '3.0'; // always export V3
  return card;
}

function charId() { return 'c' + Date.now() + Math.floor(Math.random()*1000); }

function createChar() {
  const card = blankCharCard();
  charLibrary[card.id] = { id: card.id, name: card.data.name, card, savedAt: new Date().toISOString() };
  saveCharLibrary();
  renderCharSidebar();
  openChar(card.id);
}

function openChar(id) {
  activeCharId = id;
  charFormState = {}; // clear stale state from previous character
  charActiveFormat = 'st'; // reset format picker
  renderCharSidebar();
  renderCharEditor();
}

async function deleteChar(id) {
  if (!await askConfirm('Delete this character? This cannot be undone.')) return;
  delete charLibrary[id];
  if (activeCharId === id) activeCharId = null;
  saveCharLibrary();
  renderCharSidebar();
  renderCharEditor();
}

function duplicateChar(id) {
  const src = charLibrary[id]; if (!src) return;
  const newId = charId();
  const card = JSON.parse(JSON.stringify(src.card));
  card.id = newId;
  card.data.name = (card.data.name || 'Unnamed') + ' (Copy)';
  charLibrary[newId] = { id: newId, name: card.data.name, card, savedAt: new Date().toISOString() };
  saveCharLibrary();
  renderCharSidebar();
  openChar(newId);
}

function renderCharSidebar() {
  const list = g('entryList');
  const count = g('entryCount');
  const chars = Object.values(charLibrary).sort((a,b) => (a.name||'').localeCompare(b.name||''));
  count.textContent = `${chars.length} ${chars.length === 1 ? 'character' : 'characters'}`;
  list.innerHTML = '';

  if (chars.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:1.2rem .75rem;text-align:center;font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:1px';
    li.textContent = 'no characters yet';
    list.append(li);
    return;
  }

  chars.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'ei';
    if (entry.id === activeCharId) li.classList.add('open');

    const head = document.createElement('div');
    head.className = 'ei-head';
    const emoji = document.createElement('span');
    emoji.className = 'ei-emoji';
    emoji.textContent = '🎭';
    const name = document.createElement('div');
    name.className = 'ei-name';
    name.textContent = entry.name || entry.card.data.name || 'Unnamed';
    head.append(emoji, name);
    li.append(head);

    const acts = document.createElement('div');
    acts.className = 'ei-acts';
    [
      ['⧉', 'Duplicate', () => duplicateChar(entry.id), ''],
      ['✕', 'Delete', () => deleteChar(entry.id), 'del'],
    ].forEach(([label, title, fn, cls]) => {
      const b = document.createElement('button');
      b.className = 'ei-act' + (cls ? ' ' + cls : '');
      b.title = title; b.textContent = label;
      b.addEventListener('click', e2 => { e2.stopPropagation(); fn(); });
      acts.append(b);
    });
    li.append(acts);

    if (entry.card.data.tags && entry.card.data.tags.length) {
      const kws = document.createElement('div'); kws.className = 'ei-kws';
      entry.card.data.tags.slice(0,3).forEach(t => {
        const tag = document.createElement('span'); tag.className = 'kw-tag'; tag.textContent = t; kws.append(tag);
      });
      li.append(kws);
    }

    li.addEventListener('click', () => openChar(entry.id));
    list.append(li);
  });
}

function renderCharEditor() {
  const ec = g('editorContent');
  g('tabBar').innerHTML = '';

  if (!activeCharId || !charLibrary[activeCharId]) {
    ec.className = '';
    ec.innerHTML = `<div class="empty-state"><div>// select or create a character</div><button class="btn btn-ok" id="newEntryBtnAlt">+ New Character</button></div>`;
    g('newEntryBtnAlt').onclick = createChar;
    return;
  }

  const entry = charLibrary[activeCharId];
  const card = normalizeCharCard(entry.card);
  const d = card.data;
  const s = charFormState;
  const get = (k, fb) => s[k] !== undefined ? s[k] : fb;
  const esc = t => { const div = document.createElement('div'); div.textContent = t || ''; return div.innerHTML; };

  const name = get('name', d.name);
  const desc = get('description', d.description);
  const pers = get('personality', d.personality);
  const scen = get('scenario', d.scenario);
  const first = get('first_mes', d.first_mes);

  const mesEx = get('mes_example', d.mes_example);
  const sysPrompt = get('system_prompt', d.system_prompt);
  const phi = get('post_history_instructions', d.post_history_instructions);
  const notes = get('creator_notes', d.creator_notes);
  const creator = get('creator', d.creator);
  const version = get('character_version', d.character_version);
  const tags = get('tags', (d.tags||[]).join(', '));
  const altGreetings = get('alternate_greetings', d.alternate_greetings || []).map(g => typeof g === 'object' ? g : { title: '', message: g });
  const spec = get('spec', card.spec);
  const fmt = charActiveFormat;
  const isLumi = fmt === 'lumiverse';
  const isSauce = fmt === 'saucepan';

  // Lumiverse alternate_fields — read from extensions or charFormState
  const lumiVariants = charFormState._lumiVariants || {
    description: getLumiVariants(card, 'description'),
    personality: getLumiVariants(card, 'personality'),
    scenario:    getLumiVariants(card, 'scenario'),
  };

  ec.className = '';
  ec.innerHTML = `<div class="entry-editor">
    <div class="fg">
      <div style="display:flex;gap:10px;align-items:flex-end">
        <div style="flex:1">
          <label class="flabel">Name</label>
          <input id="chName" class="finput" value="${esc(name)}" placeholder="Character name...">
        </div>
        <div style="flex:0 0 auto;align-self:flex-end">
          <select id="chFormatPicker" class="finput" style="font-family:var(--fx);font-size:.62rem;letter-spacing:.5px;padding:.35rem .5rem;cursor:pointer">
            <option value="st"${fmt === 'st' ? ' selected' : ''}>V3 · SillyTavern</option>
            <option value="saucepan"${fmt === 'saucepan' ? ' selected' : ''}>SaucepanAI</option>
            <option value="lumiverse"${fmt === 'lumiverse' ? ' selected' : ''}>Lumiverse</option>
          </select>
        </div>
      </div>
    </div>

    <div class="fg">
      <label class="flabel">Character Image</label>
      <div id="chImageWrap" style="display:flex;gap:1rem;align-items:flex-start">
        <div id="chImagePreview" style="width:120px;height:160px;flex-shrink:0;border:1px solid var(--bd);border-radius:4px;background:var(--sf);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer">
          <span style="font-family:var(--fx);font-size:.65rem;color:var(--txm);text-align:center;padding:.5rem">No image<br>click to upload</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:.4rem">
          <span class="form-note" style="margin-top:0">This image becomes the PNG when you export a character card — the actual card data gets embedded invisibly inside it.</span>
          <div style="display:flex;gap:.4rem">
            <button class="btn btn-s btn-sm" id="chImagePickBtn">Upload Image</button>
            <button class="btn btn-err btn-sm" id="chImageRemoveBtn" style="display:none">Remove</button>
          </div>
        </div>
      </div>
      <input type="file" id="chImageFileInput" accept="image/png,image/jpeg,image/webp" style="display:none">
    </div>

    <div class="fg">
      <label class="flabel">Description</label>
      ${isLumi ? renderLumiVariantField('chDesc', 'description', desc, lumiVariants.description, 'Physical appearance, background, traits...', '140px') : `<textarea id="chDesc" class="ftextarea" style="min-height:140px" placeholder="Physical appearance, background, traits...">${esc(desc)}</textarea>`}
      <span class="form-note">Core character info — always included in context.</span>
    </div>

    <div class="fg"${isSauce ? ' style="display:none"' : ''}>
      <label class="flabel">Personality</label>
      ${isLumi ? renderLumiVariantField('chPers', 'personality', pers, lumiVariants.personality, 'Personality summary...', '90px') : `<textarea id="chPers" class="ftextarea" style="min-height:90px" placeholder="Personality summary...">${esc(pers)}</textarea>`}
    </div>

    <div class="fg"${isSauce ? ' style="display:none"' : ''}>
      <label class="flabel">Scenario</label>
      ${isLumi ? renderLumiVariantField('chScen', 'scenario', scen, lumiVariants.scenario, 'The setting / circumstances...', '90px') : `<textarea id="chScen" class="ftextarea" style="min-height:90px" placeholder="The setting / circumstances...">${esc(scen)}</textarea>`}
    </div>

    <div class="fg">
      <label class="flabel">First Message (Greeting)</label>
      <textarea id="chFirst" class="ftextarea" style="min-height:110px" placeholder="The opening message...">${esc(first)}</textarea>
    </div>

    <div class="fg" id="chAltGreetWrap">
      <label class="flabel">Alternate Greetings</label>
      <div id="chAltGreetList" style="display:flex;flex-direction:column;gap:.5rem"></div>
      <button class="btn btn-s btn-sm" id="chAddGreet" style="margin-top:.4rem;align-self:flex-start">+ Add Alternate Greeting</button>
    </div>

    <div class="fg">
      <label class="flabel">Example Messages</label>
      <textarea id="chMesEx" class="ftextarea" style="min-height:110px" placeholder="&lt;START&gt;\n{{user}}: ...\n{{char}}: ...">${esc(mesEx)}</textarea>
      <span class="form-note">Use &lt;START&gt; to separate example conversations.</span>
    </div>

    <div class="adv">
      <div class="adv-head" id="chAdvHead">
        <span class="adv-title">⚙ Advanced (System Prompt, Notes, Metadata)</span>
        <span class="adv-arr" id="chAdvArr">▶</span>
      </div>
      <div class="adv-body" id="chAdvBody">
        <div class="fg">
          <label class="flabel-sm">System Prompt Override</label>
          <textarea id="chSysPrompt" class="ftextarea" style="min-height:80px" placeholder="Leave blank to use the frontend default...">${esc(sysPrompt)}</textarea>
        </div>
        <div class="fg" style="margin-top:.65rem">
          <label class="flabel-sm">Post-History Instructions (Jailbreak)</label>
          <textarea id="chPHI" class="ftextarea" style="min-height:80px" placeholder="Injected after chat history...">${esc(phi)}</textarea>
        </div>
        <div class="fg" style="margin-top:.65rem">
          <label class="flabel-sm">Creator Notes</label>
          <textarea id="chNotes" class="ftextarea" style="min-height:70px" placeholder="Notes for other users...">${esc(notes)}</textarea>
        </div>
        <div class="adv-grid" style="margin-top:.65rem">
          <div class="fg"${isSauce ? ' style="display:none"' : ''}><label class="flabel-sm">Creator</label><input id="chCreator" class="finput" value="${esc(creator)}" placeholder="Your name..."></div>
          <div class="fg"${isSauce ? ' style="display:none"' : ''}><label class="flabel-sm">Version</label><input id="chVersion" class="finput" value="${esc(version)}" placeholder="1.0"></div>
          <div class="fg" style="grid-column:1/-1"><label class="flabel-sm">Tags (comma-separated)</label><input id="chTags" class="finput" value="${esc(tags)}" placeholder="oc, fantasy, slow-burn"></div>
        </div>
      </div>
    </div>

    <div class="attach-lb-panel">
      <div class="attach-lb-status" id="chLbStatus">🌐 No lorebook attached</div>
      <div class="attach-lb-acts">
        <button class="btn btn-s btn-sm" id="chLbManageBtn">Manage Attached Lorebook</button>
      </div>
    </div>

    <div class="editor-actions">
      <button class="btn btn-p" id="chSaveBtn">Save Changes</button>
      <div class="dd" id="dd-char-export">
        <button class="btn btn-s dd-btn">&#8657; Export</button>
        <div class="dd-menu">
          <button class="dd-item" id="chExportJsonBtn">{ } ST / JanitorAI (V3 JSON)</button>
          <button class="dd-item" id="chExportPngBtn">🖼 ST / JanitorAI (PNG Card)</button>
          <button class="dd-item" id="chExportSaucepanBtn">🍲 SaucepanAI (companion.json)</button>
          <button class="dd-item" id="chExportCharxBtn">📦 .charx (Lumiverse)</button>
        </div>
      </div>
      <button class="btn btn-err" id="chDeleteBtn">Delete Character</button>
    </div>
  </div>`;

  // Render alt greetings list
  renderAltGreetings(altGreetings);

  // Inject expand buttons + tok-count into all char editor textareas
  ec.querySelectorAll('.ftextarea').forEach(ta => {
    if (!ta.id) return;
    const label = ta.closest('.fg')?.querySelector('.flabel,.flabel-sm')?.textContent || ta.id;
    // Wrap in content-wrap if not already
    if (!ta.parentElement.classList.contains('content-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'content-wrap';
      ta.parentNode.insertBefore(wrap, ta);
      wrap.appendChild(ta);
    }
    const wrap = ta.parentElement;
    // Tok-count span
    const tok = document.createElement('span');
    tok.className = 'tok-count';
    const updateTok = () => {
      const t = Math.round((ta.value || '').length / 3.5);
      tok.textContent = (ta.value || '').length + ' chars · ~' + t + ' tokens';
      tok.className = 'tok-count';
    };
    ta.addEventListener('input', updateTok);
    updateTok();
    // Expand button
    const btn = document.createElement('button');
    btn.className = 'expand-btn';
    btn.textContent = '⛶ expand';
    btn.dataset.fieldId = ta.id;
    btn.dataset.label = label;
    btn.addEventListener('click', e => { e.preventDefault(); openFullscreen(ta.id, label); });
    wrap.append(tok, btn);
  });

  // Update attached lorebook status
  updateLbStatus(entry);

  // Wire lumiverse variant field tabs
  if (charActiveFormat === 'lumiverse') wireLumiVariantFields();

  // Wire events
  g('chAdvHead').addEventListener('click', () => {
    g('chAdvBody').classList.toggle('open');
    g('chAdvArr').classList.toggle('open');
    g('chAdvHead').classList.toggle('open');
  });
  g('chAddGreet').addEventListener('click', () => {
    const cur = captureCharGreetings();
    cur.push({ title: '', message: '' });
    charFormState.alternate_greetings = cur;
    charUnsaved = true;
    renderAltGreetings(cur);
  });
  g('chFormatPicker').addEventListener('change', e => {
    captureCharState();
    charActiveFormat = e.target.value;
    renderCharEditor();
  });
  g('chSaveBtn').addEventListener('click', saveChar);
  g('chExportJsonBtn').addEventListener('click', () => exportCharJson(activeCharId));
  g('chExportPngBtn').addEventListener('click', () => openCharPngExport(activeCharId));
  g('chExportSaucepanBtn').addEventListener('click', () => exportCharSaucepan(activeCharId));
  if (g('chExportCharxBtn')) g('chExportCharxBtn').addEventListener('click', () => exportCharCharx(activeCharId));
  // Wire the char export dropdown
  const ddCharExport = document.getElementById('dd-char-export');
  if (ddCharExport) {
    const ddBtn = ddCharExport.querySelector('.dd-btn');
    const ddMenu = ddCharExport.querySelector('.dd-menu');
    ddBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = ddMenu.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) ddMenu.classList.add('open');
    });
  }
  g('chDeleteBtn').addEventListener('click', () => deleteChar(activeCharId));

  // Image upload wiring
  const imgPreview = g('chImagePreview');
  const imgInput = g('chImageFileInput');
  const imgRemove = g('chImageRemoveBtn');
  const charEntry = charLibrary[activeCharId];

  function refreshImagePreview() {
    const src = charEntry?.imageData;
    if (src) {
      imgPreview.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover">`;
      imgRemove.style.display = '';
    } else {
      imgPreview.innerHTML = `<span style="font-family:var(--fx);font-size:.65rem;color:var(--txm);text-align:center;padding:.5rem">No image<br>click to upload</span>`;
      imgRemove.style.display = 'none';
    }
  }
  refreshImagePreview();

  imgPreview.addEventListener('click', () => imgInput.click());
  g('chImagePickBtn').addEventListener('click', () => imgInput.click());
  imgRemove.addEventListener('click', () => {
    if (charEntry) { charEntry.imageData = null; saveCharLibrary(); }
    refreshImagePreview();
  });
  imgInput.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      if (charEntry) {
        charEntry.imageData = ev.target.result; // base64 data URL
        saveCharLibrary();
        refreshImagePreview();
        toast('Image set.', 'ok');
      }
    };
    r.readAsDataURL(file);
    e.target.value = '';
  });

  // Mark unsaved on input
  ec.querySelectorAll('input,textarea,select').forEach(el => {
    el.addEventListener('input', () => { charUnsaved = true; captureCharState(); });
    el.addEventListener('change', () => { charUnsaved = true; captureCharState(); });
  });
}

function renderAltGreetings(list) {
  const wrap = g('chAltGreetList');
  if (!wrap) return;
  wrap.innerHTML = '';
  list.forEach((greet, i) => {
    // Support both plain strings (ST) and {title, message} objects (SaucepanAI)
    const titleVal   = typeof greet === 'object' ? (greet.title   || '') : '';
    const messageVal = typeof greet === 'object' ? (greet.message || greet.content || '') : (greet || '');

    const block = document.createElement('div');
    block.style.cssText = 'display:flex;flex-direction:column;gap:.3rem;padding:.5rem;border:1px solid var(--bdr);border-radius:6px;background:var(--bg2)';

    // Header row: label + remove button
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.4rem';
    const lbl = document.createElement('span');
    lbl.className = 'flabel-sm'; lbl.style.margin = '0';
    lbl.textContent = 'Greeting #' + (i + 1);
    const rm = document.createElement('button');
    rm.className = 'btn btn-err btn-sm'; rm.textContent = '✕'; rm.style.flexShrink = '0';
    rm.addEventListener('click', () => {
      const cur = captureCharGreetings();
      cur.splice(i, 1);
      charFormState.alternate_greetings = cur;
      charUnsaved = true;
      renderAltGreetings(cur);
    });
    hdr.append(lbl, rm);

    // Title input
    const titleInput = document.createElement('input');
    titleInput.className = 'finput'; titleInput.type = 'text';
    titleInput.placeholder = 'Greeting title (optional)...';
    titleInput.value = titleVal;
    titleInput.addEventListener('input', () => { charUnsaved = true; });

    // Message textarea
    const ta = document.createElement('textarea');
    ta.className = 'ftextarea'; ta.style.minHeight = '70px';
    ta.placeholder = 'Greeting message #' + (i + 1) + '...';
    ta.value = messageVal;
    ta.addEventListener('input', () => { charUnsaved = true; });

    block.append(hdr, titleInput, ta);
    wrap.append(block);
  });
}

// ── Lumiverse variant field UI ──

function renderLumiVariantField(baseId, field, defaultVal, variants, placeholder, minHeight) {
  const esc2 = t => { const d = document.createElement('div'); d.textContent = t||''; return d.innerHTML; };
  const tabs = [
    `<button class="lumi-vtab active" data-field="${field}" data-idx="-1">Default</button>`,
    ...variants.map((v, i) =>
      `<button class="lumi-vtab" data-field="${field}" data-idx="${i}">${esc2(v.label||'Variant '+(i+1))}</button>`
    ),
    `<button class="lumi-vtab lumi-vtab-add" data-field="${field}" data-idx="add" title="Add variant">＋</button>`,
  ].join('');
  return `<div class="lumi-vwrap" id="lumi-vwrap-${field}">
    <div class="lumi-vtabs" id="lumi-vtabs-${field}">${tabs}</div>
    <textarea id="${baseId}" class="ftextarea" style="min-height:${minHeight}" placeholder="${placeholder}">${esc2(defaultVal)}</textarea>
  </div>`;
}

function wireLumiVariantFields() {
  document.querySelectorAll('.lumi-vtab').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const idx   = btn.dataset.idx;
      const wrap  = document.getElementById('lumi-vwrap-' + field);
      if (!wrap) return;

      // Capture current textarea value before switching
      const ta = wrap.querySelector('textarea');
      const curActive = wrap.querySelector('.lumi-vtab.active');
      const curIdx = curActive ? curActive.dataset.idx : '-1';

      // Save current value back into state
      const lv = charFormState._lumiVariants || captureLumiVariants();
      if (curIdx === '-1') {
        // Default tab — map to the correct charFormState field
        const fieldMap = { description: 'chDesc', personality: 'chPers', scenario: 'chScen' };
        const el = g(fieldMap[field]);
        if (el) el.value = ta.value;
      } else {
        if (lv[field] && lv[field][parseInt(curIdx)]) {
          lv[field][parseInt(curIdx)].content = ta.value;
        }
      }
      charFormState._lumiVariants = lv;

      if (idx === 'add') {
        // Add new variant
        if (!lv[field]) lv[field] = [];
        lv[field].push({ id: lumiGenId(), label: 'Variant ' + (lv[field].length + 1), content: '' });
        charFormState._lumiVariants = lv;
        charUnsaved = true;
        renderCharEditor();
        return;
      }

      // Switch tabs
      wrap.querySelectorAll('.lumi-vtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (idx === '-1') {
        // Default: read from the main textarea's stored value
        const fieldMap = { description: 'chDesc', personality: 'chPers', scenario: 'chScen' };
        const el = g(fieldMap[field]);
        ta.value = el ? el.value : (charFormState[field] || '');
      } else {
        const v = lv[field] && lv[field][parseInt(idx)];
        ta.value = v ? (v.content || '') : '';
      }

      // Long-press / right-click to rename or delete variant
    });

    // Double-click to rename
    if (btn.dataset.idx !== '-1' && btn.dataset.idx !== 'add') {
      btn.addEventListener('dblclick', async () => {
        const field = btn.dataset.field;
        const idx   = parseInt(btn.dataset.idx);
        const lv    = charFormState._lumiVariants || captureLumiVariants();
        if (!lv[field] || !lv[field][idx]) return;
        const newLabel = await askPrompt('Rename variant:', lv[field][idx].label || ('Variant ' + (idx+1)));
        if (newLabel === null) return;
        lv[field][idx].label = newLabel.trim() || ('Variant ' + (idx+1));
        charFormState._lumiVariants = lv;
        charUnsaved = true;
        btn.textContent = lv[field][idx].label;
        // Add delete X button
      });

      // Right-click to delete
      btn.addEventListener('contextmenu', async e => {
        e.preventDefault();
        const field = btn.dataset.field;
        const idx   = parseInt(btn.dataset.idx);
        const lv    = charFormState._lumiVariants || captureLumiVariants();
        if (!lv[field]) return;
        if (!await askConfirm('Delete this variant?')) return;
        lv[field].splice(idx, 1);
        charFormState._lumiVariants = lv;
        charUnsaved = true;
        renderCharEditor();
      });
    }
  });
}

function captureLumiVariants() {
  // Read current textarea values for whichever tab is active
  const fields = ['description', 'personality', 'scenario'];
  const existing = charFormState._lumiVariants || {};
  const result = {};
  fields.forEach(field => {
    result[field] = (existing[field] || []).map(v => ({ ...v }));
    // If Default tab is active, the main textarea has the default value — variants unchanged
    // If a variant tab is active, read the textarea into that variant's content
    const wrap = document.getElementById('lumi-vwrap-' + field);
    if (!wrap) return;
    const activeTab = wrap.querySelector('.lumi-vtab.active');
    if (!activeTab) return;
    const idx = activeTab.dataset.idx;
    if (idx === '-1' || idx === 'add') return;
    const ta = wrap.querySelector('textarea');
    if (ta && result[field][parseInt(idx)] !== undefined) {
      result[field][parseInt(idx)].content = ta.value;
    }
  });
  return result;
}

function captureCharGreetings() {
  const wrap = g('chAltGreetList');
  if (!wrap) return charFormState.alternate_greetings || [];
  // Each greeting block has: [0]=header(ignored), [1]=title input, [2]=message textarea
  return [...wrap.children].map(block => {
    const titleInput = block.querySelector('input.finput');
    const ta = block.querySelector('textarea.ftextarea');
    return {
      title:   titleInput ? titleInput.value : '',
      message: ta ? ta.value : '',
    };
  });
}

// ═══════════════════════════════════════════════════════
// GREETING TOOLS (SillyTavern extension) — round-trip support
// Format: data.extensions.greeting_tools = {
//   mainGreeting: { id, title, description, contentHash },
//   greetings: { [uuid]: { id, title, description, contentHash } },
//   indexMap: { "0": uuid, "1": uuid, ... }
// }
// ═══════════════════════════════════════════════════════

function gtGenId() {
  // Generate a GreetingTools-style ID: g_<8hex>_<6hex>
  const rnd = n => Math.floor(Math.random() * 16**n).toString(16).padStart(n, '0');
  return 'g_' + rnd(8) + '_' + rnd(6);
}

function gtReadFromCard(card) {
  // Returns { mainTitle, mainDesc, alts: [{title, desc}, ...] } from extensions.greeting_tools
  const gt = card?.data?.extensions?.greeting_tools;
  if (!gt) return null;
  const main = gt.mainGreeting || {};
  const indexMap = gt.indexMap || {};
  const greetings = gt.greetings || {};
  const alts = Object.keys(indexMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(i => {
      const uuid = indexMap[i];
      const entry = greetings[uuid] || {};
      return { title: entry.title || '', description: entry.description || '', id: uuid };
    });
  return {
    mainTitle: main.title || '',
    mainDesc: main.description || '',
    mainId: main.id || null,
    alts,
  };
}

function gtWriteToCard(card, firstMesTitle, firstMesDesc, altGreetings) {
  // Writes greeting_tools back to card.data.extensions
  if (!card.data.extensions) card.data.extensions = {};

  // Only write if any greeting has a title or desc
  const hasAnyTitle = firstMesTitle || altGreetings.some(g => g.title);
  if (!hasAnyTitle) {
    // Clean up if previously existed but now all blank
    // Keep existing greeting_tools if present, just update
  }

  const existing = card.data.extensions.greeting_tools || {};
  const existingMain = existing.mainGreeting || {};
  const existingGreetings = existing.greetings || {};
  const existingIndexMap = existing.indexMap || {};

  // Main greeting
  const mainId = existingMain.id || gtGenId();
  const mainGreeting = {
    id: mainId,
    title: firstMesTitle || '',
    description: firstMesDesc || '',
    contentHash: existingMain.contentHash || 0,
  };

  // Alt greetings — preserve existing IDs where possible
  const newGreetings = {};
  const newIndexMap = {};

  altGreetings.forEach((g, i) => {
    const existingUuid = existingIndexMap[String(i)];
    const uuid = (existingUuid && existingGreetings[existingUuid]) ? existingUuid : gtGenId();
    const existingEntry = existingGreetings[uuid] || {};
    newGreetings[uuid] = {
      id: uuid,
      title: g.title || '',
      description: g.description || '',
      contentHash: existingEntry.contentHash || 0,
    };
    newIndexMap[String(i)] = uuid;
  });

  card.data.extensions.greeting_tools = {
    greetings: newGreetings,
    indexMap: newIndexMap,
    mainGreeting,
  };
}


function captureCharState() {
  charFormState.name = g('chName')?.value;
  // For lumiverse: default field is the first tab (id="chDesc" etc still present)
  charFormState.description = g('chDesc')?.value;
  charFormState.personality = g('chPers')?.value;
  charFormState.scenario = g('chScen')?.value;
  charFormState.first_mes = g('chFirst')?.value;
  charFormState.mes_example = g('chMesEx')?.value;
  charFormState.system_prompt = g('chSysPrompt')?.value;
  charFormState.post_history_instructions = g('chPHI')?.value;
  charFormState.creator_notes = g('chNotes')?.value;
  charFormState.creator = g('chCreator')?.value;
  charFormState.character_version = g('chVersion')?.value;
  charFormState.tags = g('chTags')?.value;
  charFormState.spec = g('chSpec')?.value;
  charFormState.alternate_greetings = captureCharGreetings();
  // Lumiverse variant fields
  if (charActiveFormat === 'lumiverse') {
    charFormState._lumiVariants = captureLumiVariants();
  }
}

function saveChar() {
  if (!activeCharId || !charLibrary[activeCharId]) return;
  captureCharState();
  const entry = charLibrary[activeCharId];
  const card = entry.card;
  const s = charFormState;

  card.spec = s.spec || card.spec;
  card.spec = 'chara_card_v3'; card.spec_version = '3.0'; // always export V3
  card.data.name = s.name || 'Unnamed';
  card.data.description = s.description || '';
  card.data.personality = s.personality || '';
  card.data.scenario = s.scenario || '';
  card.data.first_mes = s.first_mes || '';
  card.data.mes_example = s.mes_example || '';
  card.data.system_prompt = s.system_prompt || '';
  card.data.post_history_instructions = s.post_history_instructions || '';
  card.data.creator_notes = s.creator_notes || '';
  card.data.creator = s.creator || '';
  card.data.character_version = s.character_version || '';
  card.data.tags = (s.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  // ST format: alternate_greetings is plain strings; strip titles for ST export
  card.data.alternate_greetings = (s.alternate_greetings || [])
    .map(g => typeof g === 'object' ? (g.message || '') : (g || ''))
    .filter(m => m.trim() !== '');

  // Lumiverse alternate_fields
  if (s._lumiVariants) {
    setLumiVariants(card, 'description', s._lumiVariants.description || []);
    setLumiVariants(card, 'personality', s._lumiVariants.personality || []);
    setLumiVariants(card, 'scenario',    s._lumiVariants.scenario    || []);
  }

  entry.name = card.data.name;
  entry.savedAt = new Date().toISOString();
  charUnsaved = false;
  charFormState = {};
  saveCharLibrary();
  renderCharSidebar();
  toast('Character saved.', 'ok');
}

// ── Import / Export ──

function handleCharImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'png') {
    const r = new FileReader();
    r.onload = ev => {
      try {
        const buf = new Uint8Array(ev.target.result);
        const cardData = extractCharFromPng(buf);
        if (!cardData) { toast('No character data found in this PNG.', 'err'); return; }
        // Also store the PNG itself as the character image
        const blob = new Blob([ev.target.result], { type: 'image/png' });
        const imgReader = new FileReader();
        imgReader.onload = imgEv => {
          importCharCard(cardData, file.name, imgEv.target.result);
        };
        imgReader.readAsDataURL(blob);
      } catch(err) { toast('PNG import error: ' + err.message, 'err'); console.error(err); }
    };
    r.readAsArrayBuffer(file);
  } else {
    const r = new FileReader();
    r.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        importCharCard(data, file.name);
      } catch(err) { toast('Import error: ' + err.message, 'err'); console.error(err); }
    };
    r.readAsText(file);
  }
  e.target.value = '';
}

function importCharCard(data, filename, imageData = null) {
  let card;
  // Handle both wrapped (spec_version) and raw V1-style flat cards
  if (data.spec && data.data) {
    card = data;
  } else if (data.name !== undefined) {
    // Flat V1-style card — wrap it
    card = {
      spec: 'chara_card_v2', spec_version: '2.0',
      data: {
        name: data.name || '', description: data.description || '',
        personality: data.personality || '', scenario: data.scenario || '',
        first_mes: data.first_mes || '', mes_example: data.mes_example || '',
        creator_notes: data.creator_notes || '', system_prompt: data.system_prompt || '',
        post_history_instructions: data.post_history_instructions || '',
        alternate_greetings: (data.alternate_greetings || []).map(g => typeof g === 'object' ? g : { title: '', message: g }), tags: data.tags || [],
        creator: data.creator || '', character_version: data.character_version || '',
        extensions: data.extensions || {}, character_book: data.character_book || null
      }
    };
  } else {
    toast('Unrecognized character card format.', 'err');
    return;
  }
  normalizeCharCard(card);

  // Normalize alternate_greetings to {title, message} objects for internal use
  // (titles used by SaucepanAI export; ST keeps alternate_greetings as plain strings on export)
  card.data.alternate_greetings = (card.data.alternate_greetings || []).map(g =>
    typeof g === 'object' ? { title: g.title || '', message: g.message || g.content || '' } : { title: '', message: g || '' }
  );

  card.id = charId();
  charLibrary[card.id] = { id: card.id, name: card.data.name, card, imageData, savedAt: new Date().toISOString() };
  saveCharLibrary();
  renderCharSidebar();
  openChar(card.id);
  toast('Imported: ' + card.data.name, 'ok');
}

function exportCharJson(id) {
  const entry = charLibrary[id]; if (!entry) return;
  const fn = (entry.card.data.name || 'character').replace(/[^a-z0-9_-]/gi, '_') + '.json';
  dlFile(JSON.stringify(entry.card, null, 2), fn, 'application/json');
  toast('Exported: ' + fn, 'ok');
}

function exportCharSaucepan(id) {
  const entry = charLibrary[id]; if (!entry) return;
  captureCharState();
  const s = charFormState;
  const d = entry.card.data;

  // Build starting_scenarios from first_mes + alternate_greetings
  // Uses greeting titles if present, falls back to generated labels
  const altGreets = (s.alternate_greetings || d.alternate_greetings || [])
    .filter(g => (typeof g === 'object' ? g.message : g || '').trim() !== '');

  const scenarios = [];

  // First message
  const firstMsg = s.first_mes || d.first_mes || '';
  if (firstMsg.trim()) {
    const firstTitle = s.first_mes_title || (
      d.extensions && d.extensions.greeting_tools && d.extensions.greeting_tools.mainGreeting
        ? d.extensions.greeting_tools.mainGreeting.title
        : ''
    ) || 'Opening';
    scenarios.push({ title: firstTitle, message: firstMsg, portrait_id: null });
  }

  // Alternate greetings
  altGreets.forEach((g, i) => {
    const msg   = typeof g === 'object' ? (g.message || '') : (g || '');
    const title = typeof g === 'object' && g.title ? g.title : ('Scenario ' + (i + 2));
    scenarios.push({ title, message: msg, portrait_id: null });
  });

  // Preserve existing SaucepanAI metadata if card was originally imported from Saucepan
  const existingMeta = d.extensions && d.extensions._saucepan ? d.extensions._saucepan : {};

  const companion = {
    id:           existingMeta.id   || crypto.randomUUID(),
    name:         s.name            || d.name || 'Unknown',
    display_name: existingMeta.display_name || s.name || d.name || 'Unknown',
    full_description:  s.creator_notes || d.creator_notes || '',
    short_description: s.creator_notes ? s.creator_notes.slice(0, 200) : (d.creator_notes || '').slice(0, 200),
    tags:         (s.tags ? s.tags.split(',').map(t => t.trim()).filter(Boolean) : d.tags) || [],
    fandom_tags:  existingMeta.fandom_tags || [],
    image:        existingMeta.image || { id: null },
    image_crop_zoom: null, image_crop_x: null, image_crop_y: null,
    sus:          existingMeta.sus  ?? false,
    very_sus:     existingMeta.very_sus ?? false,
    card:         s.description     || d.description || '',
    temperature_offset_percentage: existingMeta.temperature_offset_percentage ?? 0,
    portraits:    existingMeta.portraits || [],
    example_dialogue: s.mes_example || d.mes_example || null,
    locked_starting_message: existingMeta.locked_starting_message ?? false,
    starting_scenarios: scenarios,
    access_level: existingMeta.access_level || 'private',
    formatting_instructions: s.system_prompt || d.system_prompt || null,
    advanced_prompt: s.post_history_instructions || d.post_history_instructions || null,
    open_definition: existingMeta.open_definition ?? true,
    hidden_fields: existingMeta.hidden_fields ?? 0,
    external_model_policy: existingMeta.external_model_policy || 'vetted_only',
    unlocked_portraits: existingMeta.unlocked_portraits ?? false,
    hide_on_owner_profile: existingMeta.hide_on_owner_profile ?? false,
    companion_profile_banner_crop_zoom: null,
    companion_profile_banner_crop_x: null,
    companion_profile_banner_crop_y: null,
    default_profile_banner_collection_image_crop_zoom: null,
    default_profile_banner_collection_image_crop_x: null,
    default_profile_banner_collection_image_crop_y: null,
    suppress_companion_profile_banner: existingMeta.suppress_companion_profile_banner ?? false,
    companion_profile_banner_very_sus: existingMeta.companion_profile_banner_very_sus ?? false,
  };

  const fn = (d.name || 'companion').replace(/[^a-z0-9_-]/gi, '_') + '_saucepan.json';
  dlFile(JSON.stringify(companion, null, 2), fn, 'application/json');
  toast('Exported for SaucepanAI: ' + fn, 'ok');
}

// ═══════════════════════════════════════════════════════
// CHARX IMPORT / EXPORT (Lumiverse format)
// .charx is a zip containing card.json + assets/icon/image/main.png
// Requires JSZip (loaded via CDN)
// ═══════════════════════════════════════════════════════

function handleCharxImport(e) {
  const file = e.target.files[0]; if (!file) return;
  if (typeof JSZip === 'undefined') {
    toast('JSZip not loaded — check your connection.', 'err'); return;
  }
  const r = new FileReader();
  r.onload = ev => {
    JSZip.loadAsync(ev.target.result).then(zip => {
      const cardFile = zip.file('card.json');
      if (!cardFile) { toast('.charx missing card.json', 'err'); return; }

      const imgFile  = zip.file('assets/icon/image/main.png');
      const lumiFile = zip.file('lumiverse_modules.json');
      const cardPromise = cardFile.async('string').then(JSON.parse);
      const imgPromise  = imgFile
        ? imgFile.async('base64').then(b64 => 'data:image/png;base64,' + b64)
        : Promise.resolve(null);
      const lumiPromise = lumiFile
        ? lumiFile.async('string').then(JSON.parse).catch(() => null)
        : Promise.resolve(null);

      Promise.all([cardPromise, imgPromise, lumiPromise]).then(([cardData, imageData, lumiModules]) => {
        // Merge lumiverse_modules alternate_fields into extensions._lumiverse
        if (lumiModules && lumiModules.alternate_fields) {
          if (!cardData.data) cardData.data = {};
          if (!cardData.data.extensions) cardData.data.extensions = {};
          cardData.data.extensions._lumiverse = { alternate_fields: lumiModules.alternate_fields };
        }
        importCharCard(cardData, file.name, imageData);
        toast('Imported .charx: ' + (cardData.data && cardData.data.name || file.name), 'ok');
      }).catch(err => toast('.charx parse error: ' + err.message, 'err'));
    }).catch(err => toast('.charx zip error: ' + err.message, 'err'));
  };
  r.readAsArrayBuffer(file);
  e.target.value = '';
}

function exportCharCharx(id) {
  const entry = charLibrary[id]; if (!entry) return;
  if (typeof JSZip === 'undefined') {
    toast('JSZip not loaded — check your connection.', 'err'); return;
  }

  // Make sure card is saved first
  captureCharState();
  saveChar();

  const zip = new JSZip();
  zip.file('card.json', JSON.stringify(entry.card, null, 2));

  const name = (entry.card.data.name || 'character').replace(/[^a-z0-9_-]/gi, '_');

  // Write lumiverse_modules.json if any alternate_fields exist
  const lumiAltFields = entry.card.data?.extensions?._lumiverse?.alternate_fields;
  const hasLumiVariants = lumiAltFields && Object.values(lumiAltFields).some(arr => arr && arr.length > 0);
  if (hasLumiVariants) {
    const lumiModules = { version: 1, alternate_fields: lumiAltFields };
    zip.file('lumiverse_modules.json', JSON.stringify(lumiModules, null, 2));
  }

  const finish = () => {
    zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name + '.charx';
      document.body.append(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Exported .charx: ' + name, 'ok');
    }).catch(err => toast('.charx export error: ' + err.message, 'err'));
  };

  if (entry.imageData) {
    // imageData is a base64 data URL — extract raw base64
    const b64 = entry.imageData.split(',')[1];
    zip.folder('assets/icon/image').file('main.png', b64, { base64: true });
    finish();
  } else {
    // No image stored — export without image
    finish();
  }
}


// ── PNG character card embed / extract ──
// Character data is stored in a tEXt chunk keyword "chara" as base64 JSON.

function openCharPngExport(id) {
  const entry = charLibrary[id]; if (!entry) return;

  const doExport = (arrayBuf) => {
    try {
      const buf = new Uint8Array(arrayBuf);
      const outBuf = embedCharInPng(buf, entry.card);
      const blob = new Blob([outBuf], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (entry.card.data.name || 'character').replace(/[^a-z0-9_-]/gi,'_') + '.png';
      document.body.append(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('PNG card exported!', 'ok');
    } catch(err) { toast('PNG export error: ' + err.message, 'err'); console.error(err); }
  };

  if (entry.imageData) {
    // Convert stored base64 data URL to ArrayBuffer
    const b64 = entry.imageData.split(',')[1];
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    doExport(buf);
  } else {
    // No stored image — ask user to pick one
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      // Convert to PNG via canvas if not already PNG
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          blob.arrayBuffer().then(doExport);
        }, 'image/png');
      };
      img.src = url;
    };
    input.click();
    toast('No image set — pick one to use as the card base.', 'info');
  }
}

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32be(n) {
  return new Uint8Array([(n>>>24)&255, (n>>>16)&255, (n>>>8)&255, n&255]);
}

function strToBytes(s) {
  return new Uint8Array([...s].map(c => c.charCodeAt(0)));
}

function embedCharInPng(pngBuf, card) {
  // Validate PNG signature
  const sig = [137,80,78,71,13,10,26,10];
  for (let i = 0; i < 8; i++) if (pngBuf[i] !== sig[i]) throw new Error('Not a valid PNG file');

  const json = JSON.stringify(card);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const keyword = 'chara';
  const textData = keyword + '\0' + b64;
  const textBytes = strToBytes(textData);

  // Build tEXt chunk: length(4) + "tEXt"(4) + data + crc(4)
  const typeBytes = strToBytes('tEXt');
  const chunkBody = new Uint8Array(typeBytes.length + textBytes.length);
  chunkBody.set(typeBytes, 0);
  chunkBody.set(textBytes, typeBytes.length);
  const crc = crc32(chunkBody);
  const lenBytes = u32be(textBytes.length);
  const crcBytes = u32be(crc);

  const newChunk = new Uint8Array(4 + 4 + textBytes.length + 4);
  newChunk.set(lenBytes, 0);
  newChunk.set(typeBytes, 4);
  newChunk.set(textBytes, 8);
  newChunk.set(crcBytes, 8 + textBytes.length);

  // Find insertion point: right after IHDR chunk (first chunk after the 8-byte signature)
  // IHDR chunk: 4(len) + 4(type) + 13(data) + 4(crc) = 25 bytes, starts at offset 8
  const ihdrLen = (pngBuf[8]<<24 | pngBuf[9]<<16 | pngBuf[10]<<8 | pngBuf[11]) >>> 0;
  const insertAt = 8 + 4 + 4 + ihdrLen + 4; // sig + len + type + data + crc

  // Remove any existing "chara" tEXt chunks first
  const stripped = stripExistingCharaChunks(pngBuf);
  const adjInsertAt = Math.min(insertAt, stripped.length);

  const out = new Uint8Array(stripped.length + newChunk.length);
  out.set(stripped.subarray(0, adjInsertAt), 0);
  out.set(newChunk, adjInsertAt);
  out.set(stripped.subarray(adjInsertAt), adjInsertAt + newChunk.length);
  return out;
}

function stripExistingCharaChunks(buf) {
  const out = [];
  let pos = 8;
  out.push(buf.subarray(0, 8));
  while (pos < buf.length) {
    const len = (buf[pos]<<24 | buf[pos+1]<<16 | buf[pos+2]<<8 | buf[pos+3]) >>> 0;
    const type = String.fromCharCode(buf[pos+4], buf[pos+5], buf[pos+6], buf[pos+7]);
    const chunkTotal = 4 + 4 + len + 4;
    if (type === 'tEXt') {
      // Check keyword
      let kwEnd = pos + 8;
      while (kwEnd < pos + 8 + len && buf[kwEnd] !== 0) kwEnd++;
      const keyword = String.fromCharCode(...buf.subarray(pos+8, kwEnd));
      if (keyword === 'chara' || keyword === 'ccv3') {
        pos += chunkTotal;
        continue; // skip this chunk
      }
    }
    out.push(buf.subarray(pos, pos + chunkTotal));
    pos += chunkTotal;
  }
  // Concatenate
  let total = 0; out.forEach(p => total += p.length);
  const result = new Uint8Array(total);
  let off = 0;
  out.forEach(p => { result.set(p, off); off += p.length; });
  return result;
}

function extractCharFromPng(buf) {
  const sig = [137,80,78,71,13,10,26,10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('Not a valid PNG file');
  let pos = 8;
  while (pos < buf.length) {
    const len = (buf[pos]<<24 | buf[pos+1]<<16 | buf[pos+2]<<8 | buf[pos+3]) >>> 0;
    const type = String.fromCharCode(buf[pos+4], buf[pos+5], buf[pos+6], buf[pos+7]);
    if (type === 'tEXt') {
      let kwEnd = pos + 8;
      const chunkEnd = pos + 8 + len;
      while (kwEnd < chunkEnd && buf[kwEnd] !== 0) kwEnd++;
      const keyword = String.fromCharCode(...buf.subarray(pos+8, kwEnd));
      if (keyword === 'chara') {
        // Use TextDecoder instead of spread into fromCharCode — spread blows
        // the call stack on large PNGs (maximum call stack size exceeded)
        const b64 = new TextDecoder('latin1').decode(buf.subarray(kwEnd+1, chunkEnd));
        const json = decodeURIComponent(escape(atob(b64)));
        return JSON.parse(json);
      }
    }
    if (type === 'IEND') break;
    pos += 4 + 4 + len + 4;
  }
  return null;
}

// Character library modal reuses the same #libModal as lorebooks, but
// scoped to charLibrary instead of the lorebook-saves library
function openCharLibrary() {
  g('libModalTitle').textContent = 'Character Library';
  const list = g('libList');
  list.innerHTML = '';
  const chars = Object.values(charLibrary).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  if (!chars.length) {
    list.innerHTML = '<div class="lib-empty">// no characters yet</div>';
  } else {
    chars.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'lib-item' + (entry.id === activeCharId ? ' active' : '');
      const date = new Date(entry.savedAt).toLocaleDateString();
      item.innerHTML = `
        <span class="lib-name">${entry.name || 'Unnamed'}</span>
        <span class="lib-meta">${date}</span>
        <div class="lib-acts">
          <button class="btn btn-s btn-sm lib-load">Load</button>
          <button class="btn btn-err btn-sm lib-del">✕</button>
        </div>`;
      item.querySelector('.lib-name').addEventListener('click', () => { openChar(entry.id); closeModal('libModal'); });
      item.querySelector('.lib-load').addEventListener('click', () => { openChar(entry.id); closeModal('libModal'); });
      item.querySelector('.lib-del').addEventListener('click', () => { deleteChar(entry.id); openCharLibrary(); });
      list.append(item);
    });
  }
  // Hide the "save current as" row — char saves happen via the Save button in the editor, not here
  g('libSaveBtn').parentElement.style.display = 'none';
  openModal('libModal');
}

function closeCharLibraryModal() {
  g('libSaveBtn').parentElement.style.display = '';
  closeModal('libModal');
}

// Preset editor — stub pending full build (sampler settings + prompt list)
