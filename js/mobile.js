// ═══════════════════════════════════════════════════════
function wireMobile() {
  const isMob = () => window.innerWidth <= 700;

  // Sidebar drawer open/close
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

  // ── Mode-aware nav: show/hide button groups on mode switch ──
  function updateMobNav(m) {
    ['lore','char','preset'].forEach(modeKey => {
      document.querySelectorAll(`.mob-mode-btn.mob-${modeKey}`).forEach(btn => {
        btn.style.display = (m === modeKey) ? '' : 'none';
      });
    });
  }

  // Patch switchMode to also update mobile nav
  const origSwitchMode = switchMode;
  window.switchMode = function(newMode) {
    origSwitchMode(newMode);
    if (isMob()) updateMobNav(newMode);
  };

  // Init nav state to current mode
  updateMobNav(mode || 'lore');

  // ── Always-on buttons ──
  g('mobEntries').addEventListener('click', openSidebar);
  g('mobTheme').addEventListener('click', toggleTheme);
  g('mobSettings').addEventListener('click', () => openModal('settingsModal'));

  // ── LORE buttons ──
  g('mobNewEntry').addEventListener('click', () => { createEntry(); if(isMob()) closeSidebar(); });
  g('mobImport').addEventListener('click', () => openModal('mobImportModal'));
  g('mobExport').addEventListener('click', () => openModal('mobExportModal'));
  g('mobSearch').addEventListener('click', () => openModal('srModal'));
  g('mobLibrary').addEventListener('click', openLibrary);

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

  // ── PRESET buttons ──
  g('mobPresetNew').addEventListener('click', () => { createPreset(); if(isMob()) closeSidebar(); });
  g('mobPresetImport').addEventListener('click', () => g('presetImportBtn').click());
  g('mobPresetLibrary').addEventListener('click', () => openPresetLibrary());
  g('mobPresetPromptLib').addEventListener('click', () => g('presetTemplatesBtn').click());
  g('mobPresetAddPrompt').addEventListener('click', () => g('psAddPromptHdr').click());

  // Mobile import modal buttons (lore)
  g('mobImportBtn').addEventListener('click', () => { closeModal('mobImportModal'); g('fileInput').click(); });
  g('mobImportMergeBtn').addEventListener('click', () => { closeModal('mobImportModal'); g('fileMergeInput').click(); });

  // Mobile export modal buttons (lore)
  g('mobExportJsonBtn').addEventListener('click', () => { closeModal('mobExportModal'); exportJson(); });
  g('mobExportTxtBtn').addEventListener('click', () => { closeModal('mobExportModal'); openModal('expTxtModal'); });
  g('mobExportPubBtn').addEventListener('click', () => { closeModal('mobExportModal'); openPublicExport(); });
  g('mobClearBtn').addEventListener('click', () => { closeModal('mobExportModal'); clearEditor(); });

  // Mobile char import modal buttons
  g('mobCharImportJsonBtn').addEventListener('click', () => { closeModal('mobCharImportModal'); g('charImportJsonBtn').click(); });
  g('mobCharImportPngBtn').addEventListener('click', () => { closeModal('mobCharImportModal'); g('charImportPngBtn').click(); });

  // Swipe-to-open sidebar: swipe right from left edge
  let touchStartX = 0, touchStartY = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!isMob()) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (touchStartX < 30 && dx > 60 && dy < 80) openSidebar();
    if (sidebar.classList.contains('mob-open') && dx < -60 && dy < 80) closeSidebar();
  }, { passive: true });

  // When an entry item is tapped on mobile, close the sidebar
  g('entryList').addEventListener('click', e => {
    if (isMob() && e.target.closest('.ei') && !e.target.closest('.ei-act') && !e.target.closest('.ei-num') && !e.target.closest('.ei-cb')) {
      setTimeout(closeSidebar, 80);
    }
  });

  // Handle resize: if going back to desktop, reset sidebar state
  window.addEventListener('resize', () => {
    if (!isMob()) {
      sidebar.classList.remove('mob-open');
      backdrop.classList.remove('visible');
      document.body.style.overflow = '';
    }
  });
}
