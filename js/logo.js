// ═══════════════════════════════════════════════════════
// LOGO — the app icon (browser tab, home screen, installed app, optional sidebar logo).
// Choices: Automatic (follows the theme: dark logo in dark mode, pink in pink mode),
// Dark, Pink, or your own image. The pick is a small setting; an uploaded image is
// resized and kept in the large-data store.
// ═══════════════════════════════════════════════════════
import { store } from './kv.js';
import { safeSet } from './storage.js';
import { esc, g, toast } from './util.js';

export const LOGO_PREF_KEY = 'aet_logo';          // { mode: 'auto'|'dark'|'pink'|'custom', show: bool }
export const LOGO_CUSTOM_KEY = 'aet_logo_custom'; // { s192: dataUrl, s512: dataUrl }
export const BUILTIN_LOGOS = {
  dark: { label: 'Dark', s32: 'icons/favicon-32.png', s192: 'icons/icon-192.png', s512: 'icons/icon-512.png' },
  pink: { label: 'Pink', s32: 'icons/icon-pink-192.png', s192: 'icons/icon-pink-192.png', s512: 'icons/icon-pink-512.png' },
};

export function logoPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(LOGO_PREF_KEY) || '{}');
    const mode = ['auto', 'dark', 'pink', 'custom'].includes(p.mode) ? p.mode : 'auto';
    return { mode, show: !!p.show };
  } catch (e) { return { mode: 'auto', show: false }; }
}
function setPrefs(p) { return safeSet(LOGO_PREF_KEY, JSON.stringify(p)); }

export function customLogo() {
  try {
    const c = JSON.parse(store.get(LOGO_CUSTOM_KEY) || 'null');
    return c && typeof c.s192 === 'string' && typeof c.s512 === 'string' ? c : null;
  } catch (e) { return null; }
}

// Which logo is in use right now: { s32, s192, s512 }
export function currentLogo() {
  const { mode } = logoPrefs();
  if (mode === 'custom') { const c = customLogo(); if (c) return { s32: c.s192, s192: c.s192, s512: c.s512 }; }
  const key = mode === 'dark' || mode === 'pink' ? mode : (document.body.classList.contains('pink') ? 'pink' : 'dark');
  return BUILTIN_LOGOS[key];
}

let manifestUrl = null;

function setIconLinks(logo, isDefault) {
  const head = document.head;
  head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(l => l.remove());
  const add = (rel, href, extra = {}) => { const l = document.createElement('link'); l.rel = rel; l.href = href; Object.entries(extra).forEach(([k, v]) => l.setAttribute(k, v)); head.append(l); };
  if (isDefault) { // keep the original tab icons exactly as shipped
    add('icon', 'icons/favicon.ico', { type: 'image/x-icon' });
    add('icon', 'icons/favicon-32.png', { type: 'image/png', sizes: '32x32' });
    add('apple-touch-icon', 'icons/icon-192.png');
  } else {
    add('icon', logo.s32, { type: 'image/png' });
    add('apple-touch-icon', logo.s192);
  }
}

