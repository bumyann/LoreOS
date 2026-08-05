// ═══════════════════════════════════════════════════════
// FULLSCREEN FIELD EDITOR
// ═══════════════════════════════════════════════════════
let fullscreenTargetId = null;

function openFullscreen(fieldId, label) {
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
  setTimeout(() => g('fullscreenTA').focus(), 80);
}

function wireFullscreen() {
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
