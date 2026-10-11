// ═══════════════════════════════════════════════════════
// MAIN — start-up. Wires the page together in a fixed order and handles global events.
// ═══════════════════════════════════════════════════════

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
    if (typeof toast === 'function') toast('Something broke: ' + msg, 'err');
  }
  window.addEventListener('error', e => report('uncaught error:', e.error || e.message));
  window.addEventListener('unhandledrejection', e => report('unhandled promise:', e.reason));
})();

// ═══════════════════════════════════════════════════════
// INIT
// Each step is isolated: one module failing to start must not
// stop the rest of the app from starting.
// ═══════════════════════════════════════════════════════
function initStep(name, fn) {
  try { fn(); }
  catch(e) {
    console.error(`[LoreOS] init step "${name}" failed:`, e);
    setTimeout(() => {
      if (typeof toast === 'function') toast(`Startup problem in ${name} — see console.`, 'warn');
    }, 400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initStep('prefs',        loadPrefs);
  initStep('events',       wireEvents);
  initStep('autosave',     wireAutosave);
  initStep('mobile',       wireMobile);
  initStep('storage',      loadFromStorage);
  initStep('mode',         () => switchMode('lore'));
  initStep('router',       () => { if (typeof initRouter === 'function') initRouter(); });
  initStep('workshop tabs', wsRestoreTabs);
  initStep('pronoun tool', wirePronounTool);
  initStep('fullscreen',   wireFullscreen);
  initStep('templates',    wireTplLibrary);
  initStep('settings',     wireSettings);
  initStep('fonts',        wireFonts);
  initStep('theme',        applyAllCustomisations);
  initStep('font apply',   applyFonts);
});

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
  if (g('charHdrExportV2JsonBtn')) g('charHdrExportV2JsonBtn').onclick = () => exportCharJsonV2(activeCharId);
  if (g('charHdrExportV3PngBtn')) g('charHdrExportV3PngBtn').onclick = () => openCharPngExport(activeCharId, false);
  if (g('charHdrExportPngBtn')) g('charHdrExportPngBtn').onclick = () => openCharPngExport(activeCharId, true);
  if (g('charHdrExportSaucepanBtn')) g('charHdrExportSaucepanBtn').onclick = () => exportCharSaucepan(activeCharId);
  if (g('charHdrExportCharxBtn')) g('charHdrExportCharxBtn').onclick = () => exportCharCharx(activeCharId);
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
    const m = mode;
    switch(e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        if (m === 'lore') createEntry(); else if (m === 'char') createChar(); else if (m === 'preset') createPreset();
        break;
      case 's':
        e.preventDefault();
        if (m === 'lore') { if (activeTabId !== null) saveEntry(activeTabId); }
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
        else if (m === 'char') { if (activeCharId) exportCharJson(activeCharId); }
        else if (m === 'preset') exportPreset();
        break;
      case 'm': if (m === 'lore') { e.preventDefault(); g('fileMergeInput').click(); } break;
      case 'h': if (m === 'lore') { e.preventDefault(); openModal('srModal'); } break;
      case 'w': if (m === 'lore') { e.preventDefault(); if (activeTabId !== null) closeTab(activeTabId); } break;
      case 'd': e.preventDefault(); toggleTheme(); break;
      case 'tab':
        if (m !== 'lore') break;
        e.preventDefault();
        if (openTabs.length > 0) {
          const i = openTabs.indexOf(activeTabId);
          activeTabId = e.shiftKey ? openTabs[(i - 1 + openTabs.length) % openTabs.length] : openTabs[(i + 1) % openTabs.length];
          renderTabs(); renderEditor();
        }
        break;
      case '-': if (m === 'lore') { e.preventDefault(); changeZoom(-1); } break;
      case '=': case '+': if (m === 'lore') { e.preventDefault(); changeZoom(1); } break;
    }
  });
}
