// ═══════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════

import { downscaleAvatar, renderCharSidebar } from './character.js';
import { state } from './state.js';
import { safeSet, saveCharLibrary, storageUsage } from './storage.js';
import { wireSync } from './sync.js';
import { askConfirm, closeModal, esc, g, openModal, toast } from './util.js';
import { registerMarkup } from './util.js';

export function toggleTheme() {
  document.body.classList.toggle('pink');
  safeSet('aet_theme', document.body.classList.contains('pink') ? 'pink' : 'dark');
  applyCustomTheme(); // re-apply custom overrides for the new mode
}
// ═══════════════════════════════════════════════════════
// SETTINGS — theme customization + title editor
// ═══════════════════════════════════════════════════════

// Default colour values for both modes
export const DEFAULT_THEMES = {
  dark: {
    '--p':'#9d8fcc','--ph':'#7d6fac','--a':'#c4b8e8','--a2':'#e8e4f5',
    '--bg':'#0d1121','--bg2':'#111829','--bg3':'#161f33',
    '--sf':'#1c2740','--sf2':'#22304d',
    '--tx':'#e8e4f5','--txd':'#b0a8d0','--txm':'#6a6290'
  },
  pink: {
    '--p':'#b87090','--ph':'#96587a','--a':'#c4849a','--a2':'#f5eaee',
    '--bg':'#f5eaee','--bg2':'#ede0e5','--bg3':'#e4d4db',
    '--sf':'#d8c4cc','--sf2':'#ccb4be',
    '--tx':'#2e1c26','--txd':'#5a3a4a','--txm':'#8a6070'
  }
};

export const COLOUR_VARS = ['--p','--ph','--a','--a2','--bg','--bg2','--bg3','--sf','--sf2','--tx','--txd','--txm'];

export let stgEditingMode = 'dark'; // which mode we're currently editing colours for

export function settingsGet() {
  try { return JSON.parse(localStorage.getItem('aet_settings') || '{}'); } catch(e) { return {}; }
}
export function settingsSet(d) { return safeSet('aet_settings', JSON.stringify(d)); }

export function applyCustomTheme() {
  const cfg = settingsGet();
  const root = document.documentElement;
  const body = document.body;
  const isPink = body.classList.contains('pink');
  const vars = isPink ? (cfg.colours?.pink || {}) : (cfg.colours?.dark || {});

  // Clear all custom vars from both root and body first
  COLOUR_VARS.forEach(v => {
    root.style.removeProperty(v);
    body.style.removeProperty(v);
  });
  root.style.removeProperty('--pg');
  body.style.removeProperty('--pg');

  // Apply to body so they win over body.pink class definitions
  const target = body;
  COLOUR_VARS.forEach(v => {
    if (vars[v]) target.style.setProperty(v, vars[v]);
  });
  const p = vars['--p'] || (isPink ? '#b87090' : '#9d8fcc');
  const pgAlpha = isPink ? '.2' : '.25';
  target.style.setProperty('--pg', hexToRgba(p, pgAlpha));
}

// One-time cleanup: 'Universal Editor' was the old default subtitle, so it got
// saved into existing settings and themes and kept showing in the tab title
// even after the default changed.
export function migrateOldTitleSub(cfg) {
  if (cfg._titleSubMigrated) return false;
  const OLD = 'Universal Editor';
  if (cfg.titleSub === OLD) cfg.titleSub = '';
  Object.values(cfg.savedThemes || {}).forEach(t => { if (t && t.titleSub === OLD) t.titleSub = ''; });
  cfg._titleSubMigrated = true;
  return true;
}

