// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let mode = 'lore'; // 'lore' | 'char' | 'preset'
let lorebook = { entries: {} };
let openTabs = [];
let activeTabId = null;
let nextUid = 0;
let sideBySide = false;
let selectedEntries = [];
let draggedEntries = [];
let unsaved = new Set();
let formState = {};
let mergeStaging = null;
let mergeSelected = [];
let zoomLevel = 1;
let searchResults = [];
let searchIdx = 0;

// Character card library: { id: { id, name, card, savedAt } }
let charLibrary = {};
let activeCharId = null;
let charFormState = {};
let charUnsaved = false;

// Preset library: { id: { id, name, preset, savedAt } }
let presetLibrary = {};
let activePresetId = null;
let presetFormState = {};
let presetUnsaved = false;

// ── Workshop-level tabs ──
// wsItems: array of { id, type: 'lore'|'char'|'preset', itemId, unsaved }
// Max 5 tabs open at once
const WS_MAX_TABS = 5;
let wsItems = [];      // open workshop tabs
let wsActiveId = null; // currently focused ws tab id
let wsNextId = 1;      // internal tab id counter

// ── Pronoun/noun tool globals — must live here so wireEvents can reference PT ──
const PT = {
  open: false,
  src: 'they',
  tgt: 'macro',
  targetField: null,
  manualTokens: [],
};
const MACROS = {
  sub: '{{sub}}', obj: '{{obj}}', poss: '{{poss}}',
  poss_p: '{{poss_p}}', ref: '{{ref}}'
};
const PRONOUN_FORMS = {
  he:   { sub: 'he',   obj: 'him',  poss: 'his',   poss_p: 'his',   ref: 'himself'   },
  she:  { sub: 'she',  obj: 'her',  poss: 'her',   poss_p: 'hers',  ref: 'herself'   },
  they: { sub: 'they', obj: 'them', poss: 'their', poss_p: 'theirs', ref: 'themselves' },
};
const CONTRACTION_FORMS = {
  he:   { sub_is: "he's",   sub_ll: "he'll",   sub_d: "he'd",   sub_has: "he's"   },
  she:  { sub_is: "she's",  sub_ll: "she'll",  sub_d: "she'd",  sub_has: "she's"  },
  they: { sub_is: "they're", sub_ll: "they'll", sub_d: "they'd", sub_has: "they've" },
};
const THEY_VERB_FIX = { is:'are', was:'were', has:'have', does:'do', "doesn't":"don't", "hasn't":"haven't", "wasn't":"weren't" };
const SINGULAR_VERB_FIX = { are:'is', were:'was', have:'has', do:'does', "don't":"doesn't", "haven't":"hasn't", "weren't":"wasn't" };
const NOUN_TABLE = [
  ['brother','sister','sibling'],['brothers','sisters','siblings'],
  ['father','mother','parent'],['dad','mom','parent'],
  ['son','daughter','child'],['sons','daughters','children'],
  ['uncle','aunt',null],['uncles','aunts',null],
  ['nephew','niece',null],['nephews','nieces',null],
  ['husband','wife','spouse'],['husbands','wives','spouses'],
  ['boyfriend','girlfriend','partner'],['boyfriends','girlfriends','partners'],
  ['king','queen','ruler'],['kings','queens','rulers'],
  ['prince','princess',null],['princes','princesses',null],
  ['lord','lady',null],['lords','ladies',null],
  ['sir',"ma'am",null],
  ['man','woman','person'],['men','women','people'],
  ['boy','girl',null],['boys','girls',null],
  ['gentleman','lady','person'],['gentlemen','ladies','people'],
  ['male','female',null],
  ['grandfather','grandmother','grandparent'],
  ['grandson','granddaughter','grandchild'],
  ['stepfather','stepmother','stepparent'],
  ['stepson','stepdaughter','stepchild'],
  ['godfather','godmother',null],['godson','goddaughter',null],
  ['widower','widow',null],
  ['actor','actress','actor'],
  ['waiter','waitress','server'],
  ['steward','stewardess','flight attendant'],
  ['landlord','landlady','landlord'],
];
const NOUN_MAP = {};
NOUN_TABLE.forEach(([m, f, n]) => {
  if (m) NOUN_MAP[m.toLowerCase()] = { masc: m, fem: f, neutral: n, src: 0 };
  if (f) NOUN_MAP[f.toLowerCase()] = { masc: m, fem: f, neutral: n, src: 1 };
  if (n) NOUN_MAP[n.toLowerCase()] = { masc: m, fem: f, neutral: n, src: 2 };
});
let PT_nounTgt = 'masc';
let PT_nounTokens = [];

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadPrefs();
  wireEvents();
  try { wireMobile(); } catch(e) { console.error('[LoreOS] wireMobile crashed:', e); }
  loadFromStorage();
  switchMode('lore');
  if (typeof initRouter === 'function') initRouter();
  wirePronounTool();
  wireFullscreen();
  wireTplLibrary();
  wireSettings();
  wireFonts();
  applyAllCustomisations();
  applyFonts();
});

