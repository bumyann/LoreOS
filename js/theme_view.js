// ═══════════════════════════════════════════════════════
// THEME VIEW — a page of its own for how LoreOS looks: preset colours, preset themes, the name and subheading,
// the logo and icon, colours, fonts, and a box for custom CSS.
//
//   Preset colours  change only the palette (light and dark). Built-in ones, plus the ones you save.
//   Preset themes   change everything: palette, fonts, name, and custom CSS. Built-in ones, plus the ones you save,
//                   and any theme can be exported to a file and imported from one.
//
// Custom CSS is cleaned before it is used (no @import, no pictures or fonts from other sites), and ?safe=1 on the
// address turns it off, in case a style ever hides the page.
// ═══════════════════════════════════════════════════════
import { PALETTES, THEME_PRESETS, normalizeTheme, themeFromCurrent } from './theme_presets.js';
import { CSS_MAX, FONT_ROLES, applyCustomCss, applyCustomTheme, applyCustomTitle, fillThemeEditors, fontsGet, loadGoogleFont, populateColourPickers, previewCss, resetFont, settingsGet, settingsSet } from './settings.js';
import { appearance, setAppearance } from './appearance.js';
import { applyLogo, renderLogoSettings, wireLogoSettings } from './logo.js';
import { askConfirm, dlFile, esc, g, toast } from './util.js';

let presetTab = 'colours';   // colours | themes
let cssTimer = null;

export function buildThemeView() {
  const host = g('theme-content'); if (!host || host.dataset.built) return;
  host.dataset.built = '1';
  host.innerHTML = `<div class="theme-page">
  <header class="theme-head">
    <h1>Theme</h1>
    <p>How LoreOS looks. Presets apply right away. Colour, name and font edits show as you make them, and <b>Save</b> keeps them.</p>
  </header>

  <section class="settings-section theme-card" id="thAppearance">
    <div class="settings-section-title">Appearance</div>
    <div class="rx-none" style="margin-bottom:.6rem">How LoreOS is laid out. Your theme (colours, fonts, CSS) applies to either one.</div>
    <div class="theme-tabs" role="radiogroup" aria-label="Appearance">
      <button type="button" class="theme-tab" role="radio" data-appearance="pixel" aria-checked="false"><b>Pixel</b></button>
      <button type="button" class="theme-tab" role="radio" data-appearance="standard" aria-checked="false"><b>Standard</b></button>
    </div>
    <div class="rx-none" id="thAppearanceNote"></div>
  </section>

  <section class="settings-section theme-card" id="thPresets">
    <div class="settings-section-title">Presets</div>
    <div class="theme-tabs" role="tablist">
      <button type="button" role="tab" class="theme-tab" data-thtab="colours">Preset colours</button>
      <button type="button" role="tab" class="theme-tab" data-thtab="themes">Preset themes</button>
    </div>
    <div class="rx-none" id="thPresetNote"></div>
    <div id="thPresetBody"></div>
  </section>

        <div class="settings-section theme-card">
        <div class="settings-section-title">Name and subheading</div>
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


        <div class="settings-section theme-card">
        <div class="settings-section-title">Icon and logo</div>
        <div id="stgLogoBody"></div>
      </div>


        <div class="settings-section theme-card">
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


        <div class="settings-section theme-card">
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



  <section class="settings-section theme-card" id="thCss">
    <div class="settings-section-title">Custom CSS <label class="cb-row" style="margin-left:auto"><input type="checkbox" id="thCssOn" checked><span class="flabel-sm">on</span></label></div>
    <div class="rx-none">Write your own styles to make a theme of your own. Everything saves as you type. The page uses variables like <code>--p</code> (accent), <code>--bg</code> and <code>--tx</code>, so <code>body { --p: hotpink; }</code> already changes a lot.</div>
    <textarea id="thCssText" class="ftextarea theme-css" spellcheck="false" rows="12" placeholder="/* for example */&#10;.nav-item:hover { outline: 2px dotted var(--p); }" maxlength="${CSS_MAX}"></textarea>
    <div class="pr-row"><span class="rx-none" id="thCssInfo"></span><button type="button" class="btn btn-s btn-sm" id="thCssClear" style="margin-left:auto">Clear</button></div>
    <div class="rx-none">Pictures and fonts from other sites are blocked in custom CSS (use <code>data:</code> pictures, or the Fonts box above). If a style ever hides the page, open LoreOS with <code>?safe=1</code> on the end of the address to turn it off.</div>
  </section>

  <div class="theme-savebar">
    <button class="btn btn-p" id="stgApplyBtn" type="button">Save</button>
    <button class="btn btn-s" id="stgRevertBtn" type="button">Undo unsaved changes</button>
  </div>
</div>`;
}

