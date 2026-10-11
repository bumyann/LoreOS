// ═══════════════════════════════════════════════════════
// CHARACTER CARD EDITOR
// ═══════════════════════════════════════════════════════

import { migrateCharacterBook, openAttachLbModal, updateLbStatus } from './attach_lb.js';
import { downscaleAvatar } from './avatar.js';
import { exportCharCharx, exportCharJson, exportCharJsonV2, openCharPngExport } from './character_io.js';
import { openFullscreen } from './fullscreen.js';
import { itemHistoryPush, itemUndoGet, itemUndoPush, openItemHistory, syncItemUndoButtons, wireFieldUndoRedo } from './history.js';
import { closeMobSidebar } from './mobile.js';
import { state } from './state.js';
import { saveCharLibrary } from './storage.js';
import { registerTrashRestorer, trashPush } from './trash.js';
import { askConfirm, askInput, closeAllDropdowns, closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import { commitActiveEditor, wsDropItem, wsMarkSaved, wsShowItem } from './workshop.js';

// Active format picker state: 'st' | 'saucepan' | 'lumiverse'
export let charActiveFormat = 'st';

// ── Lumiverse alternate_fields helpers ──
export function getLumiVariants(card, field) {
  return card?.data?.extensions?._lumiverse?.alternate_fields?.[field] || [];
}
export function setLumiVariants(card, field, variants) {
  if (!card.data.extensions) card.data.extensions = {};
  if (!card.data.extensions._lumiverse) card.data.extensions._lumiverse = {};
  if (!card.data.extensions._lumiverse.alternate_fields) card.data.extensions._lumiverse.alternate_fields = {};
  card.data.extensions._lumiverse.alternate_fields[field] = variants;
}
export function lumiGenId() {
  return 'xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function blankCharCard() {
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

export function normalizeCharCard(card) {
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
  if (!card.spec_version) { card.spec = 'chara_card_v3'; card.spec_version = '3.0'; } // default new cards to V3
  migrateCharacterBook(card); // old object-shaped character_book -> spec array
  return card;
}

export function charId() { return 'c' + Date.now() + Math.floor(Math.random()*1000); }

export function createChar() {
  const card = blankCharCard();
  state.charLibrary[card.id] = { id: card.id, name: card.data.name, card, savedAt: new Date().toISOString() };
  saveCharLibrary();
  renderCharSidebar();
  // New characters get their own workshop tab (falls back to no tab if full)
  if (!wsShowItem('char', card.id)) openChar(card.id);
}

export function openChar(id) {
  // Moving to a different character: save what's typed in the current one first
  if (state.activeCharId && state.activeCharId !== id) commitActiveEditor();
  state.charUnsaved = false;
  state.activeCharId = id;
  state.charFormState = {}; // clear stale state from previous character
  charActiveFormat = 'st'; // reset format picker
  renderCharSidebar();
  renderCharEditor();
}

export async function deleteChar(id) {
  if (!await askConfirm('Delete this character? You can bring it back from Settings > Storage > Recently deleted.')) return;
  if (state.charLibrary[id]) trashPush('char', state.charLibrary[id].name || 'Unnamed character', state.charLibrary[id]);
  delete state.charLibrary[id];
  wsDropItem('char', id);
  if (state.activeCharId === id) state.activeCharId = null;
  saveCharLibrary();
  renderCharSidebar();
  renderCharEditor();
}

export function duplicateChar(id) {
  const src = state.charLibrary[id]; if (!src) return;
  const newId = charId();
  const card = JSON.parse(JSON.stringify(src.card));
  card.id = newId;
  card.data.name = (card.data.name || 'Unnamed') + ' (Copy)';
  state.charLibrary[newId] = { id: newId, name: card.data.name, card, savedAt: new Date().toISOString() };
  saveCharLibrary();
  renderCharSidebar();
  if (!wsShowItem('char', newId)) openChar(newId);
}

export function renderCharSidebar() {
  const list = g('entryList');
  const count = g('entryCount');
  const chars = Object.values(state.charLibrary).sort((a,b) => (a.name||'').localeCompare(b.name||''));
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
    if (entry.id === state.activeCharId) li.classList.add('open');

    const head = document.createElement('div');
    head.className = 'ei-head';
    const name = document.createElement('div');
    name.className = 'ei-name';
    name.textContent = entry.name || entry.card.data.name || 'Unnamed';
    // Small avatar so characters are recognisable at a glance
    if (entry.imageData) {
      const av = document.createElement('img');
      av.src = entry.imageData; av.alt = '';
      av.style.cssText = 'width:26px;height:26px;border-radius:4px;object-fit:cover;flex-shrink:0;margin-right:.45rem';
      head.style.alignItems = 'center';
      head.append(av);
    } else {
      // Placeholder tile keeps the names lined up with avatar rows
      const ph = document.createElement('div');
      ph.textContent = (entry.name || '?').trim().charAt(0).toUpperCase() || '?';
      ph.style.cssText = 'width:26px;height:26px;border-radius:4px;flex-shrink:0;margin-right:.45rem;display:flex;align-items:center;justify-content:center;background:var(--bg3,#1d2238);color:var(--txm);font-size:.8rem';
      head.style.alignItems = 'center';
      head.append(ph);
    }
    head.append(name);
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

    li.addEventListener('click', () => {
      // Through the workshop tab bar so the character gets a tab like any other
      if (!wsShowItem('char', entry.id)) openChar(entry.id);
      closeMobSidebar();
    });
    list.append(li);
  });
}

