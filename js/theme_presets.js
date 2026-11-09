// ═══════════════════════════════════════════════════════
// THEME PRESETS — the built-in palettes ("preset colours") and full looks ("preset themes"), and the shape of a theme file.
//
//   palette  { id, name, dark: { '--p': '#...', ... }, pink: { ... } }       (pink is the light mode)
//   theme    { kind: 'loreos-theme', v: 1, name, blurb, colours: { dark, pink }, fonts: { fp, fx, fb } (Google font names),
//              titleMain, titleSub (null = leave the name alone), css }
// ═══════════════════════════════════════════════════════
import { COLOUR_VARS, CSS_MAX, DEFAULT_THEMES } from './settings.js';

const hex = (h, s, l) => {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
};
// A whole palette from one hue: the same recipe the default colours follow, so every one looks related
const fromHue = (h, sat = 1) => ({
  dark: { '--p': hex(h, 40 * sat, 67), '--ph': hex(h, 32 * sat, 55), '--a': hex(h, 55 * sat, 82), '--a2': hex(h, 60 * sat, 94), '--bg': hex(h, 40 * sat, 6), '--bg2': hex(h, 38 * sat, 8), '--bg3': hex(h, 36 * sat, 11), '--sf': hex(h, 30 * sat, 14), '--sf2': hex(h, 30 * sat, 19), '--tx': hex(h, 55 * sat, 92), '--txd': hex(h, 30 * sat, 74), '--txm': hex(h, 20 * sat, 62) },
  pink: { '--p': hex(h, 28 * sat, 57), '--ph': hex(h, 28 * sat, 45), '--a': hex(h, 35 * sat, 66), '--a2': hex(h, 45 * sat, 95), '--bg': hex(h, 45 * sat, 94), '--bg2': hex(h, 30 * sat, 90), '--bg3': hex(h, 25 * sat, 86), '--sf': hex(h, 22 * sat, 80), '--sf2': hex(h, 22 * sat, 74), '--tx': hex(h, 30 * sat, 14), '--txd': hex(h, 24 * sat, 28), '--txm': hex(h, 22 * sat, 36) },
});

export const PALETTES = [
  { id: 'ink', name: 'Ink blue (default)', dark: { ...DEFAULT_THEMES.dark }, pink: { ...DEFAULT_THEMES.pink } },
  { id: 'rose', name: 'Rose quartz', ...fromHue(335) },
  { id: 'mint', name: 'Mint', ...fromHue(155) },
  { id: 'amber', name: 'Amber', ...fromHue(36, 1.3) },
  { id: 'grape', name: 'Grape soda', ...fromHue(275) },
  { id: 'teal', name: 'Deep teal', ...fromHue(185) },
  { id: 'crimson', name: 'Crimson', ...fromHue(355, 1.2) },
  { id: 'slate', name: 'Slate', ...fromHue(215, 0.35) },
];

const full = (dark, pink) => ({ dark: { ...DEFAULT_THEMES.dark, ...dark }, pink: { ...DEFAULT_THEMES.pink, ...pink } });