// ── Presets ──
const swatches = c => ['--bg', '--sf', '--p', '--a', '--tx'].map(v => `<i style="background:${esc((c || {})[v] || '#000')}"></i>`).join('');
const card = (kind, id, name, sub, sw, mine) => `<div class="theme-preset" data-kind="${kind}" data-id="${esc(id)}"><div class="theme-preset-sw">${sw}</div><div class="theme-preset-name">${esc(name)}</div>${sub ? `<div class="theme-preset-sub">${esc(sub)}</div>` : ''}<div class="theme-preset-act"><button type="button" class="btn btn-p btn-sm" data-act="apply">Apply</button>${mine ? '<button type="button" class="btn btn-s btn-sm" data-act="export" title="Save to a file">⇩</button><button type="button" class="btn btn-err btn-sm" data-act="delete" title="Delete">✕</button>' : ''}</div></div>`;

export function renderPresets() {
  const body = g('thPresetBody'), note = g('thPresetNote'); if (!body) return;
  const cfg = settingsGet();
  document.querySelectorAll('#thPresets [data-thtab]').forEach(t => { const on = t.dataset.thtab === presetTab; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); });
  if (presetTab === 'colours') {
    note.textContent = 'Just the palette, for light and dark. Your fonts, name and CSS stay as they are.';
    const mine = Object.entries(cfg.savedThemes || {});
    body.innerHTML = `<div class="theme-grid">${PALETTES.map(p => card('colour-built', p.id, p.name, '', swatches(p.dark), false)).join('')}${mine.map(([n, t]) => card('colour-mine', n, n, 'yours', swatches(t.dark), true)).join('')}</div>
      <div class="pr-row" style="margin-top:.6rem"><input type="text" id="thSaveColourName" class="finput" style="flex:1" placeholder="Name this palette..." maxlength="40"><button type="button" class="btn btn-ok btn-sm" id="thSaveColour">Save current colours</button></div>`;
  } else {
    note.textContent = 'The whole look: palette, fonts, name, and custom CSS. Applying one replaces your CSS.';
    const mine = Object.entries(cfg.savedFullThemes || {});
    body.innerHTML = `<div class="theme-grid">${THEME_PRESETS.map(t => card('theme-built', t.id, t.name, t.blurb, swatches(t.colours.dark), false)).join('')}${mine.map(([n, t]) => card('theme-mine', n, n, 'yours', swatches((t.colours || {}).dark), true)).join('')}</div>
      <div class="pr-row" style="margin-top:.6rem"><input type="text" id="thSaveThemeName" class="finput" style="flex:1" placeholder="Name this theme..." maxlength="40"><button type="button" class="btn btn-ok btn-sm" id="thSaveTheme">Save current look</button><button type="button" class="btn btn-s btn-sm" id="thImportTheme">Import file</button></div>
      <input type="file" id="thImportFile" accept=".json,application/json" style="display:none">`;
  }
}