export function applyCustomTitle() {
  const cfg = settingsGet();
  if (migrateOldTitleSub(cfg)) settingsSet(cfg);
  // Title lives in .nav-logo-text; the version tag is left alone.
  const logoEl = document.querySelector('.nav-logo-text');
  const main = cfg.titleMain || 'LoreOS';
  const sub  = cfg.titleSub || '';   // <- this was referenced but never declared,
                                     //    throwing on every page load and on Apply
  if (logoEl) logoEl.textContent = main;
  // Subtitle isn't shown in the collapsed nav (no room), but it does
  // go in the browser tab title.
  document.title = main + (sub ? ' ' + sub : '');
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Called on page load
export function applyAllCustomisations() {
  applyCustomTheme();
  applyCustomTitle();
}

export function openSettings() {
  const cfg = settingsGet();
  // Title
  g('stgTitleMain').value = cfg.titleMain || 'LoreOS';
  g('stgTitleSub').value = cfg.titleSub || '';
  // Pre-fill font inputs
  const savedFonts = fontsGet();
  Object.keys(FONT_ROLES).forEach(role => {
    const inputEl = g(`stgFont${role.toUpperCase()}`);
    const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
    if (inputEl) inputEl.value = savedFonts[role]?.name || '';
    if (statusEl) statusEl.textContent = savedFonts[role] ? `✓ active: ${savedFonts[role].name}` : '';
  });
  // Mode
  stgEditingMode = document.body.classList.contains('pink') ? 'pink' : 'dark';
  updateSettingsModeLabel();
  // Populate pickers
  populateColourPickers();
  // Theme slots
  renderThemeSlots();
  // Storage panel
  renderStoragePanel();
  // Avatar handling toggle
  const keepFull = g('stgKeepFullAvatars');
  if (keepFull) keepFull.checked = !!cfg.keepFullAvatars;
  openModal('settingsModal');
}

export function updateSettingsModeLabel() {
  const activeMode = document.body.classList.contains('pink') ? 'pink' : 'dark';
  const isActive = stgEditingMode === activeMode;
  g('stgModeLabel').textContent = `editing: ${stgEditingMode} mode${isActive ? ' (live preview)' : ' (apply to see changes)'}`;
  g('stgModeToggle').textContent = stgEditingMode === 'dark' ? 'Switch to Light' : 'Switch to Dark';
}

export function populateColourPickers() {
  const cfg = settingsGet();
  const saved = (stgEditingMode === 'pink' ? cfg.colours?.pink : cfg.colours?.dark) || {};
  const defaults = DEFAULT_THEMES[stgEditingMode];

  COLOUR_VARS.forEach(v => {
    const raw = saved[v] || defaults[v] || '#000000';
    const hex = (typeof raw === 'string' && raw.startsWith('#')) ? raw : '#000000';
    const colorIn = document.querySelector(`.settings-color input[type=color][data-var="${v}"]`);
    const textIn  = document.querySelector(`.stg-hex[data-var="${v}"]`);
    if (colorIn) colorIn.value = hex;
    if (textIn)  textIn.value  = hex;
  });
}

export function wireSettings() {
  if (g('settingsBtn')) g('settingsBtn').addEventListener('click', openSettings);

  // Closing Settings without Apply used to leave the live colour preview on
  // screen while the swatches (read from saved settings) showed the old
  // palette. Now any close re-applies the saved theme, dropping unapplied
  // preview colours. Apply saves first, so this is a no-op after Apply.
  const stgModal = g('settingsModal');
  if (stgModal && typeof MutationObserver !== 'undefined') {
    // Uses oldValue so an open+close batched into one callback still counts
    new MutationObserver(records => {
      const wasOpen = records.some(r => /(^|\s)open(\s|$)/.test(r.oldValue || ''));
      if (wasOpen && !stgModal.classList.contains('open')) applyCustomTheme();
    }).observe(stgModal, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }

  g('stgModeToggle').addEventListener('click', () => {
    stgEditingMode = stgEditingMode === 'dark' ? 'pink' : 'dark';
    updateSettingsModeLabel();
    populateColourPickers();
  });

  g('stgResetTheme').addEventListener('click', () => {
    const cfg = settingsGet();
    if (!cfg.colours) cfg.colours = {};
    cfg.colours[stgEditingMode] = {};
    settingsSet(cfg);
    populateColourPickers();
    applyCustomTheme();
    toast('Reset to default.', 'ok');
  });

  // Sync colour pickers ↔ hex inputs live
  document.querySelectorAll('.settings-color input[type=color]').forEach(colorIn => {
    const v = colorIn.dataset.var;
    colorIn.addEventListener('input', () => {
      const textIn = document.querySelector(`.stg-hex[data-var="${v}"]`);
      if (textIn) textIn.value = colorIn.value;
      // live preview only when editing the currently active mode
      const activeMode = document.body.classList.contains('pink') ? 'pink' : 'dark';
      if (stgEditingMode === activeMode) {
        document.body.style.setProperty(v, colorIn.value);
        const p = document.querySelector('.settings-color input[type=color][data-var="--p"]')?.value;
        if (p) document.body.style.setProperty('--pg', hexToRgba(p, stgEditingMode === 'pink' ? '.2' : '.25'));
      }
    });
  });

  document.querySelectorAll('.stg-hex').forEach(textIn => {
    const v = textIn.dataset.var;
    textIn.addEventListener('input', () => {
      const val = textIn.value.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
      const colorIn = document.querySelector(`.settings-color input[type=color][data-var="${v}"]`);
      if (colorIn) colorIn.value = val;
      const activeMode = document.body.classList.contains('pink') ? 'pink' : 'dark';
      if (stgEditingMode === activeMode) {
        document.body.style.setProperty(v, val);
      }
    });
  });

  g('stgApplyBtn').addEventListener('click', () => {
    const cfg = settingsGet();
    cfg.titleMain = g('stgTitleMain').value.trim() || 'LoreOS';
    cfg.titleSub = g('stgTitleSub').value.trim();
    if (!cfg.colours) cfg.colours = {};
    const modeVars = {};
    COLOUR_VARS.forEach(v => {
      const val = document.querySelector(`.stg-hex[data-var="${v}"]`)?.value.trim();
      if (val && /^#[0-9a-fA-F]{6}$/.test(val)) modeVars[v] = val;
    });
    cfg.colours[stgEditingMode] = modeVars;
    settingsSet(cfg);

    // Switch to the mode being edited so user sees the result
    const currentlyPink = document.body.classList.contains('pink');
    const editingPink = stgEditingMode === 'pink';
    if (editingPink !== currentlyPink) {
      document.body.classList.toggle('pink');
      safeSet('aet_theme', editingPink ? 'pink' : 'dark');
    }

    applyCustomTheme();
    applyCustomTitle();
    closeModal('settingsModal');
    toast('Settings applied.', 'ok');
  });

  // ── Storage panel ──
  g('stgStorageRefresh')?.addEventListener('click', renderStoragePanel);
  g('stgOptimiseAvatars')?.addEventListener('click', optimiseStoredAvatars);
  g('stgKeepFullAvatars')?.addEventListener('change', e => {
    const cfg = settingsGet();
    cfg.keepFullAvatars = e.target.checked;
    settingsSet(cfg);
    toast(e.target.checked
      ? 'Avatars will be kept at full resolution. Watch your storage.'
      : 'Avatars will be resized on import.', 'ok');
  });

  // Save current as named theme
  g('stgThemeSaveBtn').addEventListener('click', () => {
    const name = g('stgThemeSaveName').value.trim();
    if (!name) { toast('Enter a theme name.', 'warn'); return; }
    const cfg = settingsGet();
    if (!cfg.savedThemes) cfg.savedThemes = {};
    // Capture current colour state for both modes
    cfg.savedThemes[name] = {
      dark:  { ...(DEFAULT_THEMES.dark),  ...(cfg.colours?.dark  || {}) },
      pink:  { ...(DEFAULT_THEMES.pink),  ...(cfg.colours?.pink  || {}) },
      titleMain: cfg.titleMain || 'LoreOS',
      titleSub:  cfg.titleSub || '',
    };
    settingsSet(cfg);
    g('stgThemeSaveName').value = '';
    renderThemeSlots();
    toast(`Theme "${name}" saved.`, 'ok');
  });
}

export function renderThemeSlots() {
  const cfg = settingsGet();
  const slots = g('stgThemeSlots');
  slots.innerHTML = '';
  const themes = cfg.savedThemes || {};

  if (!Object.keys(themes).length) {
    slots.innerHTML = '<div style="font-family:var(--fx);font-size:.72rem;color:var(--txm)">// no saved themes yet</div>';
    return;
  }

  Object.entries(themes).forEach(([name, themeData]) => {
    const row = document.createElement('div');
    row.className = 'theme-slot';
    const swatch = document.createElement('div');
    swatch.className = 'theme-slot-swatch';
    swatch.style.background = themeData.dark?.['--p'] || '#9d8fcc';
    const label = document.createElement('span');
    label.className = 'theme-slot-name';
    label.textContent = name;
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-p btn-sm';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => loadThemeSlot(name, themeData));
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-err btn-sm';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', async () => {
      if (!await askConfirm(`Delete theme "${name}"?`)) return;
      const cfg2 = settingsGet();
      delete cfg2.savedThemes[name];
      settingsSet(cfg2);
      renderThemeSlots();
    });
    row.append(swatch, label, loadBtn, delBtn);
    slots.append(row);
  });
}

export function loadThemeSlot(name, themeData) {
  const cfg = settingsGet();
  if (!cfg.colours) cfg.colours = {};
  cfg.colours.dark = { ...themeData.dark };
  cfg.colours.pink = { ...themeData.pink };
  if (themeData.titleMain) cfg.titleMain = themeData.titleMain;
  if (themeData.titleSub !== undefined) cfg.titleSub = themeData.titleSub;
  settingsSet(cfg);
  applyCustomTheme();
  applyCustomTitle();
  populateColourPickers();
  g('stgTitleMain').value = cfg.titleMain || 'LoreOS';
  g('stgTitleSub').value = cfg.titleSub || '';
  toast(`Loaded theme "${name}".`, 'ok');
}
// ═══════════════════════════════════════════════════════
// FONT MANAGEMENT
// ═══════════════════════════════════════════════════════

export const FONT_ROLES = { fp: '--fp', fx: '--fx', fb: '--fb' };
export const FONT_DEFAULTS = { fp: 'VT323', fx: 'Pixelify Sans', fb: 'Noto Sans' };
export const FONT_STORAGE_KEY = 'aet_fonts';

export function fontsGet() { try { return JSON.parse(localStorage.getItem(FONT_STORAGE_KEY) || '{}'); } catch(e) { return {}; } }
export function fontsSet(d) { return safeSet(FONT_STORAGE_KEY, JSON.stringify(d)); }

// Apply saved fonts on load
export function applyFonts() {
  const saved = fontsGet();
  Object.entries(FONT_ROLES).forEach(([role, cssVar]) => {
    const data = saved[role];
    if (!data) return;
    if (data.type === 'gf') {
      loadGoogleFont(role, data.name, false);
    } else if (data.type === 'upload') {
      injectUploadedFont(role, data.name, data.dataUrl, false);
    }
  });
}

export function loadGoogleFont(role, name, save = true) {
  const cssVar = FONT_ROLES[role];
  const linkId = `gf-font-${role}`;
  const existing = document.getElementById(linkId);
  if (existing) existing.remove();

  const urlName = name.trim().replace(/ /g, '+');
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${urlName}&display=swap`;
  // Set the variable right away (not on load) so the browser starts fetching
  // the font file immediately; display=swap covers the gap
  document.body.style.setProperty(cssVar, `'${name.trim()}', sans-serif`);
  document.documentElement.style.setProperty(cssVar, `'${name.trim()}', sans-serif`);
  link.onload = () => {
    const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
    if (statusEl) statusEl.textContent = `✓ loaded "${name.trim()}" from Google Fonts`;
  };
  link.onerror = () => {
    const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
    if (statusEl) statusEl.textContent = `✗ couldn't load "${name.trim()}" — check the name`;
  };
  document.head.appendChild(link);

  if (save) {
    const d = fontsGet(); d[role] = { type: 'gf', name: name.trim() }; fontsSet(d);
  }
}

export function injectUploadedFont(role, name, dataUrl, save = true) {
  const cssVar = FONT_ROLES[role];
  const styleId = `uploaded-font-${role}`;
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();

  const ext = name.split('.').pop().toLowerCase();
  const fmt = ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : 'truetype';
  const fontName = `CustomFont_${role}`;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@font-face { font-family: '${fontName}'; src: url('${dataUrl}') format('${fmt}'); }`;
  document.head.appendChild(style);
  document.body.style.setProperty(cssVar, `'${fontName}', sans-serif`);
  document.documentElement.style.setProperty(cssVar, `'${fontName}', sans-serif`);

  const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
  if (statusEl) statusEl.textContent = `✓ loaded "${name}" from file`;

  if (save) {
    const d = fontsGet(); d[role] = { type: 'upload', name, dataUrl }; fontsSet(d);
  }
}

export function resetFont(role) {
  const cssVar = FONT_ROLES[role];
  const defaultName = FONT_DEFAULTS[role];
  // remove any injected style/link
  document.getElementById(`gf-font-${role}`)?.remove();
  document.getElementById(`uploaded-font-${role}`)?.remove();
  document.body.style.removeProperty(cssVar);
  document.documentElement.style.removeProperty(cssVar); // set by the early loader in index.html
  // clear from storage
  const d = fontsGet(); delete d[role]; fontsSet(d);
  const inputEl = g(`stgFont${role.toUpperCase()}`);
  const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
  if (inputEl) inputEl.value = '';
  if (statusEl) statusEl.textContent = `↺ reset to ${defaultName}`;
  toast(`Font reset to ${defaultName}.`, 'ok');
}

export function wireFonts() {
  // Pre-fill inputs with saved font names
  const saved = fontsGet();
  Object.keys(FONT_ROLES).forEach(role => {
    const data = saved[role];
    const inputEl = g(`stgFont${role.toUpperCase()}`);
    if (inputEl && data?.name) inputEl.value = data.name;
  });

  // Load GF buttons
  document.querySelectorAll('[data-font-role]').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.fontRole;
      const name = g(`stgFont${role.toUpperCase()}`)?.value.trim();
      if (!name) { toast('Enter a font name first.', 'warn'); return; }
      const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
      if (statusEl) statusEl.textContent = 'loading…';
      loadGoogleFont(role, name);
    });
  });

  // Upload buttons
  document.querySelectorAll('[data-font-upload]').forEach(input => {
    input.addEventListener('change', e => {
      const role = input.dataset.fontUpload;
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        injectUploadedFont(role, file.name, ev.target.result);
        const inputEl = g(`stgFont${role.toUpperCase()}`);
        if (inputEl) inputEl.value = file.name;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
  });

  // Reset buttons
  document.querySelectorAll('[data-font-reset]').forEach(btn => {
    btn.addEventListener('click', () => resetFont(btn.dataset.fontReset));
  });

  // Wire sync section
  wireSync();
}



// ═══════════════════════════════════════════════════════
// STORAGE PANEL
// Shows where the ~5MB browser storage budget is going, so a
// full disk is something you can see coming instead of something
// that silently eats a save.
// ═══════════════════════════════════════════════════════

export const STORAGE_LABELS = {
  aet_charLibrary:  'Characters',
  aet_library:      'Lorebook library',
  aet_lorebook:     'Open lorebook',
  aet_presetLibrary:'Presets',
  loreos_notebook:  'Journal',
  aet_tpl_char:     'Character templates',
  aet_tpl_lore:     'Lorebook templates',
  aet_tpl_preset:   'Prompt library',
  aet_backup_history:'Backup snapshots',
  aet_fonts:        'Custom fonts',
  aet_settings:     'Theme & settings',
};

export function fmtKB(bytes) {
  const kb = bytes / 1024;
  return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
}

export function renderStoragePanel() {
  const host = g('stgStorageBody');
  if (!host) return;

  const { rows, total, limit } = storageUsage();
  const pct = Math.min(100, (total / limit) * 100);
  const level = pct > 85 ? 'err' : pct > 60 ? 'warn' : 'ok';

  const visible = rows.filter(r => r.bytes > 512);
  const listHTML = visible.map(r => {
    const label = STORAGE_LABELS[r.key] || r.key;
    const share = Math.max(1, (r.bytes / Math.max(total, 1)) * 100);
    return `<div class="stg-storage-row">
      <span class="stg-storage-name">${esc(label)}</span>
      <span class="stg-storage-bar"><i style="width:${share.toFixed(1)}%"></i></span>
      <span class="stg-storage-val">${fmtKB(r.bytes)}</span>
    </div>`;
  }).join('') || '<div class="stg-storage-empty">// nothing stored yet</div>';

  host.innerHTML = `
    <div class="stg-storage-total ${level}">
      <div class="stg-storage-meter"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="stg-storage-caption">
        ${fmtKB(total)} used of about ${fmtKB(limit)} &nbsp;·&nbsp; ${pct.toFixed(0)}%
        ${pct > 85 ? '<br><strong>Almost full — saves may start failing.</strong>' : ''}
      </div>
    </div>
    <div class="stg-storage-list">${listHTML}</div>`;
}

// One-time cleanup: shrink avatars that were imported before
// resizing existed. Reports exactly how much it freed.
export async function optimiseStoredAvatars() {
  const btn = g('stgOptimiseAvatars');
  const ids = Object.keys(state.charLibrary || {});
  if (!ids.length) { toast('No characters to optimise.', 'warn'); return; }

  const before = storageUsage().total;
  if (btn) { btn.disabled = true; btn.textContent = 'Optimising...'; }

  let changed = 0, skipped = 0;
  for (const id of ids) {
    const entry = state.charLibrary[id];
    if (!entry || !entry.imageData) { skipped++; continue; }
    const originalLen = entry.imageData.length;
    try {
      const shrunk = await downscaleAvatar(entry.imageData, true); // explicit click overrides the keep-full setting
      // Only keep the new one if it's actually smaller
      if (shrunk && shrunk.length < originalLen) { entry.imageData = shrunk; changed++; }
      else skipped++;
    } catch(e) {
      console.error('[LoreOS] could not optimise avatar for', entry.name || id, e);
      skipped++;
    }
  }

  const saved = saveCharLibrary();
  if (btn) { btn.disabled = false; btn.textContent = 'Optimise existing avatars'; }

  if (!saved) return; // safeSet already explained
  const after = storageUsage().total;
  const freed = Math.max(0, before - after);
  renderStoragePanel();
  renderCharSidebar();
  toast(changed
    ? `Optimised ${changed} avatar${changed === 1 ? '' : 's'} — freed ${fmtKB(freed)}.`
    : 'Nothing to optimise — avatars are already small.', changed ? 'ok' : 'info');
}


// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(250, `<!-- SETTINGS MODAL (still accessible via ⚙ and settings view) -->
<div id="settingsModal" class="modal">
  <div class="modal-box lg" style="max-width:680px">
    <div class="modal-head"><h2>Settings</h2><button class="modal-x" data-close="settingsModal">×</button></div>
    <div class="modal-body">

      <div class="settings-section">
        <div class="settings-section-title">Site Title</div>
        <div style="display:flex;flex-direction:column;gap:.4rem">
          <div class="settings-row">
            <span class="settings-lbl">Main title</span>
            <input type="text" id="stgTitleMain" class="finput" placeholder="LoreOS">
          </div>
          <div class="settings-row">
            <span class="settings-lbl">Subtitle</span>
            <input type="text" id="stgTitleSub" class="finput" placeholder="v1.0">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Storage
          <button class="btn btn-s btn-sm" id="stgStorageRefresh" style="margin-left:.5rem">Refresh</button>
        </div>
        <div id="stgStorageBody"></div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-top:.7rem">
          <button class="btn btn-p btn-sm" id="stgOptimiseAvatars">Optimise existing avatars</button>
          <label class="cb-row" style="margin-left:auto">
            <input type="checkbox" id="stgKeepFullAvatars">
            <span class="flabel-sm">Keep avatars at full resolution</span>
          </label>
        </div>
        <div style="font-family:var(--fx);font-size:.65rem;color:var(--txm);line-height:1.6;margin-top:.45rem">
          Avatars are resized to 512px on import — that's the size every frontend
          displays them at, and it keeps your storage from filling up. Turn the
          toggle on if you want originals kept instead.
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Saved Themes</div>
        <div id="stgThemeSlots" style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.6rem"></div>
        <div style="display:flex;gap:.4rem">
          <input type="text" id="stgThemeSaveName" class="finput" style="flex:1" placeholder="Theme name...">
          <button class="btn btn-ok btn-sm" id="stgThemeSaveBtn">Save Current</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Colours — <span id="stgModeLabel" style="color:var(--txm);font-size:.8em">editing: dark mode</span>
          <button class="btn btn-s btn-sm" id="stgModeToggle" style="margin-left:.5rem">Switch to Light</button>
          <button class="btn btn-s btn-sm" id="stgResetTheme" style="margin-left:.25rem">Reset to Default</button>
        </div>
        <div class="settings-grid">
          <div class="settings-row"><span class="settings-lbl">Accent (--p)</span><div class="settings-color"><input type="color" data-var="--p"><input type="text" data-var="--p" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Accent hover (--ph)</span><div class="settings-color"><input type="color" data-var="--ph"><input type="text" data-var="--ph" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Accent soft (--a)</span><div class="settings-color"><input type="color" data-var="--a"><input type="text" data-var="--a" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Accent lightest (--a2)</span><div class="settings-color"><input type="color" data-var="--a2"><input type="text" data-var="--a2" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Background (--bg)</span><div class="settings-color"><input type="color" data-var="--bg"><input type="text" data-var="--bg" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Background 2 (--bg2)</span><div class="settings-color"><input type="color" data-var="--bg2"><input type="text" data-var="--bg2" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Background 3 (--bg3)</span><div class="settings-color"><input type="color" data-var="--bg3"><input type="text" data-var="--bg3" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Surface (--sf)</span><div class="settings-color"><input type="color" data-var="--sf"><input type="text" data-var="--sf" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Surface 2 (--sf2)</span><div class="settings-color"><input type="color" data-var="--sf2"><input type="text" data-var="--sf2" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Text (--tx)</span><div class="settings-color"><input type="color" data-var="--tx"><input type="text" data-var="--tx" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Text dim (--txd)</span><div class="settings-color"><input type="color" data-var="--txd"><input type="text" data-var="--txd" class="stg-hex"></div></div>
          <div class="settings-row"><span class="settings-lbl">Text muted (--txm)</span><div class="settings-color"><input type="color" data-var="--txm"><input type="text" data-var="--txm" class="stg-hex"></div></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Fonts</div>
        <div style="display:flex;flex-direction:column;gap:.65rem">
          <div style="font-family:var(--fx);font-size:.68rem;color:var(--txm);letter-spacing:.4px;line-height:1.6">
            Three font roles: <strong style="color:var(--txd)">Display</strong> · <strong style="color:var(--txd)">UI</strong> · <strong style="color:var(--txd)">Body</strong><br>
            Enter a Google Fonts name and click Load GF, or upload a file (.ttf / .woff2).
          </div>
          <div style="display:flex;flex-direction:column;gap:.3rem">
            <span class="settings-lbl">Display (--fp) — default: VT323</span>
            <div style="display:flex;gap:.4rem;align-items:center">
              <input type="text" id="stgFontFP" class="finput" style="flex:1;font-size:.78rem" placeholder="VT323">
              <button class="btn btn-s btn-sm" data-font-role="fp">Load GF</button>
              <label class="btn btn-s btn-sm" style="cursor:pointer;margin:0">Upload<input type="file" accept=".ttf,.woff,.woff2,.otf" data-font-upload="fp" style="display:none"></label>
              <button class="btn btn-err btn-sm" data-font-reset="fp" title="Reset to default">↺</button>
            </div>
            <span id="stgFontStatusFP" style="font-family:var(--fx);font-size:.65rem;color:var(--txm)"></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:.3rem">
            <span class="settings-lbl">UI (--fx) — default: Pixelify Sans</span>
            <div style="display:flex;gap:.4rem;align-items:center">
              <input type="text" id="stgFontFX" class="finput" style="flex:1;font-size:.78rem" placeholder="Pixelify Sans">
              <button class="btn btn-s btn-sm" data-font-role="fx">Load GF</button>
              <label class="btn btn-s btn-sm" style="cursor:pointer;margin:0">Upload<input type="file" accept=".ttf,.woff,.woff2,.otf" data-font-upload="fx" style="display:none"></label>
              <button class="btn btn-err btn-sm" data-font-reset="fx" title="Reset to default">↺</button>
            </div>
            <span id="stgFontStatusFX" style="font-family:var(--fx);font-size:.65rem;color:var(--txm)"></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:.3rem">
            <span class="settings-lbl">Body (--fb) — default: Noto Sans</span>
            <div style="display:flex;gap:.4rem;align-items:center">
              <input type="text" id="stgFontFB" class="finput" style="flex:1;font-size:.78rem" placeholder="Noto Sans">
              <button class="btn btn-s btn-sm" data-font-role="fb">Load GF</button>
              <label class="btn btn-s btn-sm" style="cursor:pointer;margin:0">Upload<input type="file" accept=".ttf,.woff,.woff2,.otf" data-font-upload="fb" style="display:none"></label>
              <button class="btn btn-err btn-sm" data-font-reset="fb" title="Reset to default">↺</button>
            </div>
            <span id="stgFontStatusFB" style="font-family:var(--fx);font-size:.65rem;color:var(--txm)"></span>
          </div>
        </div>
      </div>

      <div class="settings-section" id="gdriveSyncSection">
        <div class="settings-section-title">☁ Google Drive Sync</div>
        <div style="font-family:var(--fx);font-size:.68rem;color:var(--txm);line-height:1.6;margin-bottom:.5rem">
          Auto-syncs your data to a hidden app folder in your Drive — not visible in your files, only accessible by LoreOS.<br>
          Your data goes directly to your Drive, never through our servers.
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.4rem">
          <button class="btn btn-ok btn-sm" id="gdriveConnectBtn">Connect Google Drive</button>
          <button class="btn btn-err btn-sm" id="gdriveDisconnectBtn" style="display:none">Disconnect</button>
        </div>
        <div id="gdriveStatus" style="font-family:var(--fx);font-size:.68rem;margin-bottom:.4rem"></div>
        <div id="gdriveActions" style="display:none;gap:.4rem;flex-wrap:wrap;align-items:center">
          <button class="btn btn-p btn-sm" id="gdrivePushBtn">⬆ Push Now</button>
          <button class="btn btn-s btn-sm" id="gdrivePullBtn">⬇ Pull from Drive</button>
        </div>
        <div style="font-family:var(--fx);font-size:.62rem;color:var(--txm);margin-top:.5rem;line-height:1.5">
          // <a href="https://myaccount.google.com/permissions" target="_blank" style="color:var(--txm)">revoke access anytime</a> · data goes directly to your Drive, never through our servers
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">⇅ Sync</div>
        <div style="font-family:var(--fx);font-size:.68rem;color:var(--txm);line-height:1.6;margin-bottom:.5rem">
          Export your data as a <code>.json</code> backup file. Import on any device. No account needed.
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
          <button class="btn btn-p btn-sm" id="syncExportBtn">⬇ Export Backup</button>
          <button class="btn btn-s btn-sm" id="syncImportBtn">⬆ Import Backup</button>
          <button class="btn btn-s btn-sm" id="syncHistoryBtn">🕓 History</button>
          <input type="file" id="syncImportFile" accept=".json" style="display:none">
        </div>
        <div class="sync-status" id="syncStatus" style="margin-top:.4rem"></div>
      </div>

      <div class="modal-foot" style="justify-content:space-between">
        <button class="btn btn-s" data-close="settingsModal">Close</button>
        <button class="btn btn-p" id="stgApplyBtn">Apply</button>
      </div>
    </div>
  </div>
</div>`);