export const THEME_PRESETS = [
  { id: 'webcore', name: 'Webcore OS', blurb: 'The default look: ink blue, pixel fonts, a little window chrome.', colours: full({}, {}), fonts: {}, titleMain: null, titleSub: null, css: '' },
  {
    id: 'terminal', name: 'Terminal', blurb: 'Green phosphor on black, with scanlines.',
    colours: full(
      { '--p': '#33ff66', '--ph': '#22cc52', '--a': '#7dffa0', '--a2': '#d9ffe5', '--bg': '#010a03', '--bg2': '#03130a', '--bg3': '#061d0e', '--sf': '#08260f', '--sf2': '#0d3516', '--tx': '#b8ffcc', '--txd': '#6fd68e', '--txm': '#4fa86b' },
      { '--p': '#1c8a3a', '--ph': '#146b2c', '--a': '#3fae5d', '--a2': '#eaf8ee', '--bg': '#e7f5ea', '--bg2': '#d9eddd', '--bg3': '#c9e3cf', '--sf': '#b6d6be', '--sf2': '#a3c9ad', '--tx': '#0c2a14', '--txd': '#1c4a29', '--txm': '#2d6340' }),
    fonts: { fp: 'VT323', fx: 'VT323', fb: 'IBM Plex Mono' }, titleMain: null, titleSub: null,
    css: `/* Terminal */
body::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 9999; background: repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px); }
.btn, .finput, .ftextarea, .fselect, .nav-item { border-radius: 0 !important; }
.btn-p { box-shadow: 0 0 10px var(--pg); }
::selection { background: var(--p); color: var(--bg); }`,
  },
  {
    id: 'zine', name: 'Paper zine', blurb: 'Cream paper, heavy ink outlines, offset shadows.',
    colours: full(
      { '--p': '#ffd84d', '--ph': '#e6bd2e', '--a': '#ffe58a', '--a2': '#fff6d1', '--bg': '#17140f', '--bg2': '#1e1a13', '--bg3': '#27211a', '--sf': '#2f2920', '--sf2': '#3a3328', '--tx': '#f6efdc', '--txd': '#cfc6ae', '--txm': '#a79f88' },
      { '--p': '#d64545', '--ph': '#b53030', '--a': '#e57a7a', '--a2': '#fbf6ea', '--bg': '#f4efe3', '--bg2': '#ebe4d3', '--bg3': '#e0d7c2', '--sf': '#d6cbb1', '--sf2': '#c9bc9d', '--tx': '#1d1a14', '--txd': '#3a342a', '--txm': '#564e40' }),
    fonts: { fp: 'Special Elite', fx: 'Space Mono', fb: 'Lora' }, titleMain: null, titleSub: null,
    css: `/* Paper zine */
.btn, .finput, .ftextarea, .fselect, .theme-card, .gal-item, .home-card { border: 2px solid var(--tx) !important; border-radius: 2px !important; }
.btn, .theme-card, .gal-item { box-shadow: 3px 3px 0 var(--tx); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--tx); }`,
  },
  {
    id: 'arcade', name: 'Bubblegum arcade', blurb: 'Deep purple with hot pink and cyan, chunky pixel edges.',
    colours: full(
      { '--p': '#ff6ec7', '--ph': '#e04aa8', '--a': '#6ef0ff', '--a2': '#e9fcff', '--bg': '#0d0221', '--bg2': '#150433', '--bg3': '#1d0a45', '--sf': '#26125a', '--sf2': '#321a73', '--tx': '#f6e8ff', '--txd': '#c9b4e6', '--txm': '#a28bc6' },
      { '--p': '#d6359b', '--ph': '#b02681', '--a': '#2fb8cc', '--a2': '#fdf0fb', '--bg': '#fdf0fb', '--bg2': '#f6e1f3', '--bg3': '#eccfe8', '--sf': '#e0bcdc', '--sf2': '#d3a8cf', '--tx': '#2a0c33', '--txd': '#4b2556', '--txm': '#6a3d78' }),
    fonts: { fp: 'Press Start 2P', fx: 'Pixelify Sans', fb: 'Noto Sans' }, titleMain: null, titleSub: null,
    css: `/* Bubblegum arcade */
.btn, .finput, .ftextarea, .fselect { border-radius: 0 !important; border-width: 2px !important; }
.btn-p { box-shadow: 3px 3px 0 var(--a); }
.nav-item.active { box-shadow: inset 3px 0 0 var(--a); }`,
  },
];

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const cleanSet = (raw, base) => {
  const out = { ...base };
  if (raw && typeof raw === 'object') COLOUR_VARS.forEach(v => { if (typeof raw[v] === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw[v])) out[v] = raw[v].toLowerCase(); });
  return out;
};
// Read a theme from a file or from saved settings. Returns null if it is not one.
export function normalizeTheme(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.kind && raw.kind !== 'loreos-theme') return null;
  const c = raw.colours && typeof raw.colours === 'object' ? raw.colours : null;
  if (!c && typeof raw.css !== 'string') return null;
  const fonts = {};
  ['fp', 'fx', 'fb'].forEach(r => { const n = raw.fonts && str(raw.fonts[r], 60).trim(); if (n && /^[\w \-+&.]+$/.test(n)) fonts[r] = n; });
  return {
    kind: 'loreos-theme', v: 1, name: str(raw.name, 40).trim(), blurb: str(raw.blurb, 120),
    colours: { dark: cleanSet(c && c.dark, DEFAULT_THEMES.dark), pink: cleanSet(c && c.pink, DEFAULT_THEMES.pink) },
    fonts, titleMain: typeof raw.titleMain === 'string' ? str(raw.titleMain, 40) : null, titleSub: typeof raw.titleSub === 'string' ? str(raw.titleSub, 60) : null,
    css: str(raw.css, CSS_MAX),
  };
}
// The look as it is right now, as a theme (uploaded fonts are left out: they are too big to carry in a theme)
export function themeFromCurrent(name, cfg, fonts) {
  const f = {}; ['fp', 'fx', 'fb'].forEach(r => { if (fonts && fonts[r] && fonts[r].type === 'gf') f[r] = fonts[r].name; });
  const c = cfg.colours || {};
  return normalizeTheme({ kind: 'loreos-theme', name, colours: { dark: { ...DEFAULT_THEMES.dark, ...(c.dark || {}) }, pink: { ...DEFAULT_THEMES.pink, ...(c.pink || {}) } }, fonts: f, titleMain: cfg.titleMain || null, titleSub: cfg.titleSub !== undefined ? cfg.titleSub : null, css: cfg.customCss || '' });
}