function refreshEditors() {
  const cfg = settingsGet();
  fillThemeEditors();
  g('thCssText').value = cfg.customCss || ''; g('thCssOn').checked = cfg.customCssOn !== false; cssInfo();
  renderLogoSettings();
}
const cssInfo = () => { const n = g('thCssText').value.length; g('thCssInfo').textContent = n ? `${n.toLocaleString()} characters` : 'empty'; };

// A palette from a preset or a saved colour set, written to both modes
export function applyPalette(dark, pink) {
  const cfg = settingsGet(); cfg.colours = { dark: { ...dark }, pink: { ...pink } };
  settingsSet(cfg); applyCustomTheme(); populateColourPickers();
}
export function applyThemePreset(raw) {
  const t = normalizeTheme(raw); if (!t) { toast('That theme file is not one I can read.', 'err'); return false; }
  const cfg = settingsGet();
  cfg.colours = { dark: { ...t.colours.dark }, pink: { ...t.colours.pink } };
  if (t.titleMain !== null) cfg.titleMain = t.titleMain;
  if (t.titleSub !== null) cfg.titleSub = t.titleSub;
  cfg.customCss = t.css; cfg.customCssOn = true;
  settingsSet(cfg);
  // fonts: Google fonts by name; a role the theme does not name goes back to its default
  Object.keys(FONT_ROLES).forEach(role => { if (t.fonts[role]) loadGoogleFont(role, t.fonts[role], true); else if (fontsGet()[role]) resetFont(role); });
  applyCustomTheme(); applyCustomTitle(); applyCustomCss(); refreshEditors();
  return true;
}

