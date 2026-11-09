// ═══════════════════════════════════════════════════════
// APPEARANCE — how LoreOS is laid out and dressed, kept apart from Theme (colours and fonts):
//   pixel     the pixel-art rooms: bookshelf, desk and notebook, clothesline gallery (css/webcore.css and css/game.css)
//   standard  the plain application look (css/base.css and css/components.css only)
// Both show the same data and run the same code. Pixel is the default. The two pixel stylesheets are switched on and off
// (their <link> tags carry data-pixel-css), and <html data-appearance> is there for scripts and custom CSS to target.
// js/appearance_boot.js does the same thing before the first paint, so a Standard page does not flash pixel for a moment.
// ═══════════════════════════════════════════════════════
const KEY = 'loreos_appearance';

export const appearance = () => { try { return localStorage.getItem(KEY) === 'standard' ? 'standard' : 'pixel'; } catch (e) { return 'pixel'; } };

export function applyAppearance(v = appearance()) {
  document.documentElement.dataset.appearance = v;
  document.querySelectorAll('link[data-pixel-css]').forEach(l => { l.media = v === 'pixel' ? 'all' : 'not all'; });
}

export function setAppearance(v) {
  try { localStorage.setItem(KEY, v === 'standard' ? 'standard' : 'pixel'); } catch (e) { /* private mode: lasts until the page closes */ }
  applyAppearance(v === 'standard' ? 'standard' : 'pixel');
}