export function renderCharEditor() {
  const ec = g('editorContent');
  g('tabBar').innerHTML = '';

  if (!state.activeCharId || !state.charLibrary[state.activeCharId]) {
    ec.className = '';
    ec.innerHTML = `<div class="empty-state"><div>// select or create a character</div><button class="btn btn-ok" id="newEntryBtnAlt">+ New Character</button></div>`;
    g('newEntryBtnAlt').onclick = createChar;
    return;
  }

  const entry = state.charLibrary[state.activeCharId];
  const card = normalizeCharCard(entry.card);
  const d = card.data;
  const s = state.charFormState;
  const get = (k, fb) => s[k] !== undefined ? s[k] : fb;

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
  const lumiVariants = state.charFormState._lumiVariants || {
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
            <option value="st"${fmt === 'st' ? ' selected' : ''}>SillyTavern</option>
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

    <div class="attach-lb-panel"${isSauce ? ' style="display:none"' : ''}>
      <div class="attach-lb-status" id="chLbStatus">🌐 No lorebook attached</div>
      <div class="attach-lb-acts">
        <button class="btn btn-s btn-sm" id="chLbManageBtn">Manage Attached Lorebook</button>
      </div>
    </div>

    <div class="editor-actions">
      <button class="btn btn-p" id="chSaveBtn">Save Changes</button>
      <button class="btn btn-s item-ur-btn" id="chUndoBtn" title="Undo last change" disabled>↩ Undo</button>
      <button class="btn btn-s item-ur-btn" id="chRedoBtn" title="Redo" disabled>Redo ↪</button>
      <div class="dd" id="dd-char-export">
        <button class="btn btn-s dd-btn">&#8657; Export</button>
        <div class="dd-menu">
          <button class="dd-item" id="chExportV3PngBtn">V3 PNG</button>
          <button class="dd-item" id="chExportPngBtn">V2 PNG</button>
          <button class="dd-item" id="chExportJanitorPngBtn">JanitorAI PNG</button>
          <details class="dd-group">
            <summary>JSON</summary>
            <button class="dd-item" id="chExportJsonBtn">V3 JSON</button>
            <button class="dd-item" id="chExportV2JsonBtn">V2 JSON</button>
            <button class="dd-item" id="chExportJanitorBtn">JanitorAI JSON</button>
          </details>
          <button class="dd-item" id="chExportCharxBtn">.CHARX</button>
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
    state.charFormState.alternate_greetings = cur;
    state.charUnsaved = true;
    renderAltGreetings(cur);
  });
  g('chFormatPicker').addEventListener('change', e => {
    captureCharState();
    charActiveFormat = e.target.value;
    renderCharEditor();
  });
  g('chSaveBtn').addEventListener('click', () => saveChar());
  if (g('chUndoBtn')) g('chUndoBtn').addEventListener('click', () => {
    const snap = itemUndoGet('char', state.activeCharId, 'undo');
    if (!snap) return;
    state.charFormState = snap;
    state.charUnsaved = true;
    renderCharEditor();
    syncItemUndoButtons('char', state.activeCharId);
  });
  if (g('chRedoBtn')) g('chRedoBtn').addEventListener('click', () => {
    const snap = itemUndoGet('char', state.activeCharId, 'redo');
    if (!snap) return;
    state.charFormState = snap;
    state.charUnsaved = true;
    renderCharEditor();
    syncItemUndoButtons('char', state.activeCharId);
  });
  g('chExportJsonBtn').addEventListener('click', () => exportCharJson(state.activeCharId));
  if (g('chExportV2JsonBtn'))   g('chExportV2JsonBtn').addEventListener('click',   () => exportCharJsonV2(state.activeCharId));
  if (g('chLbManageBtn'))       g('chLbManageBtn').addEventListener('click',       () => openAttachLbModal());
  g('chExportPngBtn').addEventListener('click', () => openCharPngExport(state.activeCharId, true));
  if (g('chExportV3PngBtn')) g('chExportV3PngBtn').addEventListener('click', () => openCharPngExport(state.activeCharId, false));
  if (g('chExportJanitorBtn')) g('chExportJanitorBtn').addEventListener('click', () => exportCharJsonV2(state.activeCharId, { janitor: true }));
  if (g('chExportJanitorPngBtn')) g('chExportJanitorPngBtn').addEventListener('click', () => openCharPngExport(state.activeCharId, true, { janitor: true }));
  if (g('chExportCharxBtn')) g('chExportCharxBtn').addEventListener('click', () => exportCharCharx(state.activeCharId));
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
  g('chDeleteBtn').addEventListener('click', () => deleteChar(state.activeCharId));

  // Image upload wiring
  const imgPreview = g('chImagePreview');
  const imgInput = g('chImageFileInput');
  const imgRemove = g('chImageRemoveBtn');
  const charEntry = state.charLibrary[state.activeCharId];

  function refreshImagePreview() {
    const src = charEntry?.imageData;
    if (src) {
      // Built with the DOM, not an HTML string: the stored image data is not trusted
      imgPreview.innerHTML = '';
      const im = document.createElement('img');
      im.src = src;
      im.style.cssText = 'width:100%;height:100%;object-fit:cover';
      imgPreview.append(im);
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
    r.onload = async ev => {
      if (!charEntry) return;
      const raw = ev.target.result;              // base64 data URL
      const small = await downscaleAvatar(raw);  // resize before storing
      charEntry.imageData = small;
      if (!saveCharLibrary()) return;            // safeSet already explained why
      refreshImagePreview();
      const saved = raw.length - small.length;
      toast(saved > 1024
        ? `Image set (resized, saved ${Math.round(saved/1024)}KB).`
        : 'Image set.', 'ok');
    };
    r.readAsDataURL(file);
    e.target.value = '';
  });

  // Mark unsaved on input + push item undo snapshot
  ec.querySelectorAll('input,textarea,select').forEach(el => {
    el.addEventListener('input', () => {
      state.charUnsaved = true; captureCharState();
      itemUndoPush('char', state.activeCharId, JSON.parse(JSON.stringify(state.charFormState)));
      syncItemUndoButtons('char', state.activeCharId);
    });
    el.addEventListener('change', () => {
      state.charUnsaved = true; captureCharState();
      itemUndoPush('char', state.activeCharId, JSON.parse(JSON.stringify(state.charFormState)));
      syncItemUndoButtons('char', state.activeCharId);
    });
  });

  // Wire field-level undo/redo on all textareas
  wireFieldUndoRedo(ec);

  // Push initial baseline for undo
  captureCharState();
  itemUndoPush('char', state.activeCharId, JSON.parse(JSON.stringify(state.charFormState)));
  syncItemUndoButtons('char', state.activeCharId);
}

