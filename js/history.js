// ═══════════════════════════════════════════════════════
// HISTORY — field-level undo/redo, item-level undo/redo, and per-item version history.
// ═══════════════════════════════════════════════════════

import { openChar } from './character.js';
import { renderEditor, renderList, renderTabs } from './lorebook.js';
import { rebuildEntries } from './lorebook_model.js';
import { openPreset } from './preset.js';
import { openPrompt } from './prompt.js';
import { openRegex } from './regex.js';
import { state } from './state.js';
import { loreActiveLibName, loreLinkToLib, loreSyncToLib, lzPack, lzUnpack, safeSet, saveCharLibrary, savePresetLibrary, savePromptLibrary, saveRegexLibrary, saveToStorage } from './storage.js';
import { askConfirm, dlFile, esc, g, toast } from './util.js';
import { store } from './kv.js';

// ═══════════════════════════════════════════════════════
// FIELD-LEVEL UNDO/REDO
// Attaches native undo/redo button pair to any textarea.
// Per-field history stack, debounced push on input.
// ═══════════════════════════════════════════════════════

export const FIELD_HIST_MAX = 80;
export const FIELD_HIST_DEBOUNCE = 400; // ms

export function attachFieldUndoRedo(ta) {
  if (!ta || ta._undoAttached) return;
  ta._undoAttached = true;

  const stack = [ta.value];
  let ptr = 0;
  let debounceTimer = null;

  ta.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      stack.splice(ptr + 1);
      stack.push(ta.value);
      if (stack.length > FIELD_HIST_MAX) stack.shift();
      ptr = stack.length - 1;
      syncBtns();
    }, FIELD_HIST_DEBOUNCE);
  });

  function applyState(val) {
    ta.value = val;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function undo() {
    clearTimeout(debounceTimer);
    if (ptr > 0) { ptr--; applyState(stack[ptr]); syncBtns(); }
  }

  function redo() {
    clearTimeout(debounceTimer);
    if (ptr < stack.length - 1) { ptr++; applyState(stack[ptr]); syncBtns(); }
  }

  function syncBtns() {
    if (undoBtn) undoBtn.disabled = ptr <= 0;
    if (redoBtn) redoBtn.disabled = ptr >= stack.length - 1;
  }

  // Keyboard shortcut when this textarea is focused
  ta.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (e.ctrlKey && e.key.toLowerCase() === 'y')) { e.preventDefault(); redo(); }
  });

  // Inject button row AFTER the content-wrap (or after the textarea itself)
  // so it never overlaps tok-count / expand-btn which are inside content-wrap
  const wrap = ta.closest('.content-wrap') || ta;
  const insertAfter = wrap.closest('.content-wrap') || wrap;

  const pair = document.createElement('div');
  pair.className = 'field-ur-pair';
  pair.innerHTML =
    `<button class="field-ur-btn" title="Undo" tabindex="-1">↩</button>` +
    `<button class="field-ur-btn" title="Redo" tabindex="-1">↪</button>`;
  const undoBtn = pair.children[0];
  const redoBtn = pair.children[1];
  undoBtn.addEventListener('mousedown', e => { e.preventDefault(); undo(); });
  redoBtn.addEventListener('mousedown', e => { e.preventDefault(); redo(); });
  // Touch support for mobile
  undoBtn.addEventListener('touchend', e => { e.preventDefault(); undo(); });
  redoBtn.addEventListener('touchend', e => { e.preventDefault(); redo(); });

  insertAfter.insertAdjacentElement('afterend', pair);
  syncBtns();
}

// Call this after any editor renders to wire all textareas in a container
export function wireFieldUndoRedo(container) {
  (container || document).querySelectorAll('textarea.ftextarea').forEach(ta => {
    attachFieldUndoRedo(ta);
  });
}

// ═══════════════════════════════════════════════════════
// ITEM-LEVEL UNDO/REDO (in-session, per open item)
// Separate from version history — lightweight session stack.
// ═══════════════════════════════════════════════════════

// itemUndoStacks: { key: { stack: [...snapshots], ptr } }
// key = 'lore:{uid}' | 'char:{id}' | 'preset:{id}'
export const itemUndoStacks = {};
export const ITEM_UNDO_MAX = 30;

export function itemUndoKey(type, id) { return `${type}:${id}`; }

