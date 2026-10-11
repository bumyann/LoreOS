// ═══════════════════════════════════════════════════════
// WORKSHOP — the tab bar (up to 5 open items), autosave, mode switching and tab restore.
// ═══════════════════════════════════════════════════════

import { openChar, renderCharEditor, renderCharSidebar, saveChar } from './character.js';
import { itemHistoryPush } from './history.js';
import { libLoad } from './library.js';
import { renderEditor, renderList, renderTabs, saveEntry } from './lorebook.js';
import { mobileAfterModeSwitch } from './mobile.js';
import { openPreset, renderPresetEditor, renderPresetSidebar, savePreset } from './preset.js';
import { currentView, navigateTo } from './router.js';
import { state, WS_MAX_TABS } from './state.js';
import { loreActiveLibName, loreSyncToLib } from './storage.js';
import { closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import { fitHeader } from './header_fit.js';
import { openPrompt, renderPromptEditor, renderPromptSidebar, savePrompt } from './prompt.js';
import { openRegex, renderRegexEditor, renderRegexSidebar, saveRegex } from './regex.js';
import { store } from './kv.js';

// ═══════════════════════════════════════════════════════
// WORKSHOP TABS
// ═══════════════════════════════════════════════════════

export function wsTabId() { return state.wsNextId++; }

export function wsOpenItem(type, itemId) {
  // If already open, just focus it
  const existing = state.wsItems.find(t => t.type === type && t.itemId === itemId);
  if (existing) { wsActivate(existing.id); return; }

  if (state.wsItems.length >= WS_MAX_TABS) {
    toast(`Max ${WS_MAX_TABS} tabs open — close one first.`, 'warn');
    return;
  }

  const tab = { id: wsTabId(), type, itemId, unsaved: false };
  state.wsItems.push(tab);
  wsActivate(tab.id);
  closeModal('wsPickerModal');
}

// Open a freshly created / imported / duplicated item in a workshop tab (or
// focus its tab if it already has one). Returns false when the tab bar is
// full, so the caller can still open the item without a tab.
export function wsShowItem(type, itemId) {
  const has = state.wsItems.some(t => t.type === type && t.itemId === itemId);
  if (!has && state.wsItems.length >= WS_MAX_TABS) {
    toast(`Max ${WS_MAX_TABS} tabs open — close one to get a tab for this.`, 'warn');
    return false;
  }
  wsOpenItem(type, itemId);
  return true;
}

export function wsActivate(tabId) {
  // Whatever is typed in the editor we're leaving is saved first, so
  // switching tabs can never roll a field back to the last explicit save
  commitActiveEditor();
  state.wsActiveId = tabId;
  const tab = state.wsItems.find(t => t.id === tabId);
  if (!tab) return;
  renderWsTabs();
  // Switch editor mode and load the item
  if (tab.type === 'lore') {
    switchMode('lore');
    // Already the open lorebook (its edits write through to the library), so
    // don't reload it: that would close its open entry tabs for nothing
    if (loreActiveLibName() === tab.itemId) {
      // nothing to load
    } else {
      // lorebooks keyed by name
      libLoad(tab.itemId);
    }
  } else if (tab.type === 'char') {
    switchMode('char');
    openChar(tab.itemId);
  } else if (tab.type === 'preset') {
    switchMode('preset');
    openPreset(tab.itemId);
  } else if (tab.type === 'prompt') {
    switchMode('prompt');
    openPrompt(tab.itemId);
  } else if (tab.type === 'regex') {
    switchMode('regex');
    openRegex(tab.itemId);
  }
}

export function wsCloseTab(tabId) {
  const tab = state.wsItems.find(t => t.id === tabId);
  if (!tab) return;

  // Autosave before closing (the active tab is the one whose editor is on screen)
  if (tab.id === state.wsActiveId) commitActiveEditor();
  if (tab.type === 'lore') {
    if (loreActiveLibName() === tab.itemId) loreSyncToLib();
    const lib = JSON.parse(store.get('aet_library') || '{}');
    if (lib[tab.itemId]) itemHistoryPush('lore', tab.itemId, lib[tab.itemId]);
  } else if (tab.type === 'char') {
    if (state.charLibrary[tab.itemId]) itemHistoryPush('char', tab.itemId, JSON.parse(JSON.stringify(state.charLibrary[tab.itemId])));
  } else if (tab.type === 'preset') {
    if (state.presetLibrary[tab.itemId]) itemHistoryPush('preset', tab.itemId, JSON.parse(JSON.stringify(state.presetLibrary[tab.itemId])));
  } else if (tab.type === 'prompt') {
    if (state.promptLibrary[tab.itemId]) itemHistoryPush('prompt', tab.itemId, JSON.parse(JSON.stringify(state.promptLibrary[tab.itemId])));
  } else if (tab.type === 'regex') {
    if (state.regexLibrary[tab.itemId]) itemHistoryPush('regex', tab.itemId, JSON.parse(JSON.stringify(state.regexLibrary[tab.itemId])));
  }

  state.wsItems = state.wsItems.filter(t => t.id !== tabId);

  // Focus adjacent tab if we closed the active one
  if (state.wsActiveId === tabId) {
    state.wsActiveId = state.wsItems.length ? state.wsItems[state.wsItems.length - 1].id : null;
    if (state.wsActiveId) wsActivate(state.wsActiveId);
    else renderWsTabs();
  } else {
    renderWsTabs();
  }
}

// Only re-render on a real change: these run on every keystroke
// An item was deleted from its library: close its tab without trying to save it
export function wsDropItem(type, itemId) {
  const tab = state.wsItems.find(t => t.type === type && t.itemId === itemId);
  if (!tab) return;
  state.wsItems = state.wsItems.filter(t => t !== tab);
  if (state.wsActiveId === tab.id) {
    state.wsActiveId = state.wsItems.length ? state.wsItems[state.wsItems.length - 1].id : null;
    if (state.wsActiveId) { renderWsTabs(); wsActivate(state.wsActiveId); return; }
  }
  renderWsTabs();
}

export function wsMarkUnsaved(type, itemId) {
  const tab = state.wsItems.find(t => t.type === type && t.itemId === itemId);
  if (tab && !tab.unsaved) { tab.unsaved = true; renderWsTabs(); }
}

export function wsMarkSaved(type, itemId) {
  const tab = state.wsItems.find(t => t.type === type && t.itemId === itemId);
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
export const AUTOSAVE_MS = 1500;
export let autosaveTimer = null;

// Drop a pending autosave (a restore is about to replace the data it would write)
export function cancelAutosave() { clearTimeout(autosaveTimer); autosaveTimer = null; }

export function commitActiveEditor() {
  clearTimeout(autosaveTimer); autosaveTimer = null;
  if (state.restoringBackup) return;
  try {
    if (state.mode === 'char') {
      // g('chName') = the character form is really what's on screen, so we
      // never build a card from an editor that isn't there
      if (state.charUnsaved && state.activeCharId && state.charLibrary[state.activeCharId] && g('chName')) {
        saveChar({ silent: true, noHistory: true });
      }
    } else if (state.mode === 'preset') {
      if (state.presetUnsaved && state.activePresetId && state.presetLibrary[state.activePresetId] && g('psName')) {
        savePreset({ silent: true, noHistory: true });
      }
    } else if (state.mode === 'prompt') {
      if (state.promptUnsaved && state.activePromptId && state.promptLibrary[state.activePromptId] && g('prName')) {
        savePrompt({ silent: true, noHistory: true });
      }
    } else if (state.mode === 'regex') {
      if (state.regexUnsaved && state.activeRegexId && state.regexLibrary[state.activeRegexId] && g('rxName')) {
        saveRegex({ silent: true, noHistory: true });
      }
    } else if (state.mode === 'lore') {
      let saved = false;
      [...state.unsaved].forEach(uid => {
        // only entries whose form is on screen (saveEntry reads the form)
        if (state.lorebook.entries && state.lorebook.entries[uid] && g('eName-' + uid)) {
          saveEntry(uid, { noSnapshot: true }); saved = true;
        }
      });
      if (saved && state.unsaved.size === 0) {
        const n = loreActiveLibName();
        if (n) wsMarkSaved('lore', n);
      }
    }
  } catch (e) {
    console.error('[LoreOS] autosave failed:', e);
    toast('Autosave hit a problem — press Save to be safe.', 'warn');
  }
}

export function wsMarkActiveUnsaved() {
  if (state.mode === 'char' && state.activeCharId) wsMarkUnsaved('char', state.activeCharId);
  else if (state.mode === 'preset' && state.activePresetId) wsMarkUnsaved('preset', state.activePresetId);
  else if (state.mode === 'prompt' && state.activePromptId) wsMarkUnsaved('prompt', state.activePromptId);
  else if (state.mode === 'regex' && state.activeRegexId) wsMarkUnsaved('regex', state.activeRegexId);
  else if (state.mode === 'lore') { const n = loreActiveLibName(); if (n) wsMarkUnsaved('lore', n); }
}

export function wireAutosave() {
  const onEdit = e => {
    const t = e.target;
    if (!t || !t.closest || !t.closest('#editorContent')) return;
    if (t.id === 'psPromptSearch') return; // search box, not content
    if (state.mode === 'char') state.charUnsaved = true;
    else if (state.mode === 'preset') state.presetUnsaved = true;
    else if (state.mode === 'prompt') state.promptUnsaved = true;
    else if (state.mode === 'regex') state.regexUnsaved = true;
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

export function renderWsTabs() {
  const bar = g('workshopTabs');
  if (!bar) return;
  bar.innerHTML = '';

  const TYPE_LABEL = { lore: 'LB', char: 'CH', preset: 'PS', prompt: 'PR', regex: 'RX' };

  state.wsItems.forEach(tab => {
    let name = '...';
    if (tab.type === 'lore') {
      const lib = JSON.parse(store.get('aet_library') || '{}');
      name = lib[tab.itemId]?.name || 'Untitled';
    } else if (tab.type === 'char') {
      name = state.charLibrary[tab.itemId]?.name || 'Untitled';
    } else if (tab.type === 'preset') {
      name = state.presetLibrary[tab.itemId]?.name || 'Untitled';
    } else if (tab.type === 'prompt') {
      name = state.promptLibrary[tab.itemId]?.name || 'Untitled';
    } else if (tab.type === 'regex') {
      name = state.regexLibrary[tab.itemId]?.name || 'Untitled';
    }

    const el = document.createElement('div');
    el.className = 'ws-tab' + (tab.id === state.wsActiveId ? ' active' : '') + (tab.unsaved ? ' unsaved' : '');
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
  if (addBtn) addBtn.style.opacity = state.wsItems.length >= WS_MAX_TABS ? '.35' : '1';

  // Every tab change goes through here, so this is where tabs get persisted
  wsSaveTabs();
}

// ── Workshop tab persistence ──
// Tabs used to live only in memory, so a refresh closed every character and
// preset tab. (Lorebooks only looked like they survived because the working
// lorebook itself is saved in aet_lorebook.)
export function wsSaveTabs() {
  // Don't persist anything until the saved tabs have been restored, or the
  // empty tab bar rendered during startup would overwrite them
  if (wsRestoring || !wsTabsRestored || state.restoringBackup) return;
  try {
    const active = state.wsItems.findIndex(t => t.id === state.wsActiveId);
    localStorage.setItem('aet_wsTabs', JSON.stringify({
      items: state.wsItems.map(t => ({ type: t.type, itemId: t.itemId })),
      active,
    }));
  } catch (e) {}
}

export let wsRestoring = false;
export let wsTabsRestored = false;
export function wsRestoreTabs() {
  try { wsRestoreTabsInner(); } finally { wsTabsRestored = true; wsSaveTabs(); }
}
export function wsRestoreTabsInner() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('aet_wsTabs') || 'null'); } catch (e) { saved = null; }
  if (!saved || !Array.isArray(saved.items) || !saved.items.length) return;

  // Drop tabs whose item was deleted since
  const lib = JSON.parse(store.get('aet_library') || '{}');
  const exists = t =>
    t.type === 'lore'   ? !!lib[t.itemId] :
    t.type === 'char'   ? !!state.charLibrary[t.itemId] :
    t.type === 'preset' ? !!state.presetLibrary[t.itemId] :
    t.type === 'prompt' ? !!state.promptLibrary[t.itemId] :
    t.type === 'regex' ? !!state.regexLibrary[t.itemId] : false;

  const activeSaved = saved.items[saved.active];
  state.wsItems = saved.items.filter(exists).slice(0, WS_MAX_TABS)
    .map(t => ({ id: wsTabId(), type: t.type, itemId: t.itemId, unsaved: false }));
  if (!state.wsItems.length) { state.wsActiveId = null; renderWsTabs(); return; }

  const activeTab = (activeSaved && state.wsItems.find(t => t.type === activeSaved.type && t.itemId === activeSaved.itemId)) || null;
  state.wsActiveId = activeTab ? activeTab.id : null;

  // Load the active item into the editor, then put the view back where the
  // router left it (cold loads still start on Home; the tabs are waiting in
  // the Workshop). switchMode() always navigates to the editor.
  const view = currentView;
  wsRestoring = true;
  try {
    if (activeTab) {
      if (activeTab.type === 'lore') {
        // The working lorebook (aet_lorebook) is already loaded and is at
        // least as fresh as the library copy. Only switch modes, never
        // libLoad over it, or an unsaved import could be replaced.
        switchMode('lore');
      } else {
        wsActivate(activeTab.id);
      }
    }
  } finally {
    wsRestoring = false;
  }
  renderWsTabs();
  if (view && view !== 'editor') navigateTo(view);
}

export function openWsPicker() {
  if (state.wsItems.length >= WS_MAX_TABS) { toast(`Max ${WS_MAX_TABS} tabs open.`, 'warn'); return; }
  // Reset to lorebook tab
  document.querySelectorAll('.ws-picker-type').forEach(b => b.classList.toggle('active', b.dataset.type === 'lore'));
  renderWsPickerList('lore');
  openModal('wsPickerModal');
}

export function renderWsPickerList(type) {
  const list = g('wsPickerList');
  if (!list) return;
  list.innerHTML = '';

  let items = [];
  if (type === 'lore') {
    const lib = JSON.parse(store.get('aet_library') || '{}');
    // Lorebook lib: { [name]: { name, lb, savedAt } } — add name as id for consistency
    items = Object.values(lib).map(b => ({ id: b.name, name: b.name, savedAt: b.savedAt || '' }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } else if (type === 'char') {
    items = Object.values(state.charLibrary).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  } else if (type === 'preset') {
    items = Object.values(state.presetLibrary).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  } else if (type === 'prompt') {
    items = Object.values(state.promptLibrary).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  } else if (type === 'regex') {
    items = Object.values(state.regexLibrary).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  }

  if (!items.length) {
    list.innerHTML = `<div class="lib-empty">// no ${type === 'lore' ? 'lorebooks' : type === 'char' ? 'characters' : type === 'prompt' ? 'prompt packs' : type === 'regex' ? 'regex sets' : 'presets'} saved yet</div>`;
    return;
  }

  const alreadyOpen = new Set(state.wsItems.filter(t => t.type === type).map(t => t.itemId));

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
// Switch the editor to lorebook / character / preset (or a "coming soon" stub).
// The phone nav follows along through mobileAfterModeSwitch.
export function switchMode(newMode) {
  applyMode(newMode);
  mobileAfterModeSwitch(newMode);
  fitHeader();
}

export function applyMode(newMode) {
  // Save what's typed in the editor we're about to replace
  commitActiveEditor();
  // Stub modes — navigate to editor and show coming soon
  const STUB_MODES = [];
  const isStub = STUB_MODES.includes(newMode);

  // Navigate to editor view when switching modes
  navigateTo('editor');

  state.mode = newMode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === newMode));

  // View toggle only makes sense in lorebook mode
  g('viewToggle').style.display = newMode === 'lore' ? '' : 'none';
  if (newMode !== 'lore') { state.sideBySide = false; }

  // Show/hide mode headers (lore/char/preset have headers; stubs get empty placeholder)
  ['lore','char','preset','prompt','regex'].forEach(m => {
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
    const labels = { regex: 'Regex' };
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
  } else if (newMode === 'prompt') {
    sbTitle.textContent = 'Prompt packs';
    g('zoomRow').style.display = 'none';
    g('sbSearch').placeholder = 'Search packs...';
    renderPromptSidebar(); renderPromptEditor();
  } else if (newMode === 'regex') {
    sbTitle.textContent = 'Regex sets';
    g('zoomRow').style.display = 'none';
    g('sbSearch').placeholder = 'Search sets...';
    renderRegexSidebar(); renderRegexEditor();
  }
}

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(270, `<!-- WORKSHOP TAB PICKER MODAL -->
<div id="wsPickerModal" class="modal">
  <div class="modal-box" style="max-width:420px">
    <div class="modal-head"><h2>Open Item</h2><button class="modal-x" data-close="wsPickerModal">×</button></div>
    <div class="modal-body">
      <div style="display:flex;gap:.3rem;margin-bottom:.75rem" id="wsPickerTypeTabs">
        <button class="ws-picker-type active" data-type="lore">Lorebook</button>
        <button class="ws-picker-type" data-type="char">Character</button>
        <button class="ws-picker-type" data-type="preset">Preset</button>
        <button class="ws-picker-type" data-type="prompt">Prompt</button>
        <button class="ws-picker-type" data-type="regex">Regex</button>
      </div>
      <div id="wsPickerList" class="lib-list" style="max-height:300px"></div>
    </div>
  </div>
</div>`);

