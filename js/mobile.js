// ═══════════════════════════════════════════════════════
// MOBILE.JS — mobile nav, drawer, touch UX
// ═══════════════════════════════════════════════════════

import { createChar, openCharLibrary } from './character.js';
import { exportCharByaf, exportCharCharx, exportCharCompanion, exportCharJson, exportCharJsonV2, openCharPngExport } from './character_io.js';
import { openLibrary } from './library.js';
import { clearEditor, openLoreSettings } from './lorebook.js';
import { exportJanitorJson, exportJson, exportSaucepanJson, openJanitorPasteModal, openPublicExport } from './lorebook_io.js';
import { createPreset, makeBlankPrompt, openPresetLibrary, renderPromptList, syncPromptOrder } from './preset.js';
import { PT, ptRefreshManual } from './pronoun.js';
import { currentView, navigateTo } from './router.js';
import { openSettings, toggleTheme } from './settings.js';
import { state } from './state.js';
import { openEntryPicker, openTemplateLibrary } from './templates.js';
import { closeModal, g, openModal, registerMarkup, toast } from './util.js';

export const isMob = () => window.innerWidth <= 700;

// ── Sidebar drawer ──
export function openSidebar() {
  g('sidebar').classList.add('mob-open');
  g('mob-backdrop').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
export function closeSidebar() {
  g('sidebar').classList.remove('mob-open');
  g('mob-backdrop').classList.remove('visible');
  document.body.style.overflow = '';
}

// Lets sidebar lists close the drawer after you pick something (phones only)
export function closeMobSidebar() { if (isMob()) closeSidebar(); }

// ── updateMobNav: show/hide mode-specific action buttons ──
export function updateMobNav(m) {
  ['lore','char','preset','prompt','regex','image'].forEach(modeKey => {
    document.querySelectorAll(`.mob-mode-btn.mob-${modeKey}`).forEach(btn => {
      btn.style.display = (m === modeKey) ? '' : 'none';
    });
  });
  // Every editor mode has a sidebar (entries / characters / presets)
  const entriesBtn = g('mobEntries');
  const sep = g('mob-nav-sep');
  const hasSidebar = ['lore','char','preset','prompt','regex','image'].includes(m);
  if (entriesBtn) entriesBtn.style.display = hasSidebar ? '' : 'none';
  if (sep) sep.style.display = hasSidebar ? '' : 'none';
}

// ── updateMobViewBtns: show/hide view-specific controls ──
// When in editor: collapse view nav, show back button + sidebar + mode action buttons
// When in other views: show view nav, hide editor-specific buttons
export function updateMobViewBtns(view) {
  const isEditor = view === 'editor';

  // View nav buttons (Home/Library/Notebook/Editor)
  const viewNavBtns = ['mobGoHome','mobGoLibrary','mobGoNotebook','mobGoEditor','mobGoLaboratory'];
  viewNavBtns.forEach(id => {
    const btn = g(id);
    if (btn) btn.style.display = isEditor ? 'none' : '';
  });

  // View nav separator
  const viewSep = g('mob-nav-sep-views');
  if (viewSep) viewSep.style.display = isEditor ? 'none' : '';

  // Back button (only shown in editor)
  let backBtn = g('mobBackBtn');
  if (isEditor && !backBtn) {
    // create it once
    backBtn = document.createElement('button');
    backBtn.className = 'mob-nav-btn';
    backBtn.id = 'mobBackBtn';
    backBtn.title = 'Back';
    backBtn.innerHTML = '<span class="icon">◀</span><span class="mob-nav-lbl">Back</span>';
    backBtn.addEventListener('click', () => { navigateTo('home'); });
    const nav = document.getElementById('mob-nav');
    if (nav) nav.insertBefore(backBtn, nav.firstChild);
  }
  if (backBtn) backBtn.style.display = isEditor ? '' : 'none';

  // Back separator
  let backSep = g('mobBackSep');
  if (isEditor && !backSep) {
    backSep = document.createElement('div');
    backSep.id = 'mobBackSep';
    backSep.style.cssText = 'width:1px;background:var(--bd);margin:.3rem .1rem;flex-shrink:0;align-self:stretch';
    const backBtnEl = g('mobBackBtn');
    if (backBtnEl && backBtnEl.nextSibling) {
      backBtnEl.parentNode.insertBefore(backSep, backBtnEl.nextSibling);
    }
  }
  if (backSep) backSep.style.display = isEditor ? '' : 'none';

  // Sidebar toggle + sep — only in the editor (all three modes have a sidebar)
  const entriesBtn = g('mobEntries');
  const sep = g('mob-nav-sep');
  const sidebarMode = (typeof state.mode !== 'undefined') ? state.mode : 'lore';
  const showSidebar = isEditor && ['lore','char','preset'].includes(sidebarMode);
  if (entriesBtn) entriesBtn.style.display = showSidebar ? '' : 'none';
  if (sep) sep.style.display = showSidebar ? '' : 'none';

  // Mode action buttons
  if (!isEditor) {
    document.querySelectorAll('.mob-mode-btn').forEach(b => { b.style.display = 'none'; });
  } else {
    updateMobNav(state.mode || 'lore');
  }

  // Active state on view nav buttons
  const viewKey = view ? view.charAt(0).toUpperCase() + view.slice(1) : 'Home';
  viewNavBtns.forEach(id => {
    const btn = g(id);
    if (btn) btn.classList.toggle('active', id === 'mobGo' + viewKey);
  });
}

// Called by switchMode after every mode change so the phone nav follows it
export function mobileAfterModeSwitch(newMode) {
  if (!isMob()) return;
  updateMobNav(newMode);
  // if we're in editor view, keep mode buttons visible for new mode
  if (currentView === 'editor') updateMobViewBtns('editor');
}

export function wireMobile() {
  g('mob-backdrop').addEventListener('click', closeSidebar);
  g('mob-sb-close').addEventListener('click', closeSidebar);

  // ── Init state ──
  updateMobNav(state.mode || 'lore');
  // default to 'home' — router will call updateMobViewBtns again after init
  updateMobViewBtns('home');

  // ── View navigation ──
  if (g('mobGoHome'))     g('mobGoHome').addEventListener('click', () => { navigateTo('home'); updateMobViewBtns('home'); });
  if (g('mobGoLibrary'))  g('mobGoLibrary').addEventListener('click', () => { navigateTo('library'); updateMobViewBtns('library'); });
  if (g('mobGoNotebook')) g('mobGoNotebook').addEventListener('click', () => { navigateTo('notebook'); updateMobViewBtns('notebook'); });
  if (g('mobGoEditor'))      g('mobGoEditor').addEventListener('click', () => { navigateTo('editor'); updateMobViewBtns('editor'); });
  if (g('mobGoLaboratory')) g('mobGoLaboratory').addEventListener('click', () => { navigateTo('laboratory'); updateMobViewBtns('laboratory'); });

  // ── Always-on ──
  g('mobEntries').addEventListener('click', openSidebar);
  g('mobTheme').addEventListener('click', toggleTheme);
  g('mobSettings').addEventListener('click', () => openSettings());
  if (g('mobThemePage')) g('mobThemePage').addEventListener('click', () => { navigateTo('theme'); updateMobViewBtns('theme'); });

  // ── LORE buttons ──
  g('mobNewEntry').addEventListener('click', () => { openEntryPicker(); if(isMob()) closeSidebar(); });
  g('mobImport').addEventListener('click', () => openModal('mobImportModal'));
  g('mobExport').addEventListener('click', () => openModal('mobExportModal'));
  g('mobSearch').addEventListener('click', () => openModal('srModal'));
  g('mobLibrary').addEventListener('click', openLibrary);
  g('mobLoreTemplates').addEventListener('click', () => openTemplateLibrary('lore'));
  if (g('mobLoreSettings')) g('mobLoreSettings').addEventListener('click', () => openLoreSettings());

  // Mobile import/export pickers
  if (g('mobImportBtn'))       g('mobImportBtn').addEventListener('click', () => { closeModal('mobImportModal'); g('fileInput').click(); });
  if (g('mobImportJanitorPasteBtn')) g('mobImportJanitorPasteBtn').addEventListener('click', () => { closeModal('mobImportModal'); openJanitorPasteModal(); });
  if (g('mobImportSaucepanBtn')) g('mobImportSaucepanBtn').addEventListener('click', () => { closeModal('mobImportModal'); g('fileSaucepanInput').click(); });
  if (g('mobExportSaucepanBtn')) g('mobExportSaucepanBtn').addEventListener('click', () => { closeModal('mobExportModal'); exportSaucepanJson(); });
  if (g('mobImportMergeBtn'))  g('mobImportMergeBtn').addEventListener('click', () => { closeModal('mobImportModal'); g('fileMergeInput').click(); });
  if (g('mobExportJsonBtn'))   g('mobExportJsonBtn').addEventListener('click', () => { closeModal('mobExportModal'); exportJson(); });
  if (g('mobExportJanitorBtn')) g('mobExportJanitorBtn').addEventListener('click', () => { closeModal('mobExportModal'); exportJanitorJson(); });
  if (g('mobExportTxtBtn'))    g('mobExportTxtBtn').addEventListener('click', () => { closeModal('mobExportModal'); openModal('expTxtModal'); });
  if (g('mobExportPubBtn'))    g('mobExportPubBtn').addEventListener('click', () => { closeModal('mobExportModal'); openPublicExport(); });
  if (g('mobClearBtn'))        g('mobClearBtn').addEventListener('click', () => { closeModal('mobExportModal'); clearEditor(); });

  // ── CHAR buttons ──
  g('mobCharNew').addEventListener('click', () => { createChar(); if(isMob()) closeSidebar(); });
  g('mobCharImport').addEventListener('click', () => openModal('mobCharImportModal'));
  g('mobCharLibrary').addEventListener('click', openCharLibrary);
  g('mobCharAttach').addEventListener('click', () => g('attachLbBtn').click());
  g('mobCharPronouns').addEventListener('click', () => {
    const tool = g('pronounTool');
    tool.classList.toggle('open');
    PT.open = tool.classList.contains('open');
    if (PT.open && PT.targetField) ptRefreshManual();
  });
  g('mobCharTemplates').addEventListener('click', () => openTemplateLibrary('char'));

  // Mobile char import picker
  if (g('mobCharImportJsonBtn')) g('mobCharImportJsonBtn').addEventListener('click', () => { closeModal('mobCharImportModal'); g('fileCharInput').accept='.json'; g('fileCharInput').click(); });
  if (g('mobCharImportPngBtn'))  g('mobCharImportPngBtn').addEventListener('click',  () => { closeModal('mobCharImportModal'); g('fileCharInput').accept='.png';  g('fileCharInput').click(); });

  // Mobile char export
  g('mobCharExport').addEventListener('click', () => openModal('mobCharExportModal'));
  if (g('mobCharExportJsonBtn'))      g('mobCharExportJsonBtn').addEventListener('click',      () => { closeModal('mobCharExportModal'); exportCharJson(state.activeCharId); });
  if (g('mobCharExportV2JsonBtn'))    g('mobCharExportV2JsonBtn').addEventListener('click',    () => { closeModal('mobCharExportModal'); exportCharJsonV2(state.activeCharId); });
  if (g('mobCharExportV3PngBtn'))     g('mobCharExportV3PngBtn').addEventListener('click',     () => { closeModal('mobCharExportModal'); openCharPngExport(state.activeCharId, false); });
  if (g('mobCharExportPngBtn'))       g('mobCharExportPngBtn').addEventListener('click',       () => { closeModal('mobCharExportModal'); openCharPngExport(state.activeCharId, true); });
  if (g('mobCharExportJanitorBtn'))   g('mobCharExportJanitorBtn').addEventListener('click',   () => { closeModal('mobCharExportModal'); exportCharJsonV2(state.activeCharId, { janitor: true }); });
  if (g('mobCharExportJanitorPngBtn')) g('mobCharExportJanitorPngBtn').addEventListener('click', () => { closeModal('mobCharExportModal'); openCharPngExport(state.activeCharId, true, { janitor: true }); });
  if (g('mobCharExportCharxBtn'))     g('mobCharExportCharxBtn').addEventListener('click',     () => { closeModal('mobCharExportModal'); exportCharCharx(state.activeCharId); });
  if (g('mobCharExportByafBtn')) g('mobCharExportByafBtn').addEventListener('click', () => { closeModal('mobCharExportModal'); exportCharByaf(state.activeCharId); });
  if (g('mobCharExportCompanionBtn')) g('mobCharExportCompanionBtn').addEventListener('click', () => { closeModal('mobCharExportModal'); exportCharCompanion(state.activeCharId); });

  // ── PRESET buttons ──
  g('mobPresetNew').addEventListener('click', () => { createPreset(); if(isMob()) closeSidebar(); });
  g('mobPresetImport').addEventListener('click', () => { g('filePresetInput').click(); });
  g('mobPresetLibrary').addEventListener('click', openPresetLibrary);
  g('mobPresetPromptLib').addEventListener('click', () => openTemplateLibrary('preset'));
  g('mobPresetAddPrompt').addEventListener('click', () => {
    if (!state.activePresetId || !state.presetLibrary[state.activePresetId]) { toast('Open a preset first.', 'warn'); return; }
    const entry2 = state.presetLibrary[state.activePresetId];
    if (!entry2.preset.prompts) entry2.preset.prompts = [];
    entry2.preset.prompts.unshift(makeBlankPrompt());
    syncPromptOrder(entry2.preset);
    renderPromptList(entry2.preset.prompts);
    g('editorContent').scrollTop = 0;
  });

}

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(140, `<!-- MOBILE BOTTOM NAV -->
<nav id="mob-nav">
  <!-- view nav buttons (always visible on mobile, hidden when in editor) -->
  <button class="mob-nav-btn mob-view-btn" id="mobGoHome" title="Home">
    <span class="icon">⌂︎</span><span class="mob-nav-lbl">Home</span>
  </button>
  <button class="mob-nav-btn mob-view-btn" id="mobGoLibrary" title="Library">
    <span class="icon">▤︎</span><span class="mob-nav-lbl">Library</span>
  </button>
  <button class="mob-nav-btn mob-view-btn" id="mobGoNotebook" title="Journal">
    <span class="icon">❡︎</span><span class="mob-nav-lbl">Journal</span>
  </button>
  <button class="mob-nav-btn mob-view-btn" id="mobGoEditor" title="Workshop">
    <span class="icon">⚒︎</span><span class="mob-nav-lbl">Workshop</span>
  </button>
  <div id="mob-nav-sep-views" style="width:1px;background:var(--bd);margin:.3rem .1rem;flex-shrink:0;align-self:stretch;"></div>

  <!-- always-visible: sidebar toggle (editor only) -->
  <button class="mob-nav-btn mob-editor-only" id="mobEntries" title="Sidebar" style="display:none">
    <span class="icon">☰</span><span class="mob-nav-lbl">Sidebar</span>
  </button>
  <div id="mob-nav-sep" style="display:none"></div>

  <!-- LORE actions -->
  <button class="mob-nav-btn mob-mode-btn mob-lore hi" id="mobNewEntry" title="New Entry">
    <span class="icon">+</span><span class="mob-nav-lbl">New</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-lore" id="mobImport" title="Import">
    <span class="icon">↓</span><span class="mob-nav-lbl">Import</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-lore" id="mobExport" title="Export">
    <span class="icon">↑</span><span class="mob-nav-lbl">Export</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-lore" id="mobSearch" title="Find & Replace">
    <span class="icon">⌕︎</span><span class="mob-nav-lbl">Search</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-lore" id="mobLibrary" title="Library">
    <span class="icon">▤︎</span><span class="mob-nav-lbl">Library</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-lore" id="mobLoreTemplates" title="Templates">
    <span class="icon">◫︎</span><span class="mob-nav-lbl">Templates</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-lore" id="mobLoreSettings" title="LB Settings">
    <span class="icon">⚙︎</span><span class="mob-nav-lbl">Global</span>
  </button>

  <!-- CHAR actions -->
  <button class="mob-nav-btn mob-mode-btn mob-char hi" id="mobCharNew" title="New Character" style="display:none">
    <span class="icon">+</span><span class="mob-nav-lbl">New</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-char" id="mobCharImport" title="Import Card" style="display:none">
    <span class="icon">↓</span><span class="mob-nav-lbl">Import</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-char" id="mobCharExport" title="Export Card" style="display:none">
    <span class="icon">↑</span><span class="mob-nav-lbl">Export</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-char" id="mobCharLibrary" title="Character Library" style="display:none">
    <span class="icon">▤︎</span><span class="mob-nav-lbl">Library</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-char" id="mobCharAttach" title="Attach Lorebook" style="display:none">
    <span class="icon">⌖︎</span><span class="mob-nav-lbl">Attach LB</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-char" id="mobCharPronouns" title="Pronouns & Nouns" style="display:none">
    <span class="icon">⇄︎</span><span class="mob-nav-lbl">Pronouns</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-char" id="mobCharTemplates" title="Templates" style="display:none">
    <span class="icon">◫︎</span><span class="mob-nav-lbl">Templates</span>
  </button>

  <!-- PRESET actions -->
  <button class="mob-nav-btn mob-mode-btn mob-preset hi" id="mobPresetNew" title="New Preset" style="display:none">
    <span class="icon">+</span><span class="mob-nav-lbl">New</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-preset" id="mobPresetImport" title="Import Preset" style="display:none">
    <span class="icon">↓</span><span class="mob-nav-lbl">Import</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-preset" id="mobPresetLibrary" title="Preset Library" style="display:none">
    <span class="icon">▤︎</span><span class="mob-nav-lbl">Library</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-preset" id="mobPresetPromptLib" title="Prompt Library" style="display:none">
    <span class="icon">☰︎</span><span class="mob-nav-lbl">Prompts</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-preset" id="mobPresetAddPrompt" title="Add Prompt" style="display:none">
    <span class="icon">+</span><span class="mob-nav-lbl">+ Prompt</span>
  </button>

  <!-- PROMPT actions -->
  <button class="mob-nav-btn mob-mode-btn mob-prompt hi" id="mobPromptNew" title="New Prompt Pack" style="display:none">
    <span class="icon">+</span><span class="mob-nav-lbl">New</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-prompt" id="mobPromptImport" title="Import Prompt Pack" style="display:none">
    <span class="icon">↓</span><span class="mob-nav-lbl">Import</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-prompt" id="mobPromptExport" title="Export Prompt Pack" style="display:none">
    <span class="icon">↑</span><span class="mob-nav-lbl">Export</span>
  </button>

  <!-- REGEX actions -->
  <button class="mob-nav-btn mob-mode-btn mob-regex hi" id="mobRegexNew" title="New Regex Set" style="display:none">
    <span class="icon">+</span><span class="mob-nav-lbl">New</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-regex" id="mobRegexImport" title="Import Regex" style="display:none">
    <span class="icon">↓</span><span class="mob-nav-lbl">Import</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-regex" id="mobRegexExport" title="Export Regex" style="display:none">
    <span class="icon">↑</span><span class="mob-nav-lbl">Export</span>
  </button>

  <!-- IMAGE actions -->
  <button class="mob-nav-btn mob-mode-btn mob-image hi" id="mobImageSave" title="Save picture" style="display:none">
    <span class="icon">✓</span><span class="mob-nav-lbl">Save</span>
  </button>
  <button class="mob-nav-btn mob-mode-btn mob-image" id="mobImageUndo" title="Undo" style="display:none">
    <span class="icon">↶</span><span class="mob-nav-lbl">Undo</span>
  </button>

  <!-- always-visible: settings/theme -->
  <div id="mob-nav-sep2" style="width:1px;background:var(--bd);margin:.3rem .1rem;flex-shrink:0;align-self:stretch;"></div>
  <button class="mob-nav-btn" id="mobTheme" title="Switch between light and dark">
    <span class="icon">◑</span><span class="mob-nav-lbl">Light/Dark</span>
  </button>
  <button class="mob-nav-btn" id="mobThemePage" title="Theme">
    <span class="icon" data-px="theme"></span><span class="mob-nav-lbl">Theme</span>
  </button>
  <button class="mob-nav-btn" id="mobSettings" title="Settings">
    <span class="icon">⚙︎</span><span class="mob-nav-lbl">Settings</span>
  </button>
</nav>`);

registerMarkup(150, `<!-- Mobile import/export pickers (unchanged) -->
<div id="mobImportModal" class="modal">
  <div class="modal-box">
    <div class="modal-head"><h2>Import</h2><button class="modal-x" data-close="mobImportModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <button class="btn btn-p" id="mobImportBtn" style="width:100%;justify-content:center;padding:.65rem">SillyTavern</button>
      <button class="btn btn-s" id="mobImportJanitorPasteBtn" style="width:100%;justify-content:center;padding:.65rem">JanitorAI</button>
      <button class="btn btn-s" id="mobImportSaucepanBtn" style="width:100%;justify-content:center;padding:.65rem">SaucepanAI</button>
      <button class="btn btn-s" id="mobImportMergeBtn" style="width:100%;justify-content:center;padding:.65rem">Import for Merge</button>
    </div>
  </div>
</div>`);

registerMarkup(160, `<div id="mobExportModal" class="modal">
  <div class="modal-box">
    <div class="modal-head"><h2>Export</h2><button class="modal-x" data-close="mobExportModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <button class="btn btn-p" id="mobExportJsonBtn" style="width:100%;justify-content:center;padding:.65rem">SillyTavern</button>
      <button class="btn btn-s" id="mobExportJanitorBtn" style="width:100%;justify-content:center;padding:.65rem">JanitorAI</button>
      <button class="btn btn-s" id="mobExportSaucepanBtn" style="width:100%;justify-content:center;padding:.65rem">SaucepanAI</button>
      <button class="btn btn-s" id="mobExportTxtBtn" style="width:100%;justify-content:center;padding:.65rem">Export as Text</button>
      <button class="btn btn-s" id="mobExportPubBtn" style="width:100%;justify-content:center;padding:.65rem">Export for Public Pages</button>
      <button class="btn btn-err" id="mobClearBtn" style="width:100%;justify-content:center;padding:.65rem">Clear Editor</button>
    </div>
  </div>
</div>`);

registerMarkup(170, `<div id="mobCharImportModal" class="modal">
  <div class="modal-box">
    <div class="modal-head"><h2>Import Card</h2><button class="modal-x" data-close="mobCharImportModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <button class="btn btn-p" id="mobCharImportJsonBtn" style="width:100%;justify-content:center;padding:.65rem">Import JSON Card</button>
      <button class="btn btn-s" id="mobCharImportPngBtn" style="width:100%;justify-content:center;padding:.65rem">Import PNG Card</button>
    </div>
  </div>
</div>`);

registerMarkup(180, `<div id="mobCharExportModal" class="modal">
  <div class="modal-box">
    <div class="modal-head"><h2>Export Card</h2><button class="modal-x" data-close="mobCharExportModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <button class="btn btn-p" id="mobCharExportV3PngBtn" style="width:100%;justify-content:center;padding:.65rem">V3 PNG</button>
      <button class="btn btn-s" id="mobCharExportPngBtn" style="width:100%;justify-content:center;padding:.65rem">V2 PNG</button>
      <button class="btn btn-s" id="mobCharExportJanitorPngBtn" style="width:100%;justify-content:center;padding:.65rem">JanitorAI PNG</button>
      <details class="dd-group mob-group">
        <summary>JSON</summary>
        <div style="display:flex;flex-direction:column;gap:.65rem;margin-top:.65rem">
          <button class="btn btn-s" id="mobCharExportJsonBtn" style="width:100%;justify-content:center;padding:.65rem">V3 JSON</button>
          <button class="btn btn-s" id="mobCharExportV2JsonBtn" style="width:100%;justify-content:center;padding:.65rem">V2 JSON</button>
          <button class="btn btn-s" id="mobCharExportJanitorBtn" style="width:100%;justify-content:center;padding:.65rem">JanitorAI JSON</button>
        </div>
      </details>
      <button class="btn btn-s" id="mobCharExportCharxBtn" style="width:100%;justify-content:center;padding:.65rem">.CHARX</button>
      <button class="btn btn-s" id="mobCharExportByafBtn" style="width:100%;justify-content:center;padding:.65rem">Backyard (.byaf)</button>
      <button class="btn btn-s" id="mobCharExportCompanionBtn" style="width:100%;justify-content:center;padding:.65rem">SaucepanAI</button>
    </div>
  </div>
</div>`);