export function itemUndoPush(type, id, snapshot) {
  const key = itemUndoKey(type, id);
  if (!itemUndoStacks[key]) itemUndoStacks[key] = { stack: [], ptr: -1 };
  const s = itemUndoStacks[key];
  // Truncate forward history
  s.stack.splice(s.ptr + 1);
  s.stack.push(JSON.stringify(snapshot));
  if (s.stack.length > ITEM_UNDO_MAX) s.stack.shift();
  s.ptr = s.stack.length - 1;
}

export function itemUndoCanUndo(type, id) {
  const s = itemUndoStacks[itemUndoKey(type, id)];
  return s && s.ptr > 0;
}

export function itemUndoCanRedo(type, id) {
  const s = itemUndoStacks[itemUndoKey(type, id)];
  return s && s.ptr < s.stack.length - 1;
}

export function itemUndoGet(type, id, direction) {
  const key = itemUndoKey(type, id);
  const s = itemUndoStacks[key];
  if (!s) return null;
  if (direction === 'undo' && s.ptr > 0) s.ptr--;
  else if (direction === 'redo' && s.ptr < s.stack.length - 1) s.ptr++;
  else return null;
  return JSON.parse(s.stack[s.ptr]);
}

export function syncItemUndoButtons(type, id) {
  const undoBtn = g('itemUndoBtn');
  const redoBtn = g('itemRedoBtn');
  if (undoBtn) undoBtn.disabled = !itemUndoCanUndo(type, id);
  if (redoBtn) redoBtn.disabled = !itemUndoCanRedo(type, id);
}

// ═══════════════════════════════════════════════════════
// VERSION HISTORY (per-item, stored inside library entries)
// ═══════════════════════════════════════════════════════

export const ITEM_HIST_MAX = 10;

// Push an autosave snapshot into an item's history.
// For lorebooks, pass the raw entry object (has a .lb field).
// For char/preset, pass the library entry directly.
export function itemHistoryPush(type, itemId, entryOrData, label = null) {
  // Determine what to compress: lorebooks store the lorebook under .lb
  let payload = (type === 'lore' && entryOrData?.lb) ? entryOrData.lb : entryOrData;

  // A snapshot is for recovering your *writing*, not your avatar.
  // Storing imageData in every snapshot meant one character with a
  // picture could be keeping eleven copies of that picture. Strip it —
  // and strip the nested history so snapshots don't contain snapshots.
  if (payload && typeof payload === 'object' && (type === 'char' || type === 'preset' || type === 'prompt' || type === 'regex')) {
    payload = { ...payload };
    delete payload.imageData;
    delete payload.history;
  }

  const snapshot = {
    ts: new Date().toISOString(),
    label: label || null,
    data: lzPack(payload),
  };

  // Skip an auto snapshot identical to the newest one (e.g. closing a tab
  // right after saving), so real versions don't get pushed out of the 10 slots
  const histOf = type === 'lore'
    ? (JSON.parse(store.get('aet_library') || '{}')[itemId] || {}).history
    : type === 'char' ? state.charLibrary[itemId]?.history
    : type === 'prompt' ? state.promptLibrary[itemId]?.history
    : type === 'regex' ? state.regexLibrary[itemId]?.history : state.presetLibrary[itemId]?.history;
  if (!label && histOf && histOf[0] && histOf[0].data === snapshot.data) return;

  if (type === 'lore') {
    const lib = JSON.parse(store.get('aet_library') || '{}');
    if (!lib[itemId]) return;
    if (!lib[itemId].history) lib[itemId].history = [];
    lib[itemId].history.unshift(snapshot);
    if (lib[itemId].history.length > ITEM_HIST_MAX) lib[itemId].history.splice(ITEM_HIST_MAX);
    safeSet('aet_library', JSON.stringify(lib));
  } else if (type === 'char') {
    if (!state.charLibrary[itemId]) return;
    if (!state.charLibrary[itemId].history) state.charLibrary[itemId].history = [];
    state.charLibrary[itemId].history.unshift(snapshot);
    if (state.charLibrary[itemId].history.length > ITEM_HIST_MAX) state.charLibrary[itemId].history.splice(ITEM_HIST_MAX);
    saveCharLibrary();
  } else if (type === 'preset') {
    if (!state.presetLibrary[itemId]) return;
    if (!state.presetLibrary[itemId].history) state.presetLibrary[itemId].history = [];
    state.presetLibrary[itemId].history.unshift(snapshot);
    if (state.presetLibrary[itemId].history.length > ITEM_HIST_MAX) state.presetLibrary[itemId].history.splice(ITEM_HIST_MAX);
    savePresetLibrary();
  } else if (type === 'prompt') {
    if (!state.promptLibrary[itemId]) return;
    if (!state.promptLibrary[itemId].history) state.promptLibrary[itemId].history = [];
    state.promptLibrary[itemId].history.unshift(snapshot);
    if (state.promptLibrary[itemId].history.length > ITEM_HIST_MAX) state.promptLibrary[itemId].history.splice(ITEM_HIST_MAX);
    savePromptLibrary();
  } else if (type === 'regex') {
    if (!state.regexLibrary[itemId]) return;
    if (!state.regexLibrary[itemId].history) state.regexLibrary[itemId].history = [];
    state.regexLibrary[itemId].history.unshift(snapshot);
    if (state.regexLibrary[itemId].history.length > ITEM_HIST_MAX) state.regexLibrary[itemId].history.splice(ITEM_HIST_MAX);
    saveRegexLibrary();
  }
}

