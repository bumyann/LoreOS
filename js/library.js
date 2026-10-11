// ═══════════════════════════════════════════════════════
// LIBRARY — the saved-lorebook library dialog (save, load, rename, delete).
// ═══════════════════════════════════════════════════════

function openLibrary() {
  g('libModalTitle').textContent = 'Lorebook Library';
  g('libSaveBtn').parentElement.style.display = '';
  g('libNewName').value = g('lorebookName').value.trim();
  renderLibraryList();
  openModal('libModal');
}

function renderLibraryList() {
  const lib = libGet();
  const container = g('libList');
  container.innerHTML = '';
  const books = Object.values(lib).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  if (!books.length) {
    container.innerHTML = '<div class="lib-empty">// no saved lorebooks yet</div>';
    return;
  }
  const curName = g('lorebookName').value.trim();
  books.forEach(book => {
    const count = Object.keys(book.lb.entries || {}).length;
    const date = new Date(book.savedAt).toLocaleDateString();
    const item = document.createElement('div');
    item.className = 'lib-item' + (book.name === curName ? ' active' : '');
    item.innerHTML = `
      <span class="lib-name" title="Load ${esc(book.name)}">${esc(book.name)}</span>
      <span class="lib-meta">${count} entries · ${date}</span>
      <div class="lib-acts">
        <button class="btn btn-s btn-sm lib-load">Load</button>
        <button class="btn btn-s btn-sm lib-rename">Rename</button>
        <button class="btn btn-s btn-sm lib-hist lib-item-hist" title="Version history">🕓</button>
        <button class="btn btn-err btn-sm lib-del">✕</button>
      </div>`;
    item.querySelector('.lib-name').addEventListener('click', () => libLoad(book.name));
    item.querySelector('.lib-load').addEventListener('click', () => libLoad(book.name));
    item.querySelector('.lib-rename').addEventListener('click', () => libRename(book.name));
    item.querySelector('.lib-hist').addEventListener('click', () => { if (typeof openItemHistory === 'function') openItemHistory('lore', book.name); });
    item.querySelector('.lib-del').addEventListener('click', () => libDelete(book.name));
    container.append(item);
  });
}

async function libSaveCurrent() {
  const name = (g('libNewName').value.trim() || g('lorebookName').value.trim() || 'Untitled').substring(0, 60);
  const lib = libGet();
  if (lib[name] && !await askConfirm(`"${name}" already exists. Overwrite?`)) return;
  // Keep any existing history when overwriting an entry of the same name
  lib[name] = { ...(lib[name] || {}), name, lb: JSON.parse(JSON.stringify(lorebook)), savedAt: new Date().toISOString() };
  libSet(lib);
  // From now on, edits to this lorebook write through to this library entry
  if (typeof loreLinkToLib === 'function') loreLinkToLib(name);
  // ...and it gets a workshop tab (a saved lorebook is what a tab points at)
  if (typeof wsShowItem === 'function') wsShowItem('lore', name);
  // Snapshot on every explicit save to library
  if (typeof itemHistoryPush === 'function') itemHistoryPush('lore', name, lib[name]);
  g('libNewName').value = '';
  renderLibraryList();
  toast(`Saved "${name}" to library.`, 'ok');
}

async function libLoad(name) {
  const lib = libGet();
  const book = lib[name]; if (!book) return;
  if (unsaved.size > 0 && !await askConfirm('You have unsaved changes. Load anyway?')) return;
  lorebook = JSON.parse(JSON.stringify(book.lb));
  openTabs = []; activeTabId = null; unsaved = new Set(); formState = {};

  lorebook.entries = rebuildEntries(lorebook.entries);
  nextUid = Object.keys(lorebook.entries).length
    ? Math.max(...Object.keys(lorebook.entries).map(Number)) + 1
    : 0;

  g('lorebookName').value = lorebook.name || name;
  if (typeof loreLinkToLib === 'function') loreLinkToLib(name);
  renderList(); renderTabs(); renderEditor();
  saveToStorage();
  closeModal('libModal');
  toast(`Loaded "${name}".`, 'ok');
}

async function libRename(oldName) {
  g('renameModalTitle').textContent = 'Rename Lorebook';
  const newName = await askInput(`Rename "${oldName}" to:`, oldName);
  if (!newName || newName.trim() === oldName) return;
  const trimmed = newName.trim().substring(0, 60);
  const lib = libGet();
  if (lib[trimmed] && !await askConfirm(`"${trimmed}" exists. Overwrite?`)) return;
  lib[trimmed] = { ...lib[oldName], name: trimmed };
  delete lib[oldName];
  libSet(lib);
  // Keep the open lorebook (and any open workshop tab) pointed at the new name
  if (typeof loreActiveLibName === 'function' && loreActiveLibName() === oldName) loreLinkToLib(trimmed);
  if (typeof wsItems !== 'undefined') {
    wsItems.forEach(t => { if (t.type === 'lore' && t.itemId === oldName) t.itemId = trimmed; });
    if (typeof renderWsTabs === 'function') renderWsTabs();
  }
  renderLibraryList();
  toast(`Renamed to "${trimmed}".`, 'ok');
}

async function libDelete(name) {
  if (!await askConfirm(`Delete "${name}" from library?`)) return;
  const lib = libGet();
  delete lib[name];
  libSet(lib);
  if (typeof wsDropItem === 'function') wsDropItem('lore', name);
  if (typeof loreActiveLibName === 'function' && loreActiveLibName() === name) loreLinkToLib(null);
  renderLibraryList();
  toast(`Deleted "${name}".`, 'info');
}