function loadPrefs() {
  if (localStorage.getItem('aet_theme') === 'pink') document.body.classList.add('pink');
  const z = localStorage.getItem('aet_zoom');
  if (z !== null) { zoomLevel = parseInt(z); applyZoom(); }
}

function loadFromStorage() {
  try {
    const lb = localStorage.getItem('aet_lorebook');
    if (lb) {
      lorebook = JSON.parse(lb);
      g('lorebookName').value = lorebook.name || '';
      lorebook.entries = rebuildEntries(lorebook.entries || {});
    }
    const tabs = localStorage.getItem('aet_tabs');
    if (tabs) openTabs = JSON.parse(tabs);
    const atab = localStorage.getItem('aet_activeTab');
    if (atab && atab !== 'null') activeTabId = parseInt(atab);
    const nu = localStorage.getItem('aet_nextUid');
    if (nu) nextUid = parseInt(nu);

    charLibrary = JSON.parse(localStorage.getItem('aet_charLibrary') || '{}');
    presetLibrary = JSON.parse(localStorage.getItem('aet_presetLibrary') || '{}');

    renderWsTabs();

    if (Object.keys(lorebook.entries).length > 0) {
      renderList(); renderTabs();
      if (activeTabId !== null) renderEditor();
    }
  } catch(e) { console.error(e); }
}

function saveToStorage() {
  try {
    localStorage.setItem('aet_lorebook', JSON.stringify(lorebook));
    localStorage.setItem('aet_tabs', JSON.stringify(openTabs));
    localStorage.setItem('aet_activeTab', activeTabId);
    localStorage.setItem('aet_nextUid', nextUid);
    syncAutoPush();
  } catch(e) { console.error(e); }
}

function saveCharLibrary() {
  try { localStorage.setItem('aet_charLibrary', JSON.stringify(charLibrary)); syncAutoPush(); }
  catch(e) { console.error(e); }
}

function savePresetLibrary() {
  try { localStorage.setItem('aet_presetLibrary', JSON.stringify(presetLibrary)); syncAutoPush(); }
  catch(e) { console.error(e); }
}

