// ═══════════════════════════════════════════════════════
// ATTACHED LOREBOOK (character_book field)
// ═══════════════════════════════════════════════════════

function updateLbStatus(entry) {
  const statusEl = g('chLbStatus');
  if (!statusEl) return;
  const cb = entry?.card?.data?.character_book;
  if (cb && cb.entries && Object.keys(cb.entries).length > 0) {
    const count = Object.keys(cb.entries).length;
    const name = cb.name || 'Unnamed lorebook';
    statusEl.innerHTML = `🌐 <strong>${name}</strong> — ${count} ${count === 1 ? 'entry' : 'entries'} attached`;
  } else {
    statusEl.textContent = '🌐 No lorebook attached';
  }
}

function openAttachLbModal() {
  if (!activeCharId) { toast('Open a character first.', 'warn'); return; }
  const list = g('attachLbLibList');
  list.innerHTML = '';
  const lib = libGet();
  const books = Object.values(lib).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  const entry = charLibrary[activeCharId];
  const current = entry?.card?.data?.character_book?.name;

  if (!books.length) {
    list.innerHTML = '<div class="lib-empty">// no lorebooks in library yet</div>';
  } else {
    books.forEach(book => {
      const count = Object.keys(book.lb.entries || {}).length;
      const date = new Date(book.savedAt).toLocaleDateString();
      const isAttached = book.name === current;
      const item = document.createElement('div');
      item.className = 'lib-item' + (isAttached ? ' active' : '');
      item.innerHTML = `
        <span class="lib-name">${book.name}${isAttached ? ' ✓' : ''}</span>
        <span class="lib-meta">${count} entries · ${date}</span>
        <button class="btn btn-p btn-sm">${isAttached ? 'Re-attach' : 'Attach'}</button>`;
      item.querySelector('.btn').addEventListener('click', () => attachLorebook(book.lb));
      list.append(item);
    });
  }

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

function attachLorebook(lb) {
  if (!activeCharId || !charLibrary[activeCharId]) return;
  const entry = charLibrary[activeCharId];
  // Convert to character_book format (ST expects entries as array or object)
  entry.card.data.character_book = {
    name: lb.name || 'Attached Lorebook',
    entries: lb.entries || {}
  };
  saveCharLibrary();
  updateLbStatus(entry);
  closeModal('attachLbModal');
  toast(`Lorebook "${entry.card.data.character_book.name}" attached.`, 'ok');
}

function detachLorebook() {
  if (!activeCharId || !charLibrary[activeCharId]) return;
  charLibrary[activeCharId].card.data.character_book = null;
  saveCharLibrary();
  updateLbStatus(charLibrary[activeCharId]);
  closeModal('attachLbModal');
  toast('Lorebook detached.', 'ok');
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
  g('renameModalTitle').textContent = '// Rename Variable';
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