export function renderAltGreetings(list) {
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
      state.charFormState.alternate_greetings = cur;
      state.charUnsaved = true;
      renderAltGreetings(cur);
    });
    hdr.append(lbl, rm);

    // Title input
    const titleInput = document.createElement('input');
    titleInput.className = 'finput'; titleInput.type = 'text';
    titleInput.placeholder = 'Greeting title (optional)...';
    titleInput.value = titleVal;
    titleInput.addEventListener('input', () => { state.charUnsaved = true; });

    // Message textarea
    const ta = document.createElement('textarea');
    ta.className = 'ftextarea'; ta.style.minHeight = '70px';
    ta.id = 'chGreet_' + i;
    ta.placeholder = 'Greeting message #' + (i + 1) + '...';
    ta.value = messageVal;
    ta.addEventListener('input', () => { state.charUnsaved = true; });

    // content-wrap with tok-count + expand button
    const cwrap = document.createElement('div');
    cwrap.className = 'content-wrap';
    cwrap.appendChild(ta);
    const tok = document.createElement('span');
    tok.className = 'tok-count';
    const updateTok = () => {
      const t = Math.round((ta.value || '').length / 3.5);
      tok.textContent = (ta.value || '').length + ' chars · ~' + t + ' tokens';
    };
    ta.addEventListener('input', updateTok);
    updateTok();
    const expBtn = document.createElement('button');
    expBtn.className = 'expand-btn';
    expBtn.textContent = '⛶ expand';
    expBtn.dataset.fieldId = ta.id;
    expBtn.dataset.label = 'Greeting #' + (i + 1);
    expBtn.addEventListener('click', e => { e.preventDefault(); openFullscreen(ta.id, 'Greeting #' + (i + 1)); });
    cwrap.append(tok, expBtn);

    block.append(hdr, titleInput, cwrap);
    wrap.append(block);
  });
}

