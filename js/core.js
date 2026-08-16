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
// THEME
// ═══════════════════════════════════════════════════════
function toggleTheme() {
  document.body.classList.toggle('pink');
  localStorage.setItem('aet_theme', document.body.classList.contains('pink') ? 'pink' : 'dark');
  applyCustomTheme(); // re-apply custom overrides for the new mode
}


