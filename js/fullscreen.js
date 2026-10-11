// ═══════════════════════════════════════════════════════
// FULLSCREEN FIELD EDITOR
// ═══════════════════════════════════════════════════════

import { attachFieldUndoRedo } from './history.js';
import { closeModal, g, openModal, registerMarkup, toast } from './util.js';

export let fullscreenTargetId = null;

export function openFullscreen(fieldId, label) {
  const el = g(fieldId);
  if (!el) return;
  fullscreenTargetId = fieldId;
  g('fullscreenTitle').textContent = '// ' + (label || 'Edit Field');
  g('fullscreenTA').value = el.value;
  const chars = el.value.length;
  g('fullscreenMeta').textContent = chars + ' chars · ~' + Math.ceil(chars/4) + ' tok';
  g('fullscreenTA').addEventListener('input', () => {
    const c = g('fullscreenTA').value.length;
    g('fullscreenMeta').textContent = c + ' chars · ~' + Math.ceil(c/4) + ' tok';
  }, { once: false });
  openModal('fullscreenModal');
  setTimeout(() => {
    g('fullscreenTA').focus();
    // Wire field undo/redo fresh each time the modal opens (reset state)
    const ta = g('fullscreenTA');
    ta._undoAttached = false; // force re-attach so stack resets to current value
    // Remove old pair if present
    const old = g('fullscreenModal').querySelector('.field-ur-pair');
    if (old) old.remove();
    attachFieldUndoRedo(ta);
  }, 80);
}

export function wireFullscreen() {
  g('fullscreenApply').addEventListener('click', () => {
    if (!fullscreenTargetId) return;
    const el = g(fullscreenTargetId);
    if (el) {
      el.value = g('fullscreenTA').value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closeModal('fullscreenModal');
    toast('Applied.', 'ok');
  });
  g('fullscreenClose').addEventListener('click', () => closeModal('fullscreenModal'));
  g('fullscreenCancel').addEventListener('click', () => closeModal('fullscreenModal'));
  // Ctrl+Enter to apply
  g('fullscreenTA').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); g('fullscreenApply').click(); }
    // Escape intentionally disabled — use Apply / Cancel / ✕ to exit
    // Prevents accidental loss of edits
  });
}

// ═══════════════════════════════════════════════════════
// TEMPLATE LIBRARY
// ═══════════════════════════════════════════════════════
// Storage: 'aet_tpl_lore' and 'aet_tpl_char'
// lore templates: { id: { id, name, content, savedAt } }
// char templates: { id: { id, name, field?, content, savedAt } }

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(200, `<!-- FULLSCREEN FIELD MODAL -->
<div id="fullscreenModal" class="modal">
  <div class="modal-box" style="max-width:860px">
    <div class="modal-head">
      <h2 id="fullscreenTitle">Edit Field</h2>
      <button class="modal-x" id="fullscreenClose">×</button>
    </div>
    <div class="modal-body">
      <span id="fullscreenMeta"></span>
      <textarea id="fullscreenTA"></textarea>
      <div class="modal-foot">
        <button class="btn btn-s" id="fullscreenCancel">Cancel</button>
        <button class="btn btn-p" id="fullscreenApply">Apply</button>
      </div>
    </div>
  </div>
</div>`);

