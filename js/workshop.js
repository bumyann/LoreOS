// ═══════════════════════════════════════════════════════
// WORKSHOP — the tab bar (up to 5 open items), autosave, mode switching and tab restore.
// ═══════════════════════════════════════════════════════

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

// Open a freshly created / imported / duplicated item in a workshop tab (or
// focus its tab if it already has one). Returns false when the tab bar is
// full, so the caller can still open the item without a tab.
function wsShowItem(type, itemId) {
  const has = wsItems.some(t => t.type === type && t.itemId === itemId);
  if (!has && wsItems.length >= WS_MAX_TABS) {
    toast(`Max ${WS_MAX_TABS} tabs open — close one to get a tab for this.`, 'warn');
    return false;
  }
  wsOpenItem(type, itemId);
  return true;
}

function wsActivate(tabId) {
  // Whatever is typed in the editor we're leaving is saved first, so
  // switching tabs can never roll a field back to the last explicit save
  commitActiveEditor();
  wsActiveId = tabId;
  const tab = wsItems.find(t => t.id === tabId);
  if (!tab) return;
  renderWsTabs();
  // Switch editor mode and load the item
  if (tab.type === 'lore') {
    if (typeof switchMode === 'function') switchMode('lore');
    // Already the open lorebook (its edits write through to the library), so
    // don't reload it: that would close its open entry tabs for nothing
    if (typeof loreActiveLibName === 'function' && loreActiveLibName() === tab.itemId) {
      // nothing to load
    } else if (typeof libLoad === 'function') {
      // lorebooks keyed by name
      libLoad(tab.itemId);
    }
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

  // Autosave before closing (the active tab is the one whose editor is on screen)
  if (tab.id === wsActiveId) commitActiveEditor();
  if (tab.type === 'lore') {
    if (loreActiveLibName() === tab.itemId) loreSyncToLib();
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

// Only re-render on a real change: these run on every keystroke
// An item was deleted from its library: close its tab without trying to save it
function wsDropItem(type, itemId) {
  const tab = wsItems.find(t => t.type === type && t.itemId === itemId);
  if (!tab) return;
  wsItems = wsItems.filter(t => t !== tab);
  if (wsActiveId === tab.id) {
    wsActiveId = wsItems.length ? wsItems[wsItems.length - 1].id : null;
    if (wsActiveId) { renderWsTabs(); wsActivate(wsActiveId); return; }
  }
  renderWsTabs();
}

function wsMarkUnsaved(type, itemId) {
  const tab = wsItems.find(t => t.type === type && t.itemId === itemId);
  if (tab && !tab.unsaved) { tab.unsaved = true; renderWsTabs(); }
}

function wsMarkSaved(type, itemId) {
  const tab = wsItems.find(t => t.type === type && t.itemId === itemId);
  if (tab && tab.unsaved) { tab.unsaved = false; renderWsTabs(); }
}

// ═══════════════════════════════════════════════════════
// AUTOSAVE
// Typing used to live only in the form until you pressed Save, so clicking to
// another workshop tab (or refreshing) rolled the field back to the last
// explicit save. Now the active editor is committed shortly after you stop
// typing, and always right before you leave it.
// Autosaves do NOT add version-history snapshots (that would burn the 10 slots
// in a few minutes): history still gets a snapshot on explicit Save and on
// closing a tab.
// ═══════════════════════════════════════════════════════
const AUTOSAVE_MS = 1500;
let autosaveTimer = null;

function commitActiveEditor() {
  clearTimeout(autosaveTimer); autosaveTimer = null;
  if (restoringBackup) return;
  try {
    if (mode === 'char') {
      // g('chName') = the character form is really what's on screen, so we
      // never build a card from an editor that isn't there
      if (charUnsaved && activeCharId && charLibrary[activeCharId] && g('chName')) {
        saveChar({ silent: true, noHistory: true });
      }
    } else if (mode === 'preset') {
      if (presetUnsaved && activePresetId && presetLibrary[activePresetId] && g('psName')) {
        savePreset({ silent: true, noHistory: true });
      }
    } else if (mode === 'lore') {
      let saved = false;
      [...unsaved].forEach(uid => {
        // only entries whose form is on screen (saveEntry reads the form)
        if (lorebook.entries && lorebook.entries[uid] && g('eName-' + uid)) {
          saveEntry(uid, { noSnapshot: true }); saved = true;
        }
      });
      if (saved && unsaved.size === 0) {
        const n = loreActiveLibName();
        if (n) wsMarkSaved('lore', n);
      }
    }
  } catch (e) {
    console.error('[LoreOS] autosave failed:', e);
    if (typeof toast === 'function') toast('Autosave hit a problem — press Save to be safe.', 'warn');
  }
}

function wsMarkActiveUnsaved() {
  if (mode === 'char' && activeCharId) wsMarkUnsaved('char', activeCharId);
  else if (mode === 'preset' && activePresetId) wsMarkUnsaved('preset', activePresetId);
  else if (mode === 'lore') { const n = loreActiveLibName(); if (n) wsMarkUnsaved('lore', n); }
}

function wireAutosave() {
  const onEdit = e => {
    const t = e.target;
    if (!t || !t.closest || !t.closest('#editorContent')) return;
    if (t.id === 'psPromptSearch') return; // search box, not content
    if (mode === 'char') charUnsaved = true;
    else if (mode === 'preset') presetUnsaved = true;
    wsMarkActiveUnsaved();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(commitActiveEditor, AUTOSAVE_MS);
  };
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);
  // Last chance: tab hidden / page closing
  document.addEventListener('visibilitychange', () => { if (document.hidden) commitActiveEditor(); });
  window.addEventListener('pagehide', commitActiveEditor);
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
      <span class="ws-tab-label" title="${esc(name)}">${esc(name)}</span>
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

  // Every tab change goes through here, so this is where tabs get persisted
  wsSaveTabs();
}

// ── Workshop tab persistence ──
// Tabs used to live only in memory, so a refresh closed every character and
// preset tab. (Lorebooks only looked like they survived because the working
// lorebook itself is saved in aet_lorebook.)
function wsSaveTabs() {
  // Don't persist anything until the saved tabs have been restored, or the
  // empty tab bar rendered during startup would overwrite them
  if (wsRestoring || !wsTabsRestored || restoringBackup) return;
  try {
    const active = wsItems.findIndex(t => t.id === wsActiveId);
    localStorage.setItem('aet_wsTabs', JSON.stringify({
      items: wsItems.map(t => ({ type: t.type, itemId: t.itemId })),
      active,
    }));
  } catch (e) {}
}

let wsRestoring = false;
let wsTabsRestored = false;
function wsRestoreTabs() {
  try { wsRestoreTabsInner(); } finally { wsTabsRestored = true; wsSaveTabs(); }
}
function wsRestoreTabsInner() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('aet_wsTabs') || 'null'); } catch (e) { saved = null; }
  if (!saved || !Array.isArray(saved.items) || !saved.items.length) return;

  // Drop tabs whose item was deleted since
  const lib = JSON.parse(localStorage.getItem('aet_library') || '{}');
  const exists = t =>
    t.type === 'lore'   ? !!lib[t.itemId] :
    t.type === 'char'   ? !!charLibrary[t.itemId] :
    t.type === 'preset' ? !!presetLibrary[t.itemId] : false;

  const activeSaved = saved.items[saved.active];
  wsItems = saved.items.filter(exists).slice(0, WS_MAX_TABS)
    .map(t => ({ id: wsTabId(), type: t.type, itemId: t.itemId, unsaved: false }));
  if (!wsItems.length) { wsActiveId = null; renderWsTabs(); return; }

  const activeTab = (activeSaved && wsItems.find(t => t.type === activeSaved.type && t.itemId === activeSaved.itemId)) || null;
  wsActiveId = activeTab ? activeTab.id : null;

  // Load the active item into the editor, then put the view back where the
  // router left it (cold loads still start on Home; the tabs are waiting in
  // the Workshop). switchMode() always navigates to the editor.
  const view = (typeof currentView !== 'undefined') ? currentView : null;
  wsRestoring = true;
  try {
    if (activeTab) {
      if (activeTab.type === 'lore') {
        // The working lorebook (aet_lorebook) is already loaded and is at
        // least as fresh as the library copy. Only switch modes, never
        // libLoad over it, or an unsaved import could be replaced.
        if (typeof switchMode === 'function') switchMode('lore');
      } else {
        wsActivate(activeTab.id);
      }
    }
  } finally {
    wsRestoring = false;
  }
  renderWsTabs();
  if (view && typeof navigateTo === 'function' && view !== 'editor') navigateTo(view);
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
    items = Object.values(lib).map(b => ({ id: b.name, name: b.name, savedAt: b.savedAt || '' }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } else if (type === 'char') {
    items = Object.values(charLibrary).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  } else if (type === 'preset') {
    items = Object.values(presetLibrary).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
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
      <span class="lib-name">${esc(entry.name || 'Unnamed')}</span>
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
// SIDEBAR RENDER
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// MODE SWITCHING
// ═══════════════════════════════════════════════════════
function switchMode(newMode) {
  // Save what's typed in the editor we're about to replace
  if (typeof commitActiveEditor === 'function') commitActiveEditor();
  // Stub modes — navigate to editor and show coming soon
  const STUB_MODES = ['persona', 'prompt', 'regex'];
  const isStub = STUB_MODES.includes(newMode);

  // Navigate to editor view when switching modes
  if (typeof navigateTo === 'function') navigateTo('editor');

  mode = newMode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === newMode));

  // View toggle only makes sense in lorebook mode
  g('viewToggle').style.display = newMode === 'lore' ? '' : 'none';
  if (newMode !== 'lore') { sideBySide = false; }

  // Show/hide mode headers (lore/char/preset have headers; stubs get empty placeholder)
  ['lore','char','preset','persona','prompt','regex'].forEach(m => {
    const el = g('hdr-' + m);
    if (el) el.style.display = newMode === m ? '' : 'none';
  });

  // Lorebook name input only in lorebook mode
  g('lorebookName').style.display = newMode === 'lore' ? '' : 'none';
  g('nameLabel').style.display = newMode === 'lore' ? '' : 'none';

  const sbTitle = g('sbTitle');
  g('entryList').innerHTML = '';
  g('tabBar').innerHTML = '';

  if (isStub) {
    const labels = { persona: 'Persona', prompt: 'Prompt', regex: 'Regex' };
    sbTitle.textContent = '' + (labels[newMode] || newMode);
    g('zoomRow').style.display = 'none';
    g('sbSearch').placeholder = 'Search...';
    g('editorContent').innerHTML = `
      <div class="empty-state" style="flex-direction:column;gap:.75rem">
        <div style="font-family:var(--fp);font-size:1.8rem;color:var(--p);opacity:.5;letter-spacing:2px">// coming soon</div>
        <div style="font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:1px">${labels[newMode] || newMode} editor is under construction.</div>
      </div>`;
    return;
  }

  // The sidebar lists whatever the current mode edits: entries, characters or presets
  const sidebar = g('sidebar');
  if (sidebar) sidebar.style.display = '';
  g('sbSearch').value = '';

  if (newMode === 'lore') {
    sbTitle.textContent = 'Entries';
    g('zoomRow').style.display = '';
    g('sbSearch').placeholder = 'Search entries...';
    renderList(); renderTabs(); renderEditor();
  } else if (newMode === 'char') {
    sbTitle.textContent = 'Characters';
    g('zoomRow').style.display = 'none';
    g('sbSearch').placeholder = 'Search characters...';
    renderCharSidebar(); renderCharEditor();
  } else if (newMode === 'preset') {
    sbTitle.textContent = 'Presets';
    g('zoomRow').style.display = 'none';
    g('sbSearch').placeholder = 'Search presets...';
    renderPresetSidebar(); renderPresetEditor();
  }
}
