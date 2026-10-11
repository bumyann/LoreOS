// ═══════════════════════════════════════════════════════
// MAIN — start-up. Wires the page together in a fixed order and handles global events.
// ═══════════════════════════════════════════════════════

import { openAttachLbModal } from './attach_lb.js';
import { createChar, openCharLibrary, saveChar } from './character.js';
import { exportCharCharx, exportCharJson, exportCharJsonV2, exportCharSaucepan, handleCharCompanionImport, handleCharImport, handleCharxImport, openCharPngExport } from './character_io.js';
import { wireFullscreen } from './fullscreen.js';
import { libSaveCurrent, openLibrary } from './library.js';
import { applyLoreSettings, changeZoom, clearEditor, clearSelection, closeTab, createEntry, handleSbSearch, openLoreSettings, renderEditor, renderTabs, saveEntry, toggleView } from './lorebook.js';
import { doExportPublic, doExportTxt, executeMerge, exportJanitorJson, exportJson, exportSaucepanJson, handleImport, handleJanitorImport, handleJanitorPaste, handleMergeImport, handleSaucepanImport, openJanitorPasteModal, openPublicExport, previewPublic, renderMergeList } from './lorebook_io.js';
import { wireMobile } from './mobile.js';
import { createPreset, exportPreset, handlePresetImport, makeBlankPrompt, openPresetLibrary, renderPromptList, savePreset, syncPromptOrder } from './preset.js';
import { PT, ptRefreshManual, wirePronounTool } from './pronoun.js';
import { setupOffline } from './pwa.js';
import { initRouter } from './router.js';
import { doReplaceAll, doReplaceOne, doSearch } from './search.js';
import { applyAllCustomisations, applyFonts, toggleTheme, wireFonts, wireSettings } from './settings.js';
import { state } from './state.js';
import { loadFromStorage, loadPrefs, sanitizeStorage } from './storage.js';
import { openEntryPicker, openTemplateLibrary, wireTplLibrary } from './templates.js';
import { closeAllDropdowns, closeModal, g, injectMarkup, openModal, toast } from './util.js';
import { openWsPicker, renderWsPickerList, switchMode, wireAutosave, wsRestoreTabs } from './workshop.js';
import * as m_util from './util.js';
import * as m_storage from './storage.js';
import * as m_history from './history.js';
import * as m_pronoun from './pronoun.js';
import * as m_lorebook_model from './lorebook_model.js';
import * as m_lorebook from './lorebook.js';
import * as m_lorebook_io from './lorebook_io.js';
import * as m_library from './library.js';
import * as m_search from './search.js';
import * as m_workshop from './workshop.js';
import * as m_character from './character.js';
import * as m_preset from './preset.js';
import * as m_templates from './templates.js';
import * as m_attach_lb from './attach_lb.js';
import * as m_fullscreen from './fullscreen.js';
import * as m_settings from './settings.js';
import * as m_sync from './sync.js';
import * as m_gdrive from './gdrive.js';
import * as m_mobile from './mobile.js';
import * as m_router from './router.js';
import * as m_pwa from './pwa.js';
import * as m_character_io from './character_io.js';
import * as m_avatar from './avatar.js';
import * as m_templates_data from './templates_data.js';
import './help.js'; // registers the help dialog's markup

// ═══════════════════════════════════════════════════════
// GLOBAL ERROR CATCHER
// Nothing in LoreOS used to surface a thrown error, which is how
// a hard crash on page load went unnoticed. Now anything uncaught
// shows up as a red toast.
// ═══════════════════════════════════════════════════════
(function wireErrorReporting() {
  let lastMsg = '', lastAt = 0;
  function report(what, err) {
    const msg = (err && err.message) ? err.message : String(err);
    const now = Date.now();
    if (msg === lastMsg && now - lastAt < 3000) return; // don't spam on loops
    lastMsg = msg; lastAt = now;
    console.error('[LoreOS]', what, err);
    toast('Something broke: ' + msg, 'err');
  }
  window.addEventListener('error', e => report('uncaught error:', e.error || e.message));
  window.addEventListener('unhandledrejection', e => report('unhandled promise:', e.reason));
})();

// ═══════════════════════════════════════════════════════
// INIT
// Each step is isolated: one module failing to start must not
// stop the rest of the app from starting.
// ═══════════════════════════════════════════════════════
export function initStep(name, fn) {
  try { fn(); }
  catch(e) {
    console.error(`[LoreOS] init step "${name}" failed:`, e);
    setTimeout(() => {
      toast(`Startup problem in ${name} — see console.`, 'warn');
    }, 400);
  }
}