const APPEARANCE_NOTES = {
  pixel: 'The pixel-art rooms: a bookshelf Library, a clothesline Gallery, and a Journal you can open as a notebook on a desk.',
  standard: 'The plain application look: cards, panels and a full-screen Journal. Nothing about your data changes.',
};
function paintAppearance() {
  const cur = appearance();
  document.querySelectorAll('#thAppearance [data-appearance]').forEach(b => { const on = b.dataset.appearance === cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  const n = g('thAppearanceNote'); if (n) n.textContent = APPEARANCE_NOTES[cur];
}
function wireAppearance() {
  const host = g('thAppearance'); if (!host) return;
  host.addEventListener('click', e => { const b = e.target.closest('[data-appearance]'); if (!b) return; setAppearance(b.dataset.appearance); paintAppearance(); toast(b.dataset.appearance === 'standard' ? 'Standard appearance.' : 'Pixel appearance.', 'ok'); });
  paintAppearance();
}

function wirePresets() {
  const host = g('thPresets');
  host.addEventListener('click', async e => {
    const tab = e.target.closest('[data-thtab]'); if (tab) { presetTab = tab.dataset.thtab; renderPresets(); return; }
    const cfg = settingsGet();
    if (e.target.id === 'thSaveColour') {
      const name = g('thSaveColourName').value.trim(); if (!name) { toast('Give the palette a name.', 'warn'); return; }
      cfg.savedThemes = cfg.savedThemes || {};
      cfg.savedThemes[name] = { dark: { ...DEFAULT_FROM(cfg).dark }, pink: { ...DEFAULT_FROM(cfg).pink } };
      settingsSet(cfg); renderPresets(); toast(`Saved the palette "${name}".`, 'ok'); return;
    }
    if (e.target.id === 'thSaveTheme') {
      const name = g('thSaveThemeName').value.trim(); if (!name) { toast('Give the theme a name.', 'warn'); return; }
      cfg.savedFullThemes = cfg.savedFullThemes || {};
      cfg.savedFullThemes[name] = themeFromCurrent(name, cfg, fontsGet());
      if (!settingsSet(cfg)) { toast('Could not save (is the storage full?).', 'err'); return; }
      renderPresets(); toast(`Saved the theme "${name}".`, 'ok'); return;
    }
    if (e.target.id === 'thImportTheme') { g('thImportFile').click(); return; }
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const el = btn.closest('.theme-preset'), kind = el.dataset.kind, id = el.dataset.id, act = btn.dataset.act;
    if (kind === 'colour-built' || kind === 'colour-mine') {
      const p = kind === 'colour-built' ? PALETTES.find(x => x.id === id) : (cfg.savedThemes || {})[id];
      if (!p) return;
      if (act === 'apply') { applyPalette(p.dark, p.pink); toast('Colours applied.', 'ok'); }
      else if (act === 'delete') { if (!await askConfirm(`Delete the palette "${id}"?`)) return; delete cfg.savedThemes[id]; settingsSet(cfg); renderPresets(); }
      else if (act === 'export') dlFile(JSON.stringify({ kind: 'loreos-palette', name: id, dark: p.dark, pink: p.pink }, null, 2), id + '.palette.json', 'application/json');
    } else {
      const t = kind === 'theme-built' ? THEME_PRESETS.find(x => x.id === id) : (cfg.savedFullThemes || {})[id];
      if (!t) return;
      if (act === 'apply') { if (applyThemePreset(t)) toast(`Theme "${t.name || id}" applied.`, 'ok'); }
      else if (act === 'delete') { if (!await askConfirm(`Delete the theme "${id}"?`)) return; delete cfg.savedFullThemes[id]; settingsSet(cfg); renderPresets(); }
      else if (act === 'export') dlFile(JSON.stringify(t, null, 2), id.replace(/[^\w\- ]+/g, '') + '.theme.json', 'application/json');
    }
  });
  host.addEventListener('change', async e => {
    if (e.target.id !== 'thImportFile') return;
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.kind === 'loreos-palette' && j.dark && j.pink) { const cfg = settingsGet(); cfg.savedThemes = cfg.savedThemes || {}; cfg.savedThemes[String(j.name || f.name).slice(0, 40)] = { dark: j.dark, pink: j.pink }; settingsSet(cfg); presetTab = 'colours'; renderPresets(); toast('Palette imported.', 'ok'); return; }
      const t = normalizeTheme(j); if (!t) throw new Error('not a theme');
      const cfg = settingsGet(); cfg.savedFullThemes = cfg.savedFullThemes || {}; cfg.savedFullThemes[(t.name || f.name.replace(/\.[^.]+$/, '')).slice(0, 40)] = t;
      settingsSet(cfg); renderPresets(); toast('Theme imported. Press Apply on it to use it.', 'ok');
    } catch (err) { toast('That file is not a LoreOS theme.', 'err'); }
  });
}
// the colours as currently chosen in the editor (not yet saved), for both modes
function DEFAULT_FROM(cfg) {
  const c = cfg.colours || {};
  return { dark: { ...(PALETTES[0].dark), ...(c.dark || {}) }, pink: { ...(PALETTES[0].pink), ...(c.pink || {}) } };
}

// ── Custom CSS ──
function wireCss() {
  const ta = g('thCssText');
  const save = () => { const cfg = settingsGet(); cfg.customCss = ta.value.slice(0, CSS_MAX); cfg.customCssOn = g('thCssOn').checked; settingsSet(cfg); applyCustomCss(); };
  ta.addEventListener('input', () => { cssInfo(); previewCss(g('thCssOn').checked ? ta.value : ''); clearTimeout(cssTimer); cssTimer = setTimeout(save, 700); });
  g('thCssOn').addEventListener('change', save);
  g('thCssClear').addEventListener('click', async () => { if (!ta.value || !await askConfirm('Clear all your custom CSS?')) return; ta.value = ''; cssInfo(); save(); });
}

export function wireThemeView() {
  buildThemeView();
  wireAppearance(); wirePresets(); wireCss();
  g('stgRevertBtn').addEventListener('click', () => { applyCustomTheme(); applyCustomTitle(); refreshEditors(); toast('Back to what was saved.', 'ok'); });
}
export function openThemeView() { buildThemeView(); renderPresets(); refreshEditors(); wireLogoSettings(); }
export { applyLogo };