// ═══════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════
function wireEvents() {
  // Mode tab switching
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // Dropdowns — click toggle, click outside closes
  document.querySelectorAll('.dd').forEach(dd => {
    const btn = dd.querySelector('.dd-btn');
    const menu = dd.querySelector('.dd-menu');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) menu.classList.add('open');
    });
  });
  document.addEventListener('click', closeAllDropdowns);

  // Header buttons
  g('importBtn').onclick = () => g('fileInput').click();
  g('importMergeBtn').onclick = () => g('fileMergeInput').click();
  g('exportJsonBtn').onclick = exportJson;
  g('exportTxtBtn').onclick = () => openModal('expTxtModal');
  g('exportPubBtn').onclick = openPublicExport;
  g('searchBtn2').onclick = () => openModal('srModal');
  g('libraryBtn').onclick = openLibrary;
  g('clearBtn').onclick = clearEditor;
  g('newEntryBtn').onclick = openEntryPicker;
  g('charNewBtn').onclick = createChar;
  g('presetNewBtn').onclick = createPreset;
  g('charLibraryBtn').onclick = openCharLibrary;
  g('charTemplatesBtn').onclick = () => openTemplateLibrary('char');
  g('loreTemplatesBtn').onclick = () => openTemplateLibrary('lore');
  g('attachLbBtn').onclick = openAttachLbModal;
  g('pronounToolBtn').onclick = () => {
    const tool = g('pronounTool');
    tool.classList.toggle('open');
    PT.open = tool.classList.contains('open');
    if (PT.open && PT.targetField) ptRefreshManual();
  };
  g('presetLibraryBtn').onclick = openPresetLibrary;
  g('presetTemplatesBtn').onclick = () => openTemplateLibrary('preset');
  g('psAddPromptHdr').onclick = () => {
    if (!activePresetId || !presetLibrary[activePresetId]) { toast('Open a preset first.', 'warn'); return; }
    const entry2 = presetLibrary[activePresetId];
    if (!entry2.preset.prompts) entry2.preset.prompts = [];
    entry2.preset.prompts.unshift(makeBlankPrompt()); // add to TOP
    syncPromptOrder(entry2.preset);
    renderPromptList(entry2.preset.prompts);
    g('editorContent').scrollTop = 0;
  };
  g('charImportJsonBtn').onclick = () => { g('fileCharInput').accept = '.json'; g('fileCharInput').click(); };
  g('filePresetInput').onchange = handlePresetImport;
  g('charImportPngBtn').onclick = () => { g('fileCharInput').accept = '.png'; g('fileCharInput').click(); };
  g('fileCharInput').onchange = handleCharImport;
  if (g('charImportCharxBtn')) g('charImportCharxBtn').onclick = () => { if(g('fileCharxInput')) g('fileCharxInput').click(); };
  if (g('charImportSaucepanBtn')) g('charImportSaucepanBtn').onclick = () => { if(g('fileCharCompanionInput')) g('fileCharCompanionInput').click(); };
  if (g('fileCharCompanionInput')) g('fileCharCompanionInput').onchange = handleCharCompanionImport;
  if (g('fileCharxInput')) g('fileCharxInput').onchange = handleCharxImport;
  g('presetImportBtn').onclick = () => { g('filePresetInput').click(); };
  // Header export buttons (char)
  if (g('charHdrExportJsonBtn')) g('charHdrExportJsonBtn').onclick = () => exportCharJson(activeCharId);
  if (g('charHdrExportPngBtn')) g('charHdrExportPngBtn').onclick = () => openCharPngExport(activeCharId);
  if (g('charHdrExportSaucepanBtn')) g('charHdrExportSaucepanBtn').onclick = () => exportCharSaucepan(activeCharId);
  if (g('charHdrExportCharxBtn')) g('charHdrExportCharxBtn').onclick = () => exportCharCharx(activeCharId);
  // Header export button (preset)
  if (g('presetHdrExportBtn')) g('presetHdrExportBtn').onclick = () => exportPreset();
  g('newEntryBtnAlt').onclick = openEntryPicker;
  g('helpBtn').onclick = () => openModal('helpModal');

  // ── v1.0.0 new buttons ──
  // JanitorAI import/export (lorebook)
  if (g('importJanitorPasteBtn')) g('importJanitorPasteBtn').onclick = openJanitorPasteModal;
  if (g('janitorPasteConfirmBtn')) g('janitorPasteConfirmBtn').onclick = handleJanitorPaste;
  if (g('exportJanitorBtn')) g('exportJanitorBtn').onclick = exportJanitorJson;
  // SaucepanAI import/export
  if (g('importSaucepanBtn')) g('importSaucepanBtn').onclick = () => g('fileSaucepanInput').click();
  if (g('fileSaucepanInput')) g('fileSaucepanInput').onchange = handleSaucepanImport;
  if (g('exportSaucepanBtn')) g('exportSaucepanBtn').onclick = exportSaucepanJson;
  // Mobile janitor
  if (g('mobImportJanitorBtn')) g('mobImportJanitorBtn').onclick = () => { closeModal('mobImportModal'); g('fileJanitorInput').click(); };
  if (g('mobExportJanitorBtn')) g('mobExportJanitorBtn').onclick = () => { closeModal('mobExportModal'); exportJanitorJson(); };

  // Lorebook global settings modal
  if (g('loreSettingsBtn')) g('loreSettingsBtn').onclick = openLoreSettings;
  if (g('lsApplyBtn')) g('lsApplyBtn').onclick = applyLoreSettings;

  // Stub mode tabs — mark as stub
  ['persona','prompt','regex'].forEach(m => {
    document.querySelectorAll(`.mode-tab[data-mode="${m}"]`).forEach(t => t.classList.add('stub'));
  });
  g('fileInput').onchange = handleImport;
  g('fileMergeInput').onchange = handleMergeImport;
  g('lorebookName').oninput = e => { lorebook.name = e.target.value.trim(); };
  g('sbSearch').oninput = handleSbSearch;
  g('zoomOut').onclick = () => changeZoom(-1);
  g('zoomIn').onclick = () => changeZoom(1);
  g('viewToggle').onclick = toggleView;
  g('clearSel').onclick = clearSelection;

  // Modal close — event delegation catches all modals including dynamically added ones
  document.addEventListener('click', e => {
    const closeTarget = e.target.closest('[data-close]');
    if (closeTarget) { closeModal(closeTarget.dataset.close); return; }
    // Click outside modal box to close (fullscreenModal is exempt — explicit X/Cancel/Apply only)
    if (e.target.classList.contains('modal') && e.target.id && e.target.id !== 'fullscreenModal') closeModal(e.target.id);
  });

  // Search & Replace
  g('srFindAll').onclick = doSearch;
  g('srReplaceOne').onclick = doReplaceOne;
  g('srReplaceAll').onclick = doReplaceAll;
  g('srFind').onkeypress = e => { if (e.key === 'Enter') { e.shiftKey ? doReplaceOne() : doSearch(); } };
  g('srReplace').onkeypress = e => { if (e.key === 'Enter' && e.ctrlKey) doReplaceAll(); };

  // Merge
  g('mergeSelAll').onclick = () => { mergeSelected = Object.values(mergeStaging.entries).map(e => e.uid); renderMergeList(); };
  g('mergeDeselAll').onclick = () => { mergeSelected = []; renderMergeList(); };
  g('mergeConfirm').onclick = executeMerge;

  // Export text
  g('etExport').onclick = doExportTxt;

  // Export public
  g('epPreviewBtn').onclick = previewPublic;
  g('epExport').onclick = doExportPublic;

  // Library
  g('libSaveBtn').onclick = libSaveCurrent;

  // Workshop tab bar
  g('workshopTabAdd')?.addEventListener('click', openWsPicker);

  // Workshop picker type tabs
  document.querySelectorAll('.ws-picker-type').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ws-picker-type').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderWsPickerList(btn.dataset.type);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
    const inSr = g('srModal').classList.contains('open');
    if (inInput && !inSr) return;
    if (!e.ctrlKey) {
      if (e.key === 'F1' || (e.shiftKey && e.key === '?')) { e.preventDefault(); openModal('srModal'); }
      return;
    }
    switch(e.key.toLowerCase()) {
      case 'n': e.preventDefault(); createEntry(); break;
      case 's': e.preventDefault(); if (activeTabId !== null) saveEntry(activeTabId); break;
      case 'i': e.preventDefault(); g('fileInput').click(); break;
      case 'e': e.preventDefault(); exportJson(); break;
      case 'm': e.preventDefault(); g('fileMergeInput').click(); break;
      case 'h': e.preventDefault(); openModal('srModal'); break;
      case 'w': e.preventDefault(); if (activeTabId !== null) closeTab(activeTabId); break;
      case 'd': e.preventDefault(); toggleTheme(); break;
      case 'tab':
        e.preventDefault();
        if (openTabs.length > 0) {
          const i = openTabs.indexOf(activeTabId);
          activeTabId = e.shiftKey ? openTabs[(i - 1 + openTabs.length) % openTabs.length] : openTabs[(i + 1) % openTabs.length];
          renderTabs(); renderEditor();
        }
        break;
      case '-': e.preventDefault(); changeZoom(-1); break;
      case '=': case '+': e.preventDefault(); changeZoom(1); break;
    }
  });
}

