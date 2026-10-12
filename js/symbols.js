// ═══════════════════════════════════════════════════════
// SYMBOLS — plain text symbols used instead of emoji.
// The text-presentation selector (U+FE0E) after a symbol stops phones from swapping it for a
// coloured emoji picture.
// ═══════════════════════════════════════════════════════
export const TEXT_FORM = '︎';
export const sym = s => (s ? String(s).replace(/︎|️/g, '') + TEXT_FORM : '');

// One symbol per kind of thing, used by the workshop tabs, the Library and Home
export const KIND_SYMBOL = { lore: '❖', char: '☺︎', preset: '⚙︎', prompt: '✎︎', regex: '⌕', persona: '☻︎' };

// What a person can pick to stand for a Library item
export const SYMBOL_CHOICES = [
  '✦', '✧', '❖', '◈', '⬡', '✺', '❂', '❋', '✿', '❀', '☘', '⚘',
  '☾', '☽', '☼', '☄', '❄︎', '☁︎', '☂︎', '⚡︎', '⛰', '⚓︎', '✈︎', '☎︎',
  '♔', '♕', '♖', '♘', '♠︎', '♣︎', '♥︎', '♦︎', '♪', '⚔︎', '⚖︎', '⚑',
  '⚜', '☠︎', '⛧', '⚗', '✂︎', '✎︎', '⌕', '⚙︎', '⌘', '☺︎', '☻︎', '⌂︎',
];