// Save a named checkpoint
export function itemHistorySaveCheckpoint(type, itemId, label) {
  if (!label || !label.trim()) { toast('Enter a checkpoint name.', 'warn'); return; }
  if (type === 'lore') {
    // Checkpoint the lorebook as it is on screen, not the last library save
    if (loreActiveLibName() === itemId) loreSyncToLib();
    const lib = JSON.parse(store.get('aet_library') || '{}');
    if (lib[itemId]) itemHistoryPush(type, itemId, lib[itemId], label.trim());
  } else if (type === 'char') {
    itemHistoryPush(type, itemId, state.charLibrary[itemId], label.trim());
  } else if (type === 'preset') {
    itemHistoryPush(type, itemId, state.presetLibrary[itemId], label.trim());
  } else if (type === 'prompt') {
    itemHistoryPush(type, itemId, state.promptLibrary[itemId], label.trim());
  } else if (type === 'regex') {
    itemHistoryPush(type, itemId, state.regexLibrary[itemId], label.trim());
  }
  toast('Checkpoint saved.', 'ok');
}

// Open the version history modal for an item
// After a restore, reload the item into its editor if it's the one on screen
export function itemHistoryRefreshOpen(type, itemId) {
  if (type === 'lore') {
    if (loreActiveLibName() !== itemId) return;
    const lib = JSON.parse(store.get('aet_library') || '{}');
    if (!lib[itemId]) return;
    state.lorebook = JSON.parse(JSON.stringify(lib[itemId].lb));
    state.lorebook.entries = rebuildEntries(state.lorebook.entries || {});
    state.openTabs = []; state.activeTabId = null; state.unsaved = new Set(); state.formState = {};
    state.nextUid = Object.keys(state.lorebook.entries).length
      ? Math.max(...Object.keys(state.lorebook.entries).map(Number)) + 1 : 0;
    loreLinkToLib(itemId);
    g('lorebookName').value = state.lorebook.name || itemId;
    if (state.mode === 'lore') { renderList(); renderTabs(); renderEditor(); }
    saveToStorage();
  } else if (type === 'char') {
    if (state.activeCharId === itemId && state.mode === 'char') openChar(itemId);
  } else if (type === 'preset') {
    if (state.activePresetId === itemId && state.mode === 'preset') openPreset(itemId);
  } else if (type === 'prompt') {
    if (state.activePromptId === itemId && state.mode === 'prompt') openPrompt(itemId);
  } else if (type === 'regex') {
    if (state.activeRegexId === itemId && state.mode === 'regex') openRegex(itemId);
  }
}