function g(id) { return document.getElementById(id); }

function closeAllDropdowns() {
  document.querySelectorAll('.dd-menu.open').forEach(m => m.classList.remove('open'));
}

function openModal(id) { g(id).classList.add('open'); }
function closeModal(id) { g(id).classList.remove('open'); }

// ═══════════════════════════════════════════════════════
// FIELD-LEVEL UNDO/REDO
// Attaches native undo/redo button pair to any textarea.
// Per-field history stack, debounced push on input.
// ═══════════════════════════════════════════════════════

const FIELD_HIST_MAX = 80;
const FIELD_HIST_DEBOUNCE = 400; // ms

function attachFieldUndoRedo(ta) {
  if (!ta || ta._undoAttached) return;
  ta._undoAttached = true;

  const stack = [ta.value];
  let ptr = 0;
  let debounceTimer = null;

  ta.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      stack.splice(ptr + 1);
      stack.push(ta.value);
      if (stack.length > FIELD_HIST_MAX) stack.shift();
      ptr = stack.length - 1;
      syncBtns();
    }, FIELD_HIST_DEBOUNCE);
  });

  function applyState(val) {
    ta.value = val;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function undo() {
    clearTimeout(debounceTimer);
    if (ptr > 0) { ptr--; applyState(stack[ptr]); syncBtns(); }
  }

  function redo() {
    clearTimeout(debounceTimer);
    if (ptr < stack.length - 1) { ptr++; applyState(stack[ptr]); syncBtns(); }
  }

  function syncBtns() {
    if (undoBtn) undoBtn.disabled = ptr <= 0;
    if (redoBtn) redoBtn.disabled = ptr >= stack.length - 1;
  }

  // Keyboard shortcut when this textarea is focused
  ta.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (e.ctrlKey && e.key.toLowerCase() === 'y')) { e.preventDefault(); redo(); }
  });

  // Inject button row AFTER the content-wrap (or after the textarea itself)
  // so it never overlaps tok-count / expand-btn which are inside content-wrap
  const wrap = ta.closest('.content-wrap') || ta;
  const insertAfter = wrap.closest('.content-wrap') || wrap;

  const pair = document.createElement('div');
  pair.className = 'field-ur-pair';
  pair.innerHTML =
    `<span class="field-ur-label">field:</span>` +
    `<button class="field-ur-btn" title="Undo" tabindex="-1">↩</button>` +
    `<button class="field-ur-btn" title="Redo" tabindex="-1">↪</button>`;
  const undoBtn = pair.children[1];
  const redoBtn = pair.children[2];
  undoBtn.addEventListener('mousedown', e => { e.preventDefault(); undo(); });
  redoBtn.addEventListener('mousedown', e => { e.preventDefault(); redo(); });
  // Touch support for mobile
  undoBtn.addEventListener('touchend', e => { e.preventDefault(); undo(); });
  redoBtn.addEventListener('touchend', e => { e.preventDefault(); redo(); });

  insertAfter.insertAdjacentElement('afterend', pair);
  syncBtns();
}