// ── Lumiverse variant field UI ──

export function renderLumiVariantField(baseId, field, defaultVal, variants, placeholder, minHeight) {
  const esc2 = esc;
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

export const LUMI_FIELDS = ['description', 'personality', 'scenario'];
export const LUMI_FIELD_IDS = { description: 'chDesc', personality: 'chPers', scenario: 'chScen' };

// Which tab is showing in a field's shared textarea: '-1' = Default, else variant index
export function lumiActiveIdx(field) {
  const wrap = document.getElementById('lumi-vwrap-' + field);
  const active = wrap && wrap.querySelector('.lumi-vtab.active');
  return active ? active.dataset.idx : '-1';
}

// Write what the shared textarea currently shows back into the slot it belongs to
export function lumiStashField(field, lv) {
  const ta = g(LUMI_FIELD_IDS[field]);
  if (!ta) return;
  const idx = lumiActiveIdx(field);
  if (idx === '-1' || idx === 'add') {
    state.charFormState[field] = ta.value;
  } else {
    const v = lv[field] && lv[field][parseInt(idx)];
    if (v) v.content = ta.value;
  }
}

export function wireLumiVariantFields() {
  document.querySelectorAll('.lumi-vtab').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const idx   = btn.dataset.idx;
      const wrap  = document.getElementById('lumi-vwrap-' + field);
      const ta    = g(LUMI_FIELD_IDS[field]);
      if (!wrap || !ta) return;

      // Save whatever is on screen into its own slot BEFORE the textarea changes
      captureCharState();
      const lv = state.charFormState._lumiVariants;

      if (idx === 'add') {
        if (!lv[field]) lv[field] = [];
        lv[field].push({ id: lumiGenId(), label: 'Variant ' + (lv[field].length + 1), content: '' });
        state.charUnsaved = true;
        renderCharEditor();
        return;
      }

      wrap.querySelectorAll('.lumi-vtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (idx === '-1') {
        ta.value = state.charFormState[field] || '';
      } else {
        const v = lv[field] && lv[field][parseInt(idx)];
        ta.value = v ? (v.content || '') : '';
      }
    });

    if (btn.dataset.idx !== '-1' && btn.dataset.idx !== 'add') {
      // Double-click to rename
      btn.addEventListener('dblclick', async () => {
        const field = btn.dataset.field;
        const idx   = parseInt(btn.dataset.idx);
        captureCharState();
        const lv = state.charFormState._lumiVariants;
        if (!lv[field] || !lv[field][idx]) return;
        const newLabel = await askInput('Rename variant:', lv[field][idx].label || ('Variant ' + (idx+1)));
        if (newLabel === null) return;
        lv[field][idx].label = newLabel.trim() || ('Variant ' + (idx+1));
        state.charUnsaved = true;
        btn.textContent = lv[field][idx].label;
      });

      // Right-click to delete
      btn.addEventListener('contextmenu', async e => {
        e.preventDefault();
        const field = btn.dataset.field;
        const idx   = parseInt(btn.dataset.idx);
        if (!await askConfirm('Delete this variant?')) return;
        captureCharState();
        const lv = state.charFormState._lumiVariants;
        if (!lv[field]) return;
        lv[field].splice(idx, 1);
        state.charUnsaved = true;
        renderCharEditor();
      });
    }
  });
}

