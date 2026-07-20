// ═══════════════════════════════════════════════════════
// SETTINGS — theme customization + title editor
// ═══════════════════════════════════════════════════════

// Default colour values for both modes
const DEFAULT_THEMES = {
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

const COLOUR_VARS = ['--p','--ph','--a','--a2','--bg','--bg2','--bg3','--sf','--sf2','--tx','--txd','--txm'];

let stgEditingMode = 'dark'; // which mode we're currently editing colours for

function settingsGet() {
  try { return JSON.parse(localStorage.getItem('aet_settings') || '{}'); } catch(e) { return {}; }
}
function settingsSet(d) { localStorage.setItem('aet_settings', JSON.stringify(d)); }

function applyCustomTheme() {
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

function applyCustomTitle() {
  const cfg = settingsGet();
  const titleEl = document.querySelector('#title');
  if (!titleEl) return;
  const main = cfg.titleMain || 'LoreOS';
  const sub = cfg.titleSub !== undefined ? cfg.titleSub : 'Universal Editor';
  titleEl.innerHTML = main + (sub ? `<span>// ${sub}</span>` : '');
  document.title = main + (sub ? ' // ' + sub : '');
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Called on page load
function applyAllCustomisations() {
  applyCustomTheme();
  applyCustomTitle();
}

function openSettings() {
  const cfg = settingsGet();
  // Title
  g('stgTitleMain').value = cfg.titleMain || 'LoreOS';
  g('stgTitleSub').value = cfg.titleSub !== undefined ? cfg.titleSub : 'Universal Editor';
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
  openModal('settingsModal');
}

function updateSettingsModeLabel() {
  const activeMode = document.body.classList.contains('pink') ? 'pink' : 'dark';
  const isActive = stgEditingMode === activeMode;
  g('stgModeLabel').textContent = `editing: ${stgEditingMode} mode${isActive ? ' (live preview)' : ' (apply to see changes)'}`;
  g('stgModeToggle').textContent = stgEditingMode === 'dark' ? 'Switch to Light' : 'Switch to Dark';
}

function populateColourPickers() {
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

function wireSettings() {
  g('settingsBtn').addEventListener('click', openSettings);

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
      localStorage.setItem('aet_theme', editingPink ? 'pink' : 'dark');
    }

    applyCustomTheme();
    applyCustomTitle();
    closeModal('settingsModal');
    toast('Settings applied.', 'ok');
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
      titleSub:  cfg.titleSub !== undefined ? cfg.titleSub : 'Universal Editor',
    };
    settingsSet(cfg);
    g('stgThemeSaveName').value = '';
    renderThemeSlots();
    toast(`Theme "${name}" saved.`, 'ok');
  });
}

function renderThemeSlots() {
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

function loadThemeSlot(name, themeData) {
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

const FONT_ROLES = { fp: '--fp', fx: '--fx', fb: '--fb' };
const FONT_DEFAULTS = { fp: 'VT323', fx: 'Pixelify Sans', fb: 'Noto Sans' };
const FONT_STORAGE_KEY = 'aet_fonts';

function fontsGet() { try { return JSON.parse(localStorage.getItem(FONT_STORAGE_KEY) || '{}'); } catch(e) { return {}; } }
function fontsSet(d) { localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(d)); }

// Apply saved fonts on load
function applyFonts() {
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

function loadGoogleFont(role, name, save = true) {
  const cssVar = FONT_ROLES[role];
  const linkId = `gf-font-${role}`;
  const existing = document.getElementById(linkId);
  if (existing) existing.remove();

  const urlName = name.trim().replace(/ /g, '+');
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${urlName}&display=swap`;
  link.onload = () => {
    document.body.style.setProperty(cssVar, `'${name.trim()}', sans-serif`);
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

function injectUploadedFont(role, name, dataUrl, save = true) {
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

  const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
  if (statusEl) statusEl.textContent = `✓ loaded "${name}" from file`;

  if (save) {
    const d = fontsGet(); d[role] = { type: 'upload', name, dataUrl }; fontsSet(d);
  }
}

function resetFont(role) {
  const cssVar = FONT_ROLES[role];
  const defaultName = FONT_DEFAULTS[role];
  // remove any injected style/link
  document.getElementById(`gf-font-${role}`)?.remove();
  document.getElementById(`uploaded-font-${role}`)?.remove();
  document.body.style.removeProperty(cssVar);
  // clear from storage
  const d = fontsGet(); delete d[role]; fontsSet(d);
  const inputEl = g(`stgFont${role.toUpperCase()}`);
  const statusEl = g(`stgFontStatus${role.toUpperCase()}`);
  if (inputEl) inputEl.value = '';
  if (statusEl) statusEl.textContent = `↺ reset to ${defaultName}`;
  toast(`Font reset to ${defaultName}.`, 'ok');
}

function wireFonts() {
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