// An installed app takes its icon from the web manifest, so give the browser one that names the chosen logo.
// (Browsers refresh an installed app's icon on their own schedule; reinstalling forces it.)
async function setManifest(logo) {
  try {
    const res = await fetch('manifest.json', { cache: 'no-cache' });
    const m = await res.json();
    const abs = u => new URL(u, document.baseURI).href;
    m.start_url = abs(m.start_url || './'); m.scope = abs(m.scope || './');
    m.icons = [
      { src: abs(logo.s192), sizes: '192x192', type: 'image/png' },
      { src: abs(logo.s512), sizes: '512x512', type: 'image/png' },
      { src: abs(logo.s512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
    const url = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.append(link); }
    link.href = url;
    if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    manifestUrl = url;
  } catch (e) { /* offline or blocked: the shipped manifest stays */ }
}

function applySidebarLogo(logo, show) {
  const box = document.querySelector('.nav-logo');
  if (!box) return;
  let img = box.querySelector('.nav-logo-img');
  if (!show) { if (img) img.remove(); return; }
  if (!img) { img = document.createElement('img'); img.className = 'nav-logo-img'; img.alt = ''; box.prepend(img); }
  img.src = logo.s192;
}

export function applyLogo() {
  const { mode, show } = logoPrefs();
  const logo = currentLogo();
  setIconLinks(logo, mode === 'dark');
  setManifest(logo);
  applySidebarLogo(logo, show);
  renderLogoSettings();
}

// ── Settings UI ──
export function renderLogoSettings() {
  const host = g('stgLogoBody');
  if (!host) return;
  const { mode, show } = logoPrefs();
  const custom = customLogo();
  const card = (key, label, src, note) => `
    <label class="logo-card${mode === key ? ' on' : ''}" data-logo="${key}">
      <input type="radio" name="stgLogoMode" value="${key}" ${mode === key ? 'checked' : ''}${key === 'custom' && !custom ? ' disabled' : ''}>
      ${src ? `<img src="${esc(src)}" alt="" width="56" height="56">` : '<span class="logo-card-empty">none yet</span>'}
      <span class="logo-card-label">${esc(label)}</span>
      ${note ? `<span class="logo-card-note">${esc(note)}</span>` : ''}
    </label>`;
  host.innerHTML = `
    <div class="logo-cards">
      ${card('auto', 'Automatic', document.body.classList.contains('pink') ? BUILTIN_LOGOS.pink.s192 : BUILTIN_LOGOS.dark.s192, 'follows the theme')}
      ${card('dark', 'Dark', BUILTIN_LOGOS.dark.s192, '')}
      ${card('pink', 'Pink', BUILTIN_LOGOS.pink.s192, '')}
      ${card('custom', 'Your own', custom && custom.s192, '')}
    </div>
    <div class="logo-acts">
      <button class="btn btn-s btn-sm" id="stgLogoUpload">${custom ? 'Replace your image' : 'Upload an image'}</button>
      ${custom ? '<button class="btn btn-err btn-sm" id="stgLogoRemove">Remove it</button>' : ''}
      <label class="cb-row"><input type="checkbox" id="stgLogoShow" ${show ? 'checked' : ''}><span class="flabel-sm">Show the logo next to the name in the sidebar</span></label>
    </div>
    <div class="logo-hint">PNG, JPG, WebP or SVG. Square works best. Browsers update an installed app's icon on their own; reinstalling the app shows a new one right away.</div>
    <input type="file" id="stgLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none">`;
}

// Resize an uploaded image to square PNGs (the image is fitted inside the square, never stretched)
export function imageToLogo(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 8 * 1024 * 1024) { reject(new Error('That image is over 8 MB.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const draw = size => {
          const c = document.createElement('canvas'); c.width = c.height = size;
          const ctx = c.getContext('2d');
          const w = img.naturalWidth || size, h = img.naturalHeight || size;
          const k = Math.min(size / w, size / h);
          ctx.drawImage(img, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
          return c.toDataURL('image/png');
        };
        resolve({ s192: draw(192), s512: draw(512) });
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

export async function chooseCustomLogo(file) {
  try {
    const logo = await imageToLogo(file);
    store.set(LOGO_CUSTOM_KEY, JSON.stringify(logo));
    setPrefs({ ...logoPrefs(), mode: 'custom' });
    applyLogo();
    toast('Logo updated.', 'ok');
  } catch (e) { toast('Could not use that image: ' + e.message, 'err'); }
}

export function wireLogoSettings() {
  const host = g('stgLogoBody');
  if (!host || host.dataset.wired) return;
  host.dataset.wired = '1';
  host.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'stgLogoMode') { setPrefs({ ...logoPrefs(), mode: t.value }); applyLogo(); }
    else if (t.id === 'stgLogoShow') { setPrefs({ ...logoPrefs(), show: t.checked }); applyLogo(); }
    else if (t.id === 'stgLogoFile' && t.files && t.files[0]) { chooseCustomLogo(t.files[0]); t.value = ''; }
  });
  host.addEventListener('click', e => {
    if (e.target.id === 'stgLogoUpload') g('stgLogoFile').click();
    else if (e.target.id === 'stgLogoRemove') {
      store.remove(LOGO_CUSTOM_KEY);
      if (logoPrefs().mode === 'custom') setPrefs({ ...logoPrefs(), mode: 'auto' });
      applyLogo(); toast('Your logo was removed.', 'ok');
    }
  });
  renderLogoSettings();
}