// Returns a fresh copy of all variants with the on-screen textarea routed into
// the right slot. Falls back to the card's stored variants the first time,
// previously it fell back to {}, which dropped every imported variant.
export function captureLumiVariants() {
  const card = state.charLibrary[state.activeCharId]?.card;
  const src = state.charFormState._lumiVariants || {};
  const result = {};
  LUMI_FIELDS.forEach(field => {
    const base = src[field] || getLumiVariants(card, field);
    result[field] = base.map(v => ({ ...v }));
    lumiStashField(field, result);
  });
  return result;
}

export function captureCharGreetings() {
  const wrap = g('chAltGreetList');
  if (!wrap) return state.charFormState.alternate_greetings || [];
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

export function gtGenId() {
  // Generate a GreetingTools-style ID: g_<8hex>_<6hex>
  const rnd = n => Math.floor(Math.random() * 16**n).toString(16).padStart(n, '0');
  return 'g_' + rnd(8) + '_' + rnd(6);
}

export function gtReadFromCard(card) {
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

export function gtWriteToCard(card, firstMesTitle, firstMesDesc, altGreetings) {
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

export function captureCharState() {
  state.charFormState.name = g('chName')?.value;
  // Lumiverse: chDesc/chPers/chScen are shared between the Default tab and
  // every variant tab, so the textarea only holds the Default text while the
  // Default tab is active. captureLumiVariants() routes each textarea's value
  // into the right slot (charFormState[field] for Default, the variant's
  // .content otherwise). Reading the textarea straight into description here
  // is what made variant text overwrite Default.
  const lumiUi = charActiveFormat === 'lumiverse' && document.getElementById('lumi-vwrap-description');
  if (!lumiUi) {
    state.charFormState.description = g('chDesc')?.value;
    state.charFormState.personality = g('chPers')?.value;
    state.charFormState.scenario = g('chScen')?.value;
  }
  state.charFormState.first_mes = g('chFirst')?.value;
  state.charFormState.mes_example = g('chMesEx')?.value;
  state.charFormState.system_prompt = g('chSysPrompt')?.value;
  state.charFormState.post_history_instructions = g('chPHI')?.value;
  state.charFormState.creator_notes = g('chNotes')?.value;
  state.charFormState.creator = g('chCreator')?.value;
  state.charFormState.character_version = g('chVersion')?.value;
  state.charFormState.tags = g('chTags')?.value;
  state.charFormState.spec = g('chSpec')?.value;
  state.charFormState.alternate_greetings = captureCharGreetings();
  // Lumiverse variant fields (also stashes the Default text, see above)
  if (lumiUi) {
    state.charFormState._lumiVariants = captureLumiVariants();
    // Safety net: never let a Default field fall through as undefined,
    // saveChar() would turn that into an empty string.
    const d = state.charLibrary[state.activeCharId]?.card?.data || {};
    LUMI_FIELDS.forEach(f => { if (state.charFormState[f] === undefined) state.charFormState[f] = d[f] || ''; });
  }
}

export function saveChar(opts = {}) {
  if (!state.activeCharId || !state.charLibrary[state.activeCharId]) return false;
  captureCharState();
  const entry = state.charLibrary[state.activeCharId];
  const card = entry.card;
  const s = state.charFormState;

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
  // Kept as { title, message } here (the titles belong to SaucepanAI and the editor);
  // every export flattens them back to the plain strings SillyTavern expects
  card.data.alternate_greetings = (s.alternate_greetings || [])
    .map(g => typeof g === 'object' ? { title: g.title || '', message: g.message || '' } : { title: '', message: g || '' })
    .filter(g => g.message.trim() !== '');

  // Lumiverse alternate_fields
  if (s._lumiVariants) {
    setLumiVariants(card, 'description', s._lumiVariants.description || []);
    setLumiVariants(card, 'personality', s._lumiVariants.personality || []);
    setLumiVariants(card, 'scenario',    s._lumiVariants.scenario    || []);
  }

  entry.name = card.data.name;
  entry.savedAt = new Date().toISOString();
  state.charUnsaved = false;
  state.charFormState = {};

  // Snapshot this version into history. The snapshot strips the avatar
  // and the nested history list (see itemHistoryPush) — previously each
  // snapshot carried a full copy of the image, which meant the write
  // blew the storage quota and silently failed, which is why history
  // has never actually persisted.
  // Autosaves pass noHistory so they don't use up the 10 snapshot slots.
  if (!opts.noHistory) itemHistoryPush('char', state.activeCharId, entry);

  const ok = saveCharLibrary();
  renderCharSidebar();
  wsMarkSaved('char', state.activeCharId);
  if (ok && !opts.silent) toast('Character saved.', 'ok');
  return ok;
}

// Character library modal reuses the same #libModal as lorebooks, but
// scoped to charLibrary instead of the lorebook-saves library
export function openCharLibrary() {
  g('libModalTitle').textContent = 'Character Library';
  const list = g('libList');
  list.innerHTML = '';
  const chars = Object.values(state.charLibrary).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  if (!chars.length) {
    list.innerHTML = '<div class="lib-empty">// no characters yet</div>';
  } else {
    chars.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'lib-item' + (entry.id === state.activeCharId ? ' active' : '');
      const date = new Date(entry.savedAt).toLocaleDateString();
      item.innerHTML = `
        <span class="lib-name">${esc(entry.name || 'Unnamed')}</span>
        <span class="lib-meta">${date}</span>
        <div class="lib-acts">
          <button class="btn btn-s btn-sm lib-load">Load</button>
          <button class="btn btn-s btn-sm lib-hist lib-item-hist" title="Version history">🕓</button>
          <button class="btn btn-err btn-sm lib-del">✕</button>
        </div>`;
      item.querySelector('.lib-name').addEventListener('click', () => { openChar(entry.id); closeModal('libModal'); });
      item.querySelector('.lib-load').addEventListener('click', () => { openChar(entry.id); closeModal('libModal'); });
      item.querySelector('.lib-hist').addEventListener('click', () => { openItemHistory('char', entry.id); });
      item.querySelector('.lib-del').addEventListener('click', () => { deleteChar(entry.id); openCharLibrary(); });
      list.append(item);
    });
  }
  // Hide the "save current as" row — char saves happen via the Save button in the editor, not here
  g('libSaveBtn').parentElement.style.display = 'none';
  openModal('libModal');
}

export function closeCharLibraryModal() {
  g('libSaveBtn').parentElement.style.display = '';
  closeModal('libModal');
}

// Preset editor — stub pending full build (sampler settings + prompt list)

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(30, `<input type="file" id="fileCharInput" accept=".json,.png" style="display:none">`);

registerMarkup(40, `<input type="file" id="fileCharxInput" accept=".charx" style="display:none">`);

registerMarkup(50, `<input type="file" id="fileCharCompanionInput" accept=".json" style="display:none">`);


registerTrashRestorer('char', data => {
  const id = data.id && !state.charLibrary[data.id] ? data.id : charId();
  state.charLibrary[id] = { ...data, id };
  if (state.charLibrary[id].card && state.charLibrary[id].card.id) state.charLibrary[id].card.id = id;
  saveCharLibrary();
  if (state.mode === 'char') renderCharSidebar();
});