export function openItemHistory(type, itemId) {
  let entry, history;
  if (type === 'lore') {
    const lib = JSON.parse(store.get('aet_library') || '{}');
    entry = lib[itemId];
  } else if (type === 'char') {
    entry = state.charLibrary[itemId];
  } else if (type === 'preset') {
    entry = state.presetLibrary[itemId];
  } else if (type === 'prompt') {
    entry = state.promptLibrary[itemId];
  } else if (type === 'regex') {
    entry = state.regexLibrary[itemId];
  }

  if (!entry) { toast('Item not found.', 'err'); return; }
  history = entry.history || [];

  // Build and show modal dynamically
  let existing = g('itemHistoryModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'itemHistoryModal';
  modal.className = 'modal open';
  modal.innerHTML = `
    <div class="modal-box lg">
      <div class="modal-head">
        <h2>Version History — ${esc(entry.name || 'Untitled')}</h2>
        <button class="modal-x" data-close="itemHistoryModal">×</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap">
          <input type="text" id="histCheckpointLabel" class="finput" style="flex:1;min-width:140px" placeholder="Checkpoint name...">
          <button class="btn btn-s btn-sm" id="histSaveCheckpointBtn">Save Checkpoint</button>
        </div>
        <div style="font-family:var(--fx);font-size:.65rem;color:var(--txm);margin-bottom:.55rem;letter-spacing:.3px">
          Up to ${ITEM_HIST_MAX} snapshots — autosaved on close and export. Restore replaces current data.
        </div>
        <div id="histList" class="lib-list" style="max-height:340px">
          ${!history.length ? '<div class="lib-empty">// no snapshots yet — close a tab or export to create one</div>' : ''}
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#histSaveCheckpointBtn').addEventListener('click', () => {
    const label = modal.querySelector('#histCheckpointLabel').value;
    itemHistorySaveCheckpoint(type, itemId, label);
    modal.querySelector('#histCheckpointLabel').value = '';
    openItemHistory(type, itemId); // refresh
  });

  modal.addEventListener('click', e => {
    const closeTarget = e.target.closest('[data-close]');
    // stopPropagation so the global delegated handler doesn't also try to close it
    if (closeTarget) { e.stopPropagation(); modal.remove(); return; }
    if (e.target === modal) { e.stopPropagation(); modal.remove(); }
  });

  const listEl = modal.querySelector('#histList');

  history.forEach((snap, i) => {
    const ts = new Date(snap.ts).toLocaleString();
    const isCheckpoint = !!snap.label;
    const item = document.createElement('div');
    item.className = 'hist-item' + (isCheckpoint ? ' checkpoint' : '');
    item.innerHTML = `
      <span class="hist-ts">${ts} ${i === 0 ? '<span style="color:var(--ok);font-size:.6rem">● latest</span>' : ''}</span>
      ${isCheckpoint ? `<span class="hist-label">${esc(snap.label)}</span>` : '<span class="hist-auto">auto</span>'}
      <div class="hist-acts">
        <button class="btn btn-s btn-sm hist-restore">Restore</button>
        <button class="btn btn-s btn-sm hist-export">Export</button>
      </div>`;

    item.querySelector('.hist-restore').addEventListener('click', async () => {
      if (!await askConfirm(`Restore this item to its state at ${ts}?`)) return;
      try {
        const data = lzUnpack(snap.data);
        // A snapshot must never carry the history list or the avatar back
        // with it. Restoring an old snapshot used to overwrite `history`
        // with the shorter list from that moment, permanently deleting
        // every newer snapshot, and blank the character's image.
        if (data && typeof data === 'object') { delete data.history; delete data.imageData; }

        let ok = false;
        if (type === 'lore') {
          const lib = JSON.parse(store.get('aet_library') || '{}');
          if (lib[itemId]) { lib[itemId].lb = data; ok = safeSet('aet_library', JSON.stringify(lib)); }
        } else if (type === 'char') {
          if (state.charLibrary[itemId]) { Object.assign(state.charLibrary[itemId], data); ok = saveCharLibrary(); }
        } else if (type === 'preset') {
          if (state.presetLibrary[itemId]) { Object.assign(state.presetLibrary[itemId], data); ok = savePresetLibrary(); }
        } else if (type === 'prompt') {
          if (state.promptLibrary[itemId]) { Object.assign(state.promptLibrary[itemId], data); ok = savePromptLibrary(); }
        } else if (type === 'regex') {
          if (state.regexLibrary[itemId]) { Object.assign(state.regexLibrary[itemId], data); ok = saveRegexLibrary(); }
        }
        if (!ok) return; // safeSet already told the user why
        modal.remove();
        // Re-render in place instead of reloading (which dumped you on Home)
        itemHistoryRefreshOpen(type, itemId);
        toast('Restored to ' + ts + '.', 'ok');
      } catch(e) { toast('Snapshot unreadable: ' + e.message, 'err'); }
    });

    item.querySelector('.hist-export').addEventListener('click', () => {
      try {
        const data = lzUnpack(snap.data);
        const json = JSON.stringify(data, null, 2);
        const name = (entry.name || 'item').replace(/\s+/g,'-').toLowerCase();
        const date = snap.ts.slice(0,10);
        dlFile(json, `${name}-snapshot-${date}.json`, 'application/json');
      } catch(e) { toast('Snapshot unreadable: ' + e.message, 'err'); }
    });

    listEl.appendChild(item);
  });
}
