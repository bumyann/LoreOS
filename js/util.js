// ═══════════════════════════════════════════════════════
// UTIL — small helpers every module uses: DOM lookup, HTML escaping, dialogs, toasts, downloads.
// ═══════════════════════════════════════════════════════

// Markup registry. Each feature module registers the dialogs and fixed elements it
// owns (with a number giving their order on the page); main.js injects them all
// once, before anything is wired up.
export const _markup = [];
export function registerMarkup(order, html) { _markup.push({ order, html }); }
export function injectMarkup() {
  _markup.sort((a, b) => a.order - b.order);
  document.body.insertAdjacentHTML('beforeend', _markup.map(m => m.html).join('\n'));
  _markup.length = 0;
}

export function g(id) { return document.getElementById(id); }

// File name from a user-facing name. Keeps letters from any language and emoji
// (the old [^a-z0-9] rule turned a Japanese name into "______.json" and made
// different characters collide), drops only what file systems reject.
export function safeFileName(name, fallback = 'untitled') {
  const clean = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 80);
  return clean || fallback;
}

// Escape a value for safe interpolation into an HTML string, in text AND in
// attribute values (value="..."). Anything that came from an imported file is
// untrusted — a character card named `<img src=x onerror=...>` should render
// as text, not run, and a value containing a double quote must not be able to
// break out of its attribute. (Setting textContent and reading innerHTML back
// does NOT escape quotes, which is why this is done by hand.)
export function esc(v) {
  return ((v === null || v === undefined) ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function closeAllDropdowns() {
  document.querySelectorAll('.dd-menu.open').forEach(m => m.classList.remove('open'));
}

// Null-guarded: dynamically built modals (version history) remove themselves,
// and the delegated close handler used to then crash on the missing element.
export const _modalReturnFocus = {};
export function openModal(id) {
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
export function closeModal(id) {
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
export function askInput(message, defaultValue = '', { secret = false } = {}) {
  return new Promise(resolve => {
    g('renameModalMsg').textContent = message;
    g('renameModalInput').type = secret ? 'password' : 'text';
    g('renameModalInput').autocomplete = secret ? 'new-password' : 'off';
    g('renameModalInput').value = defaultValue;
    openModal('renameModal');
    setTimeout(() => { g('renameModalInput').focus(); g('renameModalInput').select(); }, 80);
    const okBtn = g('renameOkBtn');
    const cancelBtn = g('renameCancelBtn');
    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      g('renameModalInput').removeEventListener('keydown', onKey);
      g('renameModalInput').value = ''; g('renameModalInput').type = 'text';
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

export function askConfirm(message) {
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

export function toast(msg, type = 'info', opts = {}) {
  const container = g('notifs');
  const el = document.createElement('div');
  el.className = `notif ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : type === 'warn' ? 'warn' : 'info'}`;
  el.textContent = msg;
  container.append(el);
  const dismiss = () => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), {once:true}); };
  el.addEventListener('click', dismiss);
  // Optional action button (e.g. Undo). Clicking it runs the action and closes the toast.
  if (opts.action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'notif-act'; b.textContent = opts.action.label;
    b.addEventListener('click', e => { e.stopPropagation(); dismiss(); opts.action.fn(); });
    el.append(b);
  }
  setTimeout(dismiss, opts.ms || 3500);
}

export function dlFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Works in sandboxed iframes where navigator.clipboard is blocked
export function copyToClipboard(text) {
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

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(70, `<!-- Notifications -->
<div id="notifs"></div>`);

registerMarkup(230, `<!-- CUSTOM INPUT MODAL -->
<div id="inputModal" class="modal">
  <div class="modal-box" style="max-width:400px">
    <div class="modal-head"><h2 id="inputModalTitle">Input</h2></div>
    <div class="modal-body">
      <input type="text" id="inputModalField" class="finput" style="width:100%;margin-bottom:1rem">
      <div class="modal-foot">
        <button class="btn btn-s" id="inputModalCancel">Cancel</button>
        <button class="btn btn-p" id="inputModalOk">OK</button>
      </div>
    </div>
  </div>
</div>`);

registerMarkup(240, `<!-- RENAME MODAL -->
<div id="renameModal" class="modal">
  <div class="modal-box" style="max-width:400px">
    <div class="modal-head"><h2 id="renameModalTitle">Rename</h2></div>
    <div class="modal-body">
      <p id="renameModalMsg" style="font-family:var(--fx);font-size:.75rem;color:var(--txd);margin-bottom:.75rem"></p>
      <input type="text" id="renameModalInput" class="finput" style="margin-bottom:.75rem">
      <div class="modal-foot">
        <button class="btn btn-s" id="renameCancelBtn">Cancel</button>
        <button class="btn btn-p" id="renameOkBtn">Rename</button>
      </div>
    </div>
  </div>
</div>`);

registerMarkup(280, `<!-- CONFIRM MODAL -->
<div id="confirmModal" class="modal">
  <div class="modal-box" style="max-width:420px">
    <div class="modal-head"><h2>Confirm</h2></div>
    <div class="modal-body">
      <p id="confirmMsg" style="font-size:.85rem;color:var(--txd);line-height:1.6;margin-bottom:1rem"></p>
      <div class="modal-foot">
        <button class="btn btn-s" id="confirmCancelBtn">Cancel</button>
        <button class="btn btn-err" id="confirmOkBtn">Confirm</button>
      </div>
    </div>
  </div>
</div>`);

