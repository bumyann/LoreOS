// ═══════════════════════════════════════════════════════
// ATTACHED LOREBOOK (character_book field)
// Supports multiple attached lorebooks merged into one character_book.
// Raw sources live on the library entry (entry.attachedLbSources), NOT
// inside card.data, so they never leak into exported card JSON.
// ═══════════════════════════════════════════════════════

function updateLbStatus(entry) {
  const statusEl = g('chLbStatus');
  if (!statusEl) return;
  const sources = entry?.attachedLbSources || [];
  const cb = entry?.card?.data?.character_book;
  if (cb && cb.entries && Object.keys(cb.entries).length > 0) {
    const count = Object.keys(cb.entries).length;
    if (sources.length > 1) {
      statusEl.innerHTML = `🌐 <strong>${sources.length} lorebooks merged</strong> — ${count} ${count === 1 ? 'entry' : 'entries'} total`;
    } else {
      const name = sources.length === 1 ? sources[0].name : (cb.name || 'Unnamed lorebook');
      statusEl.innerHTML = `🌐 <strong>${name}</strong> — ${count} ${count === 1 ? 'entry' : 'entries'} attached`;
    }
  } else {
    statusEl.textContent = '🌐 No lorebook attached';
  }
}

// Rebuild card.data.character_book fresh from every attached source,
// remapping entry uids so entries from different lorebooks never collide.
function rebuildCharacterBook(entry) {
  const sources = entry.attachedLbSources || [];
  if (!sources.length) { entry.card.data.character_book = null; return; }
  const merged = {};
  let nextUid = 0;
  sources.forEach(src => {
    Object.values(src.lb.entries || {}).forEach(en => {
      const clone = JSON.parse(JSON.stringify(en));
      clone.uid = nextUid;
      clone.displayIndex = nextUid;
      if ('order' in clone) clone.order = nextUid;
      merged[nextUid] = clone;
      nextUid++;
    });
  });
  const name = sources.length === 1 ? (sources[0].name || 'Attached Lorebook') : `${sources.length} lorebooks merged`;
  entry.card.data.character_book = { name, entries: merged };
}

function renderAttachLbList() {
  const list = g('attachLbLibList');
  if (!list) return;
  list.innerHTML = '';
  const lib = libGet();
  const books = Object.values(lib).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  const entry = charLibrary[activeCharId];
  const attachedNames = new Set((entry?.attachedLbSources || []).map(s => s.name));

  if (!books.length) {
    list.innerHTML = '<div class="lib-empty">// no lorebooks in library yet</div>';
    return;
  }
  books.forEach(book => {
    const count = Object.keys(book.lb.entries || {}).length;
    const date = new Date(book.savedAt).toLocaleDateString();
    const isAttached = attachedNames.has(book.name);
    const item = document.createElement('div');
    item.className = 'lib-item' + (isAttached ? ' active' : '');
    item.innerHTML = `
      <span class="lib-name">${book.name}${isAttached ? ' ✓' : ''}</span>
      <span class="lib-meta">${count} entries · ${date}</span>
      <button class="btn ${isAttached ? 'btn-err' : 'btn-p'} btn-sm">${isAttached ? 'Detach' : 'Attach'}</button>`;
    item.querySelector('.btn').addEventListener('click', () => {
      if (isAttached) detachOneLorebook(book.name);
      else attachLorebook(book.lb);
    });
    list.append(item);
  });
}

function openAttachLbModal() {
  if (!activeCharId) { toast('Open a character first.', 'warn'); return; }
  renderAttachLbList();

  g('attachLbUploadBtn').onclick = () => g('attachLbFileInput').click();
  g('attachLbFileInput').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const lb = JSON.parse(ev.target.result);
        attachLorebook(lb);
      } catch(err) { toast('Invalid lorebook JSON.', 'err'); }
    };
    r.readAsText(file);
    e.target.value = '';
  };
  g('attachLbDetachBtn').onclick = detachLorebook;
  openModal('attachLbModal');
}

// Attach one more lorebook on top of whatever's already attached — merges
// rather than replaces. Re-attaching the same name refreshes its entries.
function attachLorebook(lb) {
  if (!activeCharId || !charLibrary[activeCharId]) return;
  const entry = charLibrary[activeCharId];
  if (!entry.attachedLbSources) entry.attachedLbSources = [];
  const name = lb.name || 'Attached Lorebook';
  const existingIdx = entry.attachedLbSources.findIndex(s => s.name === name);
  if (existingIdx > -1) {
    entry.attachedLbSources[existingIdx] = { name, lb };
    toast(`"${name}" refreshed.`, 'ok');
  } else {
    entry.attachedLbSources.push({ name, lb });
    toast(`"${name}" attached.`, 'ok');
  }
  rebuildCharacterBook(entry);
  saveCharLibrary();
  updateLbStatus(entry);
  renderAttachLbList(); // keep modal open so more can be attached
}

// Detach a single attached lorebook by name, keeping the rest merged.
function detachOneLorebook(name) {
  const entry = charLibrary[activeCharId]; if (!entry) return;
  entry.attachedLbSources = (entry.attachedLbSources || []).filter(s => s.name !== name);
  rebuildCharacterBook(entry);
  saveCharLibrary();
  updateLbStatus(entry);
  renderAttachLbList();
  toast(`"${name}" detached.`, 'ok');
}

