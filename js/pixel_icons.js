// ═══════════════════════════════════════════════════════
// PIXEL ICONS — the little 16 x 16 pictures that stand in for symbols across the app.
// Each icon is a bitmap (16 rows of 4 hex digits, one bit per pixel) drawn as crisp squares in the current text
// colour, so they follow the theme and stay sharp at any size.
//
//   px('home')            -> an <svg> string for building markup
//   hydratePixelIcons(el)  -> turns <span data-px="home"></span>, and the old text symbols in the nav and
//                            mobile bar, into icons
// ═══════════════════════════════════════════════════════
const BITS = {
  'lock': '000007c00820082008203ff83ff83d783d783ff83ff800000000000000000000',
  'unlock': '000007c00820080008003ff83ff83d783d783ff83ff800000000000000000000',
  'home': '0000018003c007e00ff01ff83ffc7ffe3c3c3c3c3c3c3dbc3dbc3dbc00000000',
  'library': '00000000380029c0295c295429542954295439dc7ffe7ffe0000000000000000',
  'journal': '00007ffc4004dff44004dff44004dfc44004dff440047ffc0000000000000000',
  'workshop': '00007fe07ff87ff87fe007800780078007800780078007800780000000000000',
  'lab': '000007e007e003c003c003c007e00ff01ff83ffc37ec3ffc1ff8000000000000',
  'theme': '000003c00ff03ccc3ccc7ffe73f273f27ffe7ffe7ff63fc01fc007c000000000',
  'settings': '0180018011883ffc1ff81ff81c38fc3ffc3f1c381ff81ff83ffc118801800180',
  'mode': '000007c019f021f821f841fc41fc41fc41fc21f821f819f007c0000000000000',
  'char': '000007e008100810081007e000003ffc400240027ffe00000000000000000000',
  'persona': '000007e00ff00ff00ff007e000003ffc7ffe7ffe7ffe00000000000000000000',
  'lore': '00003e7c41825dba41825dba41825dba41823e7c000000000000000000000000',
  'preset': '000000007ffe0600060000007ffe0006000600007ffe06000600000000000000',
  'prompt': '0000000c001e0036006c00d801b0036006c00d801e801c003000000000000000',
  'regex': '00000f80104020202020202010400f80006000300018000c0000000000000000',
  'image': '00007ffe40024302430240024022407248fa5dfd7ffe00000000000000000000',
  'folder': '000000007c00460047fc400440044004400440047ffc00000000000000000000',
  'plus': '00000000000001800180018007e007e001800180018000000000000000000000',
  'minus': '00000000000000000000000007e007e000000000000000000000000000000000',
  'close': '00000000300c18180c30066003c003c006600c301818300c0000000000000000',
  'check': '0000000000030006000c0018303018600cc00780030000000000000000000000',
  'undo': '000006000e001e003fe01e180e0c060c000c001807e000000000000000000000',
  'redo': '000000600070007807fc1878307030603000180007e000000000000000000000',
  'download': '0000018001800180018019980ff007e003c0018000007ffe7ffe000000000000',
  'upload': '0000018003c007e00ff0199801800180018000007ffe7ffe0000000000000000',
  'link': '000000007e7e42424182418242427e7e00000000000000000000000000000000',
  'note': '00007ffe40025ffa40025fc240025fe24002407f403e401c7ff8000000000000',
  'save': '00007ff84fcc4fce4fcf400440045ff4501450145ff47ffc0000000000000000',
  'menu': '000000007ffe7ffe000000007ffe7ffe000000007ffe7ffe0000000000000000',
  'star': '00000180018003c03ffc1ff80ff00ff01e781c38300c00000000000000000000',
  'trash': '000007e07ffe00003ffc2a542a542a542a542a543ffc00000000000000000000',
  'arrow-left': '000000000100030007000ff81ff80ff807000300010000000000000000000000',
  'sticky': '00007ffe7ffe7ffe7ffe7ffe7ffe7ff87ff07fe07fc000000000000000000000',
  'grid': '00007e7e7e7e7e7e7e7e00007e7e7e7e7e7e7e7e000000000000000000000000',
  'copy': '00003fc0204027fc240424043c040404040407fc000000000000000000000000',
  'chevron-down': '00000000000000006006300c18180c30066003c0000000000000000000000000',
  'chevron-right': '000000000c00060003000180030006000c000000000000000000000000000000',
};

export const PX_NAMES = Object.keys(BITS);
const cache = new Map();
// One <path> per icon: each run of pixels in a row becomes a rectangle
function pathFor(name) {
  const hex = BITS[name]; if (!hex) return '';
  let d = '';
  for (let y = 0; y < 16; y++) {
    const row = parseInt(hex.slice(y * 4, y * 4 + 4), 16);
    let x = 0;
    while (x < 16) {
      if (!(row & (0x8000 >> x))) { x++; continue; }
      let n = 0; while (x + n < 16 && (row & (0x8000 >> (x + n)))) n++;
      d += `M${x} ${y}h${n}v1h-${n}z`; x += n;
    }
  }
  return d;
}
export function px(name, cls = '') {
  if (!BITS[name]) return '';
  const key = name + '|' + cls;
  if (!cache.has(key)) cache.set(key, `<svg class="px${cls ? ' ' + cls : ''}" viewBox="0 0 16 16" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="currentColor" d="${pathFor(name)}"/></svg>`);
  return cache.get(key);
}

// The kinds of thing LoreOS keeps, and the icon for each
export const KIND_ICON = { lore: 'lore', char: 'char', preset: 'preset', prompt: 'prompt', regex: 'regex', persona: 'persona', image: 'image', notebook: 'journal' };
export const kindIcon = kind => px(KIND_ICON[kind] || 'note');

// The text symbols the static markup used before, and the icon each one means
const SYMBOL_ICON = {
  '⌂': 'home', '▤': 'library', '❡': 'journal', '⚒': 'workshop', '⚗': 'lab', '✎': 'theme', '⚙': 'settings', '◑': 'mode',
  '☰': 'menu', '+': 'plus', '↓': 'download', '↑': 'upload', '⌕': 'regex', '◫': 'copy', '⌖': 'link', '⇄': 'preset',
  '✓': 'check', '↶': 'undo', '◀': 'arrow-left', '❖': 'lore', '☺': 'char', '▣': 'image',
};
const clean = t => String(t || '').replace(/[\uFE0E\uFE0F\s]/g, '');
export function hydratePixelIcons(root = document) {
  root.querySelectorAll('[data-px]').forEach(el => { if (!el.dataset.pxDone) { el.innerHTML = px(el.dataset.px); el.dataset.pxDone = '1'; } });
  root.querySelectorAll('.nav-item-icon, .mob-nav-btn .icon, .mode-tab .mt-ico').forEach(el => {
    if (el.dataset.pxDone || el.children.length) return;
    const name = SYMBOL_ICON[clean(el.textContent)]; if (!name) return;
    el.innerHTML = px(name); el.dataset.pxDone = '1';
  });
}