// Call this after any editor renders to wire all textareas in a container
function wireFieldUndoRedo(container) {
  (container || document).querySelectorAll('textarea.ftextarea').forEach(ta => {
    attachFieldUndoRedo(ta);
  });
}

// ═══════════════════════════════════════════════════════
// ITEM-LEVEL UNDO/REDO (in-session, per open item)
// Separate from version history — lightweight session stack.
// ═══════════════════════════════════════════════════════

// itemUndoStacks: { key: { stack: [...snapshots], ptr } }
// key = 'lore:{uid}' | 'char:{id}' | 'preset:{id}'
const itemUndoStacks = {};
const ITEM_UNDO_MAX = 30;

function itemUndoKey(type, id) { return `${type}:${id}`; }

function itemUndoPush(type, id, snapshot) {
  const key = itemUndoKey(type, id);
  if (!itemUndoStacks[key]) itemUndoStacks[key] = { stack: [], ptr: -1 };
  const s = itemUndoStacks[key];
  // Truncate forward history
  s.stack.splice(s.ptr + 1);
  s.stack.push(JSON.stringify(snapshot));
  if (s.stack.length > ITEM_UNDO_MAX) s.stack.shift();
  s.ptr = s.stack.length - 1;
}

function itemUndoCanUndo(type, id) {
  const s = itemUndoStacks[itemUndoKey(type, id)];
  return s && s.ptr > 0;
}

function itemUndoCanRedo(type, id) {
  const s = itemUndoStacks[itemUndoKey(type, id)];
  return s && s.ptr < s.stack.length - 1;
}

function itemUndoGet(type, id, direction) {
  const key = itemUndoKey(type, id);
  const s = itemUndoStacks[key];
  if (!s) return null;
  if (direction === 'undo' && s.ptr > 0) s.ptr--;
  else if (direction === 'redo' && s.ptr < s.stack.length - 1) s.ptr++;
  else return null;
  return JSON.parse(s.stack[s.ptr]);
}

function syncItemUndoButtons(type, id) {
  const undoBtn = g('itemUndoBtn');
  const redoBtn = g('itemRedoBtn');
  if (undoBtn) undoBtn.disabled = !itemUndoCanUndo(type, id);
  if (redoBtn) redoBtn.disabled = !itemUndoCanRedo(type, id);
}


// ═══════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════
function toggleTheme() {
  document.body.classList.toggle('pink');
  localStorage.setItem('aet_theme', document.body.classList.contains('pink') ? 'pink' : 'dark');
  applyCustomTheme(); // re-apply custom overrides for the new mode
}