// Detach everything at once (the modal's "Detach All" button).
function detachLorebook() {
  if (!activeCharId || !charLibrary[activeCharId]) return;
  const entry = charLibrary[activeCharId];
  entry.attachedLbSources = [];
  entry.card.data.character_book = null;
  saveCharLibrary();
  updateLbStatus(entry);
  renderAttachLbList();
  toast('All lorebooks detached.', 'ok');
}
// ═══════════════════════════════════════════════════════
// PRESET VARIABLES PANEL
// ═══════════════════════════════════════════════════════

function scanAndRenderVars() {
  const entry = presetLibrary[activePresetId];
  if (!entry) return;
  const vars = extractVars(entry.preset);
  const container = g('psVarsList');
  if (!container) return;
  container.innerHTML = '';

  if (!Object.keys(vars).length) {
    container.innerHTML = '<div style="font-family:var(--fx);font-size:.75rem;color:var(--txm)">// no setvar patterns found in this preset</div>';
    return;
  }

  // Open the panel automatically after scan
  g('psVarsBody').classList.add('open');
  g('psVarsArr').classList.add('open');
  g('psVarsHead').classList.add('open');

  Object.entries(vars).forEach(([varName, values]) => {
    const block = document.createElement('div');
    block.style.cssText = 'background:var(--bg3);border:1px solid var(--bd);border-radius:4px;overflow:hidden';

    // Header with variable name + rename button
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:.5rem;padding:.45rem .65rem;border-bottom:1px solid var(--bd);background:var(--sf)';

    const nameLabel = document.createElement('span');
    nameLabel.style.cssText = 'font-family:var(--fp);font-size:1rem;color:var(--p);letter-spacing:1px;flex:1';
    nameLabel.textContent = varName;

    const countBadge = document.createElement('span');
    countBadge.style.cssText = 'font-family:var(--fx);font-size:.62rem;padding:1px 5px;background:var(--sf2);border:1px solid var(--bd);border-radius:2px;color:var(--txm)';
    countBadge.textContent = `${values.length} value${values.length !== 1 ? 's' : ''}`;

    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn btn-s btn-sm';
    renameBtn.textContent = 'Rename';
    renameBtn.style.flexShrink = '0';
    renameBtn.addEventListener('click', () => renameVar(varName));

    head.append(nameLabel, countBadge, renameBtn);
    block.append(head);

    // Values list
    const valuesList = document.createElement('div');
    valuesList.style.cssText = 'display:flex;flex-direction:column;gap:0';

    values.forEach((val, i) => {
      const row = document.createElement('div');
      row.style.cssText = `padding:.35rem .65rem;font-family:var(--fb);font-size:.78rem;color:var(--txd);line-height:1.5;border-bottom:${i < values.length - 1 ? '1px solid var(--bd)' : 'none'}`;
      // Show first line of value as preview
      const firstLine = val.split('\n')[0].trim();
      const preview = firstLine.length > 80 ? firstLine.substring(0, 80) + '…' : firstLine;
      row.textContent = preview;
      row.title = val; // full value on hover
      valuesList.append(row);
    });

    block.append(valuesList);
    container.append(block);
  });
}

// Parse all prompt content for {{setvar::name::value}} patterns
function extractVars(preset) {
  const vars = {};
  const re = /\{\{setvar::([^:}]+)::([^}]*)\}\}/g;
  (preset.prompts || []).forEach(pr => {
    const text = pr.content || '';
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].trim();
      const value = m[2].trim();
      if (!vars[name]) vars[name] = [];
      if (!vars[name].includes(value)) vars[name].push(value);
    }
  });
  return vars;
}

// Rename a variable across all prompt content (setvar + getvar)
async function renameVar(oldName) {
  g('renameModalTitle').textContent = 'Rename Variable';
  const newName = await askInput(`Rename variable "${oldName}" to:`, oldName);
  if (!newName || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    toast('Variable names can only contain letters, numbers, and underscores.', 'err');
    return;
  }

  const entry = presetLibrary[activePresetId]; if (!entry) return;
  let count = 0;

  (entry.preset.prompts || []).forEach(pr => {
    if (!pr.content) return;
    const before = pr.content;
    pr.content = pr.content
      .replace(new RegExp(`\\{\\{setvar::${escapeRegex(oldName)}::`, 'g'), `{{setvar::${trimmed}::`)
      .replace(new RegExp(`\\{\\{getvar::${escapeRegex(oldName)}\\}\\}`, 'g'), `{{getvar::${trimmed}}}`)
      .replace(new RegExp(`\\{\\{getvar::${escapeRegex(oldName)}\\|`, 'g'), `{{getvar::${trimmed}|`);
    if (pr.content !== before) count++;
  });

  savePresetLibrary();
  renderPromptList(entry.preset.prompts);
  scanAndRenderVars(); // re-scan after rename
  toast(`Renamed "${oldName}" → "${trimmed}" across ${count} prompt${count !== 1 ? 's' : ''}.`, 'ok');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