// The order of these steps matters: events are wired before saved data is loaded,
// and the router runs after the editors exist. initStep isolates each one so a
// failure in one module can't stop the rest of the app from starting.
function startApp() {
  initStep('markup',       injectMarkup); // dialogs etc. owned by the modules, before anything looks for them
  initStep('storage check', sanitizeStorage);
  initStep('prefs',        loadPrefs);
  initStep('events',       wireEvents);
  initStep('autosave',     wireAutosave);
  initStep('mobile',       wireMobile);
  initStep('storage',      loadFromStorage);
  initStep('mode',         () => switchMode('lore'));
  initStep('router',       initRouter);
  initStep('workshop tabs', wsRestoreTabs);
  initStep('pronoun tool', wirePronounTool);
  initStep('fullscreen',   wireFullscreen);
  initStep('templates',    wireTplLibrary);
  initStep('settings',     wireSettings);
  initStep('fonts',        wireFonts);
  initStep('theme',        applyAllCustomisations);
  initStep('font apply',   applyFonts);
  initStep('offline',      setupOffline);
}

// Module scripts run after the page is parsed, so this is usually already true
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();

// ═══════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════
export function wireEvents() {
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
    if (!state.activePresetId || !state.presetLibrary[state.activePresetId]) { toast('Open a preset first.', 'warn'); return; }
    const entry2 = state.presetLibrary[state.activePresetId];
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
  if (g('charHdrExportJsonBtn')) g('charHdrExportJsonBtn').onclick = () => exportCharJson(state.activeCharId);
  if (g('charHdrExportV2JsonBtn')) g('charHdrExportV2JsonBtn').onclick = () => exportCharJsonV2(state.activeCharId);
  if (g('charHdrExportV3PngBtn')) g('charHdrExportV3PngBtn').onclick = () => openCharPngExport(state.activeCharId, false);
  if (g('charHdrExportPngBtn')) g('charHdrExportPngBtn').onclick = () => openCharPngExport(state.activeCharId, true);
  if (g('charHdrExportSaucepanBtn')) g('charHdrExportSaucepanBtn').onclick = () => exportCharSaucepan(state.activeCharId);
  if (g('charHdrExportCharxBtn')) g('charHdrExportCharxBtn').onclick = () => exportCharCharx(state.activeCharId);
  // Header export button (preset)
  if (g('presetHdrExportBtn')) g('presetHdrExportBtn').onclick = () => exportPreset();
  g('newEntryBtnAlt').onclick = openEntryPicker;
  g('helpBtn').onclick = () => openModal('helpModal');
  g('mob-topbar-help').onclick = () => openModal('helpModal');
  g('navThemeBtn').onclick = toggleTheme;

  // ── v1.0.0 new buttons ──
  // JanitorAI import/export (lorebook)
  if (g('importJanitorPasteBtn')) g('importJanitorPasteBtn').onclick = openJanitorPasteModal;
  if (g('janitorPasteConfirmBtn')) g('janitorPasteConfirmBtn').onclick = handleJanitorPaste;
  if (g('janitorPickFileBtn')) g('janitorPickFileBtn').onclick = () => g('fileJanitorInput').click();
  if (g('fileJanitorInput')) g('fileJanitorInput').onchange = e => { closeModal('janitorPasteModal'); handleJanitorImport(e); };
  if (g('exportJanitorBtn')) g('exportJanitorBtn').onclick = exportJanitorJson;
  // SaucepanAI import/export
  if (g('importSaucepanBtn')) g('importSaucepanBtn').onclick = () => g('fileSaucepanInput').click();
  if (g('fileSaucepanInput')) g('fileSaucepanInput').onchange = handleSaucepanImport;
  if (g('exportSaucepanBtn')) g('exportSaucepanBtn').onclick = exportSaucepanJson;
  // Mobile janitor
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
  g('lorebookName').oninput = e => { state.lorebook.name = e.target.value.trim(); };
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
  g('mergeSelAll').onclick = () => { if (!state.mergeStaging) return; state.mergeSelected = Object.values(state.mergeStaging.entries).map(e => e.uid); renderMergeList(); };
  g('mergeDeselAll').onclick = () => { state.mergeSelected = []; renderMergeList(); };
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

  // Keyboard shortcuts. They act on whatever editor is on screen: before, Ctrl+N
  // in the Character editor silently created a (hidden) lorebook entry.
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
    const inSr = g('srModal').classList.contains('open');

    // Escape closes the top-most dialog (the fullscreen field editor is exempt:
    // it only closes from Apply / Cancel / X so a stray Escape can't drop edits)
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal.open')].filter(m => m.id !== 'fullscreenModal');
      if (open.length) {
        const top = open.sort((a, b) => (parseInt(getComputedStyle(a).zIndex) || 0) - (parseInt(getComputedStyle(b).zIndex) || 0)).pop();
        // Prompts resolve a promise: go through their Cancel button
        const cancel = top.id === 'confirmModal' ? g('confirmCancelBtn') : top.id === 'renameModal' ? g('renameCancelBtn') : null;
        if (cancel) cancel.click();
        else if (top.id === 'itemHistoryModal') top.remove();
        else closeModal(top.id);
        e.preventDefault();
      }
      return;
    }

    if (inInput && !inSr) return;
    if (!e.ctrlKey) {
      if (e.key === 'F1' || (e.shiftKey && e.key === '?')) { e.preventDefault(); openModal('helpModal'); }
      return;
    }
    const m = state.mode;
    switch(e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        if (m === 'lore') createEntry(); else if (m === 'char') createChar(); else if (m === 'preset') createPreset();
        break;
      case 's':
        e.preventDefault();
        if (m === 'lore') { if (state.activeTabId !== null) saveEntry(state.activeTabId); }
        else if (m === 'char') saveChar();
        else if (m === 'preset') savePreset();
        break;
      case 'i':
        e.preventDefault();
        if (m === 'lore') g('fileInput').click();
        else if (m === 'char') { g('fileCharInput').accept = '.json,.png'; g('fileCharInput').click(); }
        else if (m === 'preset') g('filePresetInput').click();
        break;
      case 'e':
        e.preventDefault();
        if (m === 'lore') exportJson();
        else if (m === 'char') { if (state.activeCharId) exportCharJson(state.activeCharId); }
        else if (m === 'preset') exportPreset();
        break;
      case 'm': if (m === 'lore') { e.preventDefault(); g('fileMergeInput').click(); } break;
      case 'h': if (m === 'lore') { e.preventDefault(); openModal('srModal'); } break;
      case 'w': if (m === 'lore') { e.preventDefault(); if (state.activeTabId !== null) closeTab(state.activeTabId); } break;
      case 'd': e.preventDefault(); toggleTheme(); break;
      case 'tab':
        if (m !== 'lore') break;
        e.preventDefault();
        if (state.openTabs.length > 0) {
          const i = state.openTabs.indexOf(state.activeTabId);
          state.activeTabId = e.shiftKey ? state.openTabs[(i - 1 + state.openTabs.length) % state.openTabs.length] : state.openTabs[(i + 1) % state.openTabs.length];
          renderTabs(); renderEditor();
        }
        break;
      case '-': if (m === 'lore') { e.preventDefault(); changeZoom(-1); } break;
      case '=': case '+': if (m === 'lore') { e.preventDefault(); changeZoom(1); } break;
    }
  });
}

// ═══════════════════════════════════════════════════════
// CONSOLE ACCESS
// Everything is reachable from the browser console as LoreOS.<name> — handy for
// debugging, and what the automated tests use. State variables read and write
// through to the shared state object.
// ═══════════════════════════════════════════════════════
const LoreOS = {};
[m_util, m_storage, m_history, m_pronoun, m_lorebook_model, m_lorebook, m_lorebook_io, m_library, m_search, m_workshop, m_character, m_preset, m_templates, m_attach_lb, m_fullscreen, m_settings, m_sync, m_gdrive, m_mobile, m_router, m_pwa, m_character_io, m_avatar, m_templates_data].forEach(ns => {
  Object.keys(ns).forEach(k => {
    if (!(k in LoreOS)) Object.defineProperty(LoreOS, k, { get: () => ns[k], enumerable: true, configurable: true });
  });
});
Object.keys(state).forEach(k => {
  Object.defineProperty(LoreOS, k, { get: () => state[k], set: v => { state[k] = v; }, enumerable: true, configurable: true });
});
LoreOS.state = state;
window.LoreOS = LoreOS;