// ═══════════════════════════════════════════════════════
// WORKSHOP TABS
// ═══════════════════════════════════════════════════════

function wsTabId() { return wsNextId++; }

function wsOpenItem(type, itemId) {
  // If already open, just focus it
  const existing = wsItems.find(t => t.type === type && t.itemId === itemId);
  if (existing) { wsActivate(existing.id); return; }

  if (wsItems.length >= WS_MAX_TABS) {
    toast(`Max ${WS_MAX_TABS} tabs open — close one first.`, 'warn');
    return;
  }

  const tab = { id: wsTabId(), type, itemId, unsaved: false };
  wsItems.push(tab);
  wsActivate(tab.id);
  closeModal('wsPickerModal');
}

function wsActivate(tabId) {
  wsActiveId = tabId;
  const tab = wsItems.find(t => t.id === tabId);
  if (!tab) return;
  renderWsTabs();
  // Switch editor mode and load the item
  if (tab.type === 'lore') {
    if (typeof switchMode === 'function') switchMode('lore');
    // lorebooks keyed by name
    if (typeof libLoad === 'function') libLoad(tab.itemId);
  } else if (tab.type === 'char') {
    if (typeof switchMode === 'function') switchMode('char');
    if (typeof openChar === 'function') openChar(tab.itemId);
  } else if (tab.type === 'preset') {
    if (typeof switchMode === 'function') switchMode('preset');
    if (typeof openPreset === 'function') openPreset(tab.itemId);
  }
}

function wsCloseTab(tabId) {
  const tab = wsItems.find(t => t.id === tabId);
  if (!tab) return;

  // Autosave before closing
  if (tab.type === 'lore') {
    const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
    if (lib[tab.itemId]) itemHistoryPush('lore', tab.itemId, lib[tab.itemId]);
  } else if (tab.type === 'char') {
    if (charLibrary[tab.itemId]) itemHistoryPush('char', tab.itemId, JSON.parse(JSON.stringify(charLibrary[tab.itemId])));
  } else if (tab.type === 'preset') {
    if (presetLibrary[tab.itemId]) itemHistoryPush('preset', tab.itemId, JSON.parse(JSON.stringify(presetLibrary[tab.itemId])));
  }

  wsItems = wsItems.filter(t => t.id !== tabId);

  // Focus adjacent tab if we closed the active one
  if (wsActiveId === tabId) {
    wsActiveId = wsItems.length ? wsItems[wsItems.length - 1].id : null;
    if (wsActiveId) wsActivate(wsActiveId);
    else renderWsTabs();
  } else {
    renderWsTabs();
  }
}

function wsMarkUnsaved(type, itemId) {
  const tab = wsItems.find(t => t.type === type && t.itemId === itemId);
  if (tab) { tab.unsaved = true; renderWsTabs(); }
}

function wsMarkSaved(type, itemId) {
  const tab = wsItems.find(t => t.type === type && t.itemId === itemId);
  if (tab) { tab.unsaved = false; renderWsTabs(); }
}

function renderWsTabs() {
  const bar = g('workshopTabs');
  if (!bar) return;
  bar.innerHTML = '';

  const TYPE_LABEL = { lore: 'LB', char: 'CH', preset: 'PS' };

  wsItems.forEach(tab => {
    let name = '...';
    if (tab.type === 'lore') {
      const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
      name = lib[tab.itemId]?.name || 'Untitled';
    } else if (tab.type === 'char') {
      name = charLibrary[tab.itemId]?.name || 'Untitled';
    } else if (tab.type === 'preset') {
      name = presetLibrary[tab.itemId]?.name || 'Untitled';
    }

    const el = document.createElement('div');
    el.className = 'ws-tab' + (tab.id === wsActiveId ? ' active' : '') + (tab.unsaved ? ' unsaved' : '');
    el.innerHTML = `
      <span class="ws-tab-type">${TYPE_LABEL[tab.type] || ''}</span>
      <span class="ws-tab-label" title="${name}">${name}</span>
      <span class="ws-tab-unsaved"></span>
      <span class="ws-tab-x" data-close-tab="${tab.id}">×</span>`;
    el.addEventListener('click', e => {
      if (e.target.dataset.closeTab) { wsCloseTab(parseInt(e.target.dataset.closeTab)); return; }
      wsActivate(tab.id);
    });
    bar.appendChild(el);
  });

  // Show/hide the add button based on limit
  const addBtn = g('workshopTabAdd');
  if (addBtn) addBtn.style.opacity = wsItems.length >= WS_MAX_TABS ? '.35' : '1';
}

