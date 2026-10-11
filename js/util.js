// ═══════════════════════════════════════════════════════
// UTIL — small helpers every module uses: DOM lookup, HTML escaping, dialogs, toasts, downloads.
// ═══════════════════════════════════════════════════════

function g(id) { return document.getElementById(id); }

// File name from a user-facing name. Keeps letters from any language and emoji
// (the old [^a-z0-9] rule turned a Japanese name into "______.json" and made
// different characters collide), drops only what file systems reject.
function safeFileName(name, fallback = 'untitled') {
  const clean = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 80);
  return clean || fallback;
}

// Escape a value for safe interpolation into an HTML string, in text AND in
// attribute values (value="..."). Anything that came from an imported file is
// untrusted — a character card named `<img src=x onerror=...>` should render
// as text, not run, and a value containing a double quote must not be able to
// break out of its attribute. (Setting textContent and reading innerHTML back
// does NOT escape quotes, which is why this is done by hand.)
function esc(v) {
  return ((v === null || v === undefined) ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function closeAllDropdowns() {
  document.querySelectorAll('.dd-menu.open').forEach(m => m.classList.remove('open'));
}

// Null-guarded: dynamically built modals (version history) remove themselves,
// and the delegated close handler used to then crash on the missing element.
const _modalReturnFocus = {};
function openModal(id) {
  const el = g(id); if (!el) return;
  // Dialog semantics for screen readers, and keyboard focus moves into the
  // dialog (onto its box, not an input, so phones don't pop the keyboard)
  if (!el.getAttribute('role')) { el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); }
  if (!el.classList.contains('open')) _modalReturnFocus[id] = document.activeElement;
  el.classList.add('open');
  const box = el.querySelector('.modal-box') || el;
  if (!box.hasAttribute('tabindex')) box.setAttribute('tabindex', '-1');
  try { box.focus({ preventScroll: true }); } catch (e) {}
}
function closeModal(id) {
  const el = g(id); if (!el) return;
  el.classList.remove('open');
  const back = _modalReturnFocus[id]; delete _modalReturnFocus[id];
  if (back && back.focus && document.contains(back)) { try { back.focus({ preventScroll: true }); } catch (e) {} }
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════
// Promise-based confirm modal — replaces native confirm() which gets silently
// blocked/auto-rejected in sandboxed iframe contexts (e.g. in-chat previews)
// Promise-based input modal — replaces native prompt() which is blocked in sandboxed iframes
function askInput(message, defaultValue = '') {
  return new Promise(resolve => {
    g('renameModalMsg').textContent = message;
    g('renameModalInput').value = defaultValue;
    openModal('renameModal');
    setTimeout(() => { g('renameModalInput').focus(); g('renameModalInput').select(); }, 80);
    const okBtn = g('renameOkBtn');
    const cancelBtn = g('renameCancelBtn');
    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      g('renameModalInput').removeEventListener('keydown', onKey);
      closeModal('renameModal');
      resolve(result);
    };
    const onOk = () => cleanup(g('renameModalInput').value);
    const onCancel = () => cleanup(null);
    const onKey = e => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    g('renameModalInput').addEventListener('keydown', onKey);
  });
}

function askConfirm(message) {
  return new Promise(resolve => {
    g('confirmMsg').textContent = message;
    openModal('confirmModal');
    const okBtn = g('confirmOkBtn');
    const cancelBtn = g('confirmCancelBtn');
    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeModal('confirmModal');
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function toast(msg, type = 'info') {
  const container = g('notifs');
  const el = document.createElement('div');
  el.className = `notif ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : type === 'warn' ? 'warn' : 'info'}`;
  el.textContent = msg;
  container.append(el);
  const dismiss = () => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), {once:true}); };
  el.addEventListener('click', dismiss);
  setTimeout(dismiss, 3500);
}

function dlFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Works in sandboxed iframes where navigator.clipboard is blocked
function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
    }
    return Promise.resolve(fallback());
  } catch(e) { return Promise.resolve(fallback()); }

  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.append(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
