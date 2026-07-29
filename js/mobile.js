// ═══════════════════════════════════════════════════════
// MOBILE.JS — mobile nav, drawer, touch UX
// ═══════════════════════════════════════════════════════
function wireMobile() {
  const isMob = () => window.innerWidth <= 700;

  // ── Sidebar drawer ──
  const sidebar = g('sidebar');
  const backdrop = g('mob-backdrop');

  function openSidebar() {
    sidebar.classList.add('mob-open');
    backdrop.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('mob-open');
    backdrop.classList.remove('visible');
    document.body.style.overflow = '';
  }

  backdrop.addEventListener('click', closeSidebar);
  g('mob-sb-close').addEventListener('click', closeSidebar);

  // ── updateMobNav: show/hide mode-specific action buttons ──
  function updateMobNav(m) {
    ['lore','char','preset','persona','prompt','regex'].forEach(modeKey => {
      document.querySelectorAll(`.mob-mode-btn.mob-${modeKey}`).forEach(btn => {
        btn.style.display = (m === modeKey) ? '' : 'none';
      });
    });
  }

  // ── updateMobViewBtns: show/hide view-specific controls ──
  // When in editor: collapse view nav, show back button + sidebar + mode action buttons
  // When in other views: show view nav, hide editor-specific buttons
  function updateMobViewBtns(view) {
    const isEditor = view === 'editor';

    // View nav buttons (Home/Library/Notebook/Editor)
    const viewNavBtns = ['mobGoHome','mobGoLibrary','mobGoNotebook','mobGoEditor'];
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

    // Sidebar toggle + sep
    const entriesBtn = g('mobEntries');
    const sep = g('mob-nav-sep');
    if (entriesBtn) entriesBtn.style.display = isEditor ? '' : 'none';
    if (sep) sep.style.display = isEditor ? '' : 'none';

    // Mode action buttons
    if (!isEditor) {
      document.querySelectorAll('.mob-mode-btn').forEach(b => { b.style.display = 'none'; });
    } else {
      updateMobNav(mode || 'lore');
    }

    // Active state on view nav buttons
    const viewKey = view ? view.charAt(0).toUpperCase() + view.slice(1) : 'Home';
    viewNavBtns.forEach(id => {
      const btn = g(id);
      if (btn) btn.classList.toggle('active', id === 'mobGo' + viewKey);
    });
  }

  // ── Patch switchMode to sync mobile nav ──
  const origSwitchMode = switchMode;
  window.switchMode = function(newMode) {
    origSwitchMode(newMode);
    if (isMob()) {
      updateMobNav(newMode);
      // if we're in editor view, keep mode buttons visible for new mode
      if (typeof currentView !== 'undefined' && currentView === 'editor') {
        updateMobViewBtns('editor');
      }
    }
  };

  // ── Init state ──
  updateMobNav(mode || 'lore');
  // default to 'home' — router will call updateMobViewBtns again after init
  updateMobViewBtns('home');

  // ── View navigation ──
  if (g('mobGoHome'))     g('mobGoHome').addEventListener('click', () => { navigateTo('home'); updateMobViewBtns('home'); });
  if (g('mobGoLibrary'))  g('mobGoLibrary').addEventListener('click', () => { navigateTo('library'); updateMobViewBtns('library'); });
  if (g('mobGoNotebook')) g('mobGoNotebook').addEventListener('click', () => { navigateTo('notebook'); updateMobViewBtns('notebook'); });
  if (g('mobGoEditor'))   g('mobGoEditor').addEventListener('click', () => { navigateTo('editor'); updateMobViewBtns('editor'); });

  // ── Always-on ──
  g('mobEntries').addEventListener('click', openSidebar);
  g('mobTheme').addEventListener('click', toggleTheme);
  g('mobSettings').addEventListener('click', () => openModal('settingsModal'));

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

  // ── PRESET buttons ──
  g('mobPresetNew').addEventListener('click', () => { createPreset(); if(isMob()) closeSidebar(); });
  g('mobPresetImport').addEventListener('click', () => { g('filePresetInput').click(); });
  g('mobPresetLibrary').addEventListener('click', openPresetLibrary);
  g('mobPresetPromptLib').addEventListener('click', () => openTemplateLibrary('preset'));
  g('mobPresetAddPrompt').addEventListener('click', () => {
    if (!activePresetId || !presetLibrary[activePresetId]) { toast('Open a preset first.', 'warn'); return; }
    const entry2 = presetLibrary[activePresetId];
    if (!entry2.preset.prompts) entry2.preset.prompts = [];
    entry2.preset.prompts.unshift(makeBlankPrompt());
    syncPromptOrder(entry2.preset);
    renderPromptList(entry2.preset.prompts);
    g('editorContent').scrollTop = 0;
  });

  // ── PERSONA buttons ──
  if (g('mobPersonaNew'))    g('mobPersonaNew').addEventListener('click', () => { createPersona(); });
  if (g('mobPersonaImport')) g('mobPersonaImport').addEventListener('click', () => { g('filePersonaInput').click(); });

  // ── PROMPT buttons ──
  if (g('mobPromptNew'))    g('mobPromptNew').addEventListener('click', () => { createPromptConfig(); });
  if (g('mobPromptExport')) g('mobPromptExport').addEventListener('click', () => { exportPromptConfig(); });

  // ── REGEX buttons ──
  if (g('mobRegexNew'))    g('mobRegexNew').addEventListener('click', () => { createRegexRule(); });
  if (g('mobRegexImport')) g('mobRegexImport').addEventListener('click', () => { g('fileRegexInput').click(); });
  if (g('mobRegexExport')) g('mobRegexExport').addEventListener('click', () => { exportRegexJson(); });

  // expose for router to call after navigateTo
  window.updateMobViewBtns = updateMobViewBtns;
}
