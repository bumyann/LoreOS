// ═══════════════════════════════════════════════════════
// PIXEL SPRITES — the little coloured pictures that furnish the rooms (a mug, a plant, a cat, a lamp...).
// Each is rows of letters, one letter per pixel; the letters map to a fixed cosy palette. Drawn as crisp SVG.
//   sprite('mug', 4)  -> an <svg> string, 4 screen pixels per sprite pixel
// ═══════════════════════════════════════════════════════
const PAL = {"k": "#2b2233", "n": "#8a5a3a", "N": "#b8864f", "w": "#f3ead2", "r": "#c8554a", "R": "#e07a6a", "o": "#e8913a", "y": "#f2d45c", "Y": "#fff0a0", "g": "#4f9a58", "G": "#86c97a", "b": "#4f7fc4", "B": "#8fb4ea", "p": "#b07ac0", "s": "#d9c9b0", "S": "#a89880", "W": "#ffffff", "d": "#4a3b52", "e": "#6b5a73", "t": "#7a4a2a", "c": "#e8b88a"};
const ROWS = {
  mug: [
    '............',
    '...kkkkkk...',
    '..kwwwwwwk..',
    '..kwwwwwwkkk',
    '..kwoooowk.k',
    '..kwoooowk.k',
    '..kwwwwwwkk.',
    '..kwwwwwwk..',
    '...kwwwwk...',
    '....kkkk....'
  ],
  plant: [
    '......GG..........',
    '....GGggG.........',
    '...GgggggG..GG....',
    '..GggGgggggGggG...',
    '...gggGgggggggG...',
    '....gggggGggg.....',
    '.....gggggg.......',
    '......kkkk........',
    '.....kttttk.......',
    '.....kttttk.......',
    '......kttk........',
    '......kkkk........'
  ],
  books: [
    '..kkkkkkkkkkkk..',
    '.kbbbbbbbbbbbbk.',
    '.kBBBBBBBBBBBBk.',
    '.kkkkkkkkkkkkkk.',
    '..krrrrrrrrrrk..',
    '..kRRRRRRRRRRk..',
    '..kkkkkkkkkkkk..',
    '.kyyyyyyyyyyyyk.',
    '.kkkkkkkkkkkkkk.'
  ],
  cat: [
    '........................',
    '...k..k.................',
    '..kok.kok...............',
    '..koookok...............',
    '..kokokok...kkkkkkkk....',
    '..kooooook.kooooooook...',
    '...kkkkkkkkooooooooook..',
    '..kooooooooooooooooook..',
    '.koooooooooooooooooook..',
    '.kooooooooooooooooookk..',
    '..kkoooooooooooooookkk..',
    '....kkkkkkkkkkkkkkkk....'
  ],
  lamp: [
    '.....kkkkkkk....',
    '....kyyyyyyyk...',
    '...kyyYYYYYyyk..',
    '..kyyYYYYYYYyyk.',
    '..kkkkkkkkkkkkk.',
    '.......kk.......',
    '.......ke.......',
    '.......ke.......',
    '......kek.......',
    '.....kek........',
    '....kek.........',
    '...kekkkkkk.....',
    '..kkdddddddk....',
    '..kddddddddk....',
    '..kkkkkkkkkk....'
  ],
  window: [
    'kkkkkkkkkkkkkkkkkkkkkkk',
    'kNNNNNNNNNNNNNNNNNNNNNk',
    'kNdddddddddNdddddddddNk',
    'kNdddWdddddNdddddddddNk',
    'kNdddddddddNdddddddyyNk',
    'kNdddddddddNddddddyYyNk',
    'kNdddddddddNdddddddyyNk',
    'kNdddddWdddNdddddddddNk',
    'kNdddddddddNdddddddddNk',
    'kNNNNNNNNNNNNNNNNNNNNNk',
    'kNdddddddddNdddddddddNk',
    'kNdddddddddNdddddddddNk',
    'kNdWddddddddNdddddWdddNk',
    'kNdddddddddNdddddddddNk',
    'kNdddddddddNdddddddddNk',
    'kNNNNNNNNNNNNNNNNNNNNNk',
    'kkkkkkkkkkkkkkkkkkkkkkk'
  ],
  pencils: [
    '...k..k..k..',
    '..kyk.kbk.kr',
    '..kyk.kbk.kr',
    '..kyk.kbk.kr',
    '.kkkkkkkkkkk',
    '.kNNNNNNNNNk',
    '.kNNNNNNNNNk',
    '.kNNNNNNNNNk',
    '.kkkkkkkkkkk'
  ],
};
ROWS.windowday = ROWS.window.map(r => r.replace(/d/g, 'B'));   // the same window by day: light panes
export const SPRITE_NAMES = Object.keys(ROWS);
const cache = new Map();
export function sprite(name, scale = 4, cls = '') {
  const rows = ROWS[name]; if (!rows) return '';
  const key = name + '|' + scale + '|' + cls; if (cache.has(key)) return cache.get(key);
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, byColour = {};
  rows.forEach((r, y) => { let x = 0; while (x < r.length) { const c = r[x]; if (!PAL[c]) { x++; continue; } let n = 1; while (r[x + n] === c) n++; (byColour[c] = byColour[c] || []).push(`M${x} ${y}h${n}v1h-${n}z`); x += n; } });
  const paths = Object.entries(byColour).map(([c, d]) => `<path fill="${PAL[c]}" d="${d.join('')}"/>`).join('');
  const svg = `<svg class="spr spr-${name}${cls ? ' ' + cls : ''}" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${paths}</svg>`;
  cache.set(key, svg); return svg;
}

// The cosy studio across the top of Home: a window (day or night by the clock), a shelf, a lamp, a plant, a cat on a rug
export function studioHtml(hour = new Date().getHours()) {
  const day = hour >= 6 && hour < 19;
  return `<div class="studio ${day ? 'day' : 'night'}" aria-hidden="true">
    <i class="st-floor"></i>
    <span class="st-window">${sprite(day ? 'windowday' : 'window', 5)}</span>
    <span class="st-shelf"><i class="st-plank"></i><span class="st-books">${sprite('books', 4)}</span><span class="st-pot">${sprite('plant', 3)}</span></span>
    <span class="st-lamp">${sprite('lamp', 5)}<i class="st-glow"></i></span>
    <span class="st-rug"></span>
    <span class="st-cat">${sprite('cat', 5)}</span>
    <span class="st-plant">${sprite('plant', 5)}</span>
    <span class="st-mug">${sprite('mug', 4)}<i class="steam"></i></span>
  </div>`;
}