function openWsPicker() {
  if (wsItems.length >= WS_MAX_TABS) { toast(`Max ${WS_MAX_TABS} tabs open.`, 'warn'); return; }
  // Reset to lorebook tab
  document.querySelectorAll('.ws-picker-type').forEach(b => b.classList.toggle('active', b.dataset.type === 'lore'));
  renderWsPickerList('lore');
  openModal('wsPickerModal');
}

function renderWsPickerList(type) {
  const list = g('wsPickerList');
  if (!list) return;
  list.innerHTML = '';

  let items = [];
  if (type === 'lore') {
    const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
    // Lorebook lib: { [name]: { name, lb, savedAt } } — add name as id for consistency
    items = Object.values(lib).map(b => ({ id: b.name, name: b.name, savedAt: b.savedAt }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } else if (type === 'char') {
    items = Object.values(charLibrary).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } else if (type === 'preset') {
    items = Object.values(presetLibrary).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  if (!items.length) {
    list.innerHTML = `<div class="lib-empty">// no ${type === 'lore' ? 'lorebooks' : type === 'char' ? 'characters' : 'presets'} saved yet</div>`;
    return;
  }

  const alreadyOpen = new Set(wsItems.filter(t => t.type === type).map(t => t.itemId));

  items.forEach(entry => {
    const date = new Date(entry.savedAt).toLocaleDateString();
    const isOpen = alreadyOpen.has(entry.id);
    const item = document.createElement('div');
    item.className = 'lib-item' + (isOpen ? ' active' : '');
    item.innerHTML = `
      <span class="lib-name">${entry.name || 'Unnamed'}</span>
      <span class="lib-meta">${isOpen ? 'open' : date}</span>
      <div class="lib-acts">
        <button class="btn btn-s btn-sm" ${isOpen ? 'disabled' : ''}>${isOpen ? 'Open' : 'Open'}</button>
      </div>`;
    if (!isOpen) {
      item.querySelector('button').addEventListener('click', () => wsOpenItem(type, entry.id));
      item.querySelector('.lib-name').addEventListener('click', () => wsOpenItem(type, entry.id));
    }
    list.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════
// VERSION HISTORY (per-item, stored inside library entries)
// ═══════════════════════════════════════════════════════

const ITEM_HIST_MAX = 10;

// Push an autosave snapshot into an item's history.
// For lorebooks, pass the raw entry object (has a .lb field).
// For char/preset, pass the library entry directly.
function itemHistoryPush(type, itemId, entryOrData, label = null) {
  // Determine what to compress: lorebooks store the lorebook under .lb
  const payload = (type === 'lore' && entryOrData?.lb) ? entryOrData.lb : entryOrData;
  const snapshot = {
    ts: new Date().toISOString(),
    label: label || null,
    data: LZString.compress(JSON.stringify(payload)),
  };

  if (type === 'lore') {
    const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
    if (!lib[itemId]) return;
    if (!lib[itemId].history) lib[itemId].history = [];
    lib[itemId].history.unshift(snapshot);
    if (lib[itemId].history.length > ITEM_HIST_MAX) lib[itemId].history.splice(ITEM_HIST_MAX);
    localStorage.setItem('aet_library', JSON.stringify(lib));
  } else if (type === 'char') {
    if (!charLibrary[itemId]) return;
    if (!charLibrary[itemId].history) charLibrary[itemId].history = [];
    charLibrary[itemId].history.unshift(snapshot);
    if (charLibrary[itemId].history.length > ITEM_HIST_MAX) charLibrary[itemId].history.splice(ITEM_HIST_MAX);
    saveCharLibrary();
  } else if (type === 'preset') {
    if (!presetLibrary[itemId]) return;
    if (!presetLibrary[itemId].history) presetLibrary[itemId].history = [];
    presetLibrary[itemId].history.unshift(snapshot);
    if (presetLibrary[itemId].history.length > ITEM_HIST_MAX) presetLibrary[itemId].history.splice(ITEM_HIST_MAX);
    savePresetLibrary();
  }
}

// Save a named checkpoint
function itemHistorySaveCheckpoint(type, itemId, label) {
  if (!label || !label.trim()) { toast('Enter a checkpoint name.', 'warn'); return; }
  if (type === 'lore') {
    const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
    if (lib[itemId]) itemHistoryPush(type, itemId, lib[itemId], label.trim());
  } else if (type === 'char') {
    itemHistoryPush(type, itemId, charLibrary[itemId], label.trim());
  } else if (type === 'preset') {
    itemHistoryPush(type, itemId, presetLibrary[itemId], label.trim());
  }
  toast('Checkpoint saved.', 'ok');
}

// Open the version history modal for an item
function openItemHistory(type, itemId) {
  let entry, history;
  if (type === 'lore') {
    const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
    entry = lib[itemId];
  } else if (type === 'char') {
    entry = charLibrary[itemId];
  } else if (type === 'preset') {
    entry = presetLibrary[itemId];
  }

  if (!entry) { toast('Item not found.', 'err'); return; }
  history = entry.history || [];

  // Build and show modal dynamically
  let existing = g('itemHistoryModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'itemHistoryModal';
  modal.className = 'modal open';
  modal.innerHTML = `
    <div class="modal-box lg">
      <div class="modal-head">
        <h2>Version History — ${entry.name || 'Untitled'}</h2>
        <button class="modal-x" data-close="itemHistoryModal">×</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap">
          <input type="text" id="histCheckpointLabel" class="finput" style="flex:1;min-width:140px" placeholder="Checkpoint name...">
          <button class="btn btn-s btn-sm" id="histSaveCheckpointBtn">Save Checkpoint</button>
        </div>
        <div style="font-family:var(--fx);font-size:.65rem;color:var(--txm);margin-bottom:.55rem;letter-spacing:.3px">
          Up to ${ITEM_HIST_MAX} snapshots — autosaved on close and export. Restore replaces current data.
        </div>
        <div id="histList" class="lib-list" style="max-height:340px">
          ${!history.length ? '<div class="lib-empty">// no snapshots yet — close a tab or export to create one</div>' : ''}
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#histSaveCheckpointBtn').addEventListener('click', () => {
    const label = modal.querySelector('#histCheckpointLabel').value;
    itemHistorySaveCheckpoint(type, itemId, label);
    modal.querySelector('#histCheckpointLabel').value = '';
    openItemHistory(type, itemId); // refresh
  });

  modal.addEventListener('click', e => {
    const closeTarget = e.target.closest('[data-close]');
    if (closeTarget) { modal.remove(); return; }
    if (e.target === modal) modal.remove();
  });

  const listEl = modal.querySelector('#histList');

  history.forEach((snap, i) => {
    const ts = new Date(snap.ts).toLocaleString();
    const isCheckpoint = !!snap.label;
    const item = document.createElement('div');
    item.className = 'hist-item' + (isCheckpoint ? ' checkpoint' : '');
    item.innerHTML = `
      <span class="hist-ts">${ts} ${i === 0 ? '<span style="color:var(--ok);font-size:.6rem">● latest</span>' : ''}</span>
      ${isCheckpoint ? `<span class="hist-label">${snap.label}</span>` : '<span class="hist-auto">auto</span>'}
      <div class="hist-acts">
        <button class="btn btn-s btn-sm hist-restore">Restore</button>
        <button class="btn btn-s btn-sm hist-export">Export</button>
      </div>`;

    item.querySelector('.hist-restore').addEventListener('click', () => {
      try {
        const data = JSON.parse(LZString.decompress(snap.data));
        if (type === 'lore') {
          const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
          if (lib[itemId]) { lib[itemId].lb = data; localStorage.setItem('aet_library', JSON.stringify(lib)); }
        } else if (type === 'char') {
          if (charLibrary[itemId]) { Object.assign(charLibrary[itemId], data); saveCharLibrary(); }
        } else if (type === 'preset') {
          if (presetLibrary[itemId]) { Object.assign(presetLibrary[itemId], data); savePresetLibrary(); }
        }
        modal.remove();
        toast('Restored to ' + ts + ' — reload to apply.', 'ok');
      } catch(e) { toast('Snapshot corrupted.', 'err'); }
    });

    item.querySelector('.hist-export').addEventListener('click', () => {
      try {
        const data = JSON.parse(LZString.decompress(snap.data));
        const json = JSON.stringify(data, null, 2);
        const name = (entry.name || 'item').replace(/\s+/g,'-').toLowerCase();
        const date = snap.ts.slice(0,10);
        dlFile(json, `${name}-snapshot-${date}.json`, 'application/json');
      } catch(e) { toast('Snapshot corrupted.', 'err'); }
    });

    listEl.appendChild(item);
  });
}


