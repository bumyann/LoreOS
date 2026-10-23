// ═══════════════════════════════════════════════════════
// STAMPS — reusable marks for pictures (a signature, a logo, "© me", a diagonal watermark).
// Kept on this device only (aet_stamps), not in backups or Drive sync.
//   { id, name, kind: 'text'|'image', text: {text, font, color, bold, italic, outline, outlineColor}, image: dataUrl,
//     size (% of the picture's width), opacity (0-1), position ('tl'..'br'), margin (% of the shorter side), tile,
//     fx, fy (where its centre sits, 0-1 across the picture; null uses the position grid) }
// ═══════════════════════════════════════════════════════
import { store } from './kv.js';
import { safeSet } from './storage.js';
import { STAMP_POSITIONS } from './image_ops.js';

export const STAMPS_KEY = 'aet_stamps';
export const MAX_STAMPS = 24;
const MAX_IMG = 300000;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export const stampId = () => 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

export function normalizeStamp(s) {
  const o = isObj(s) ? s : {};
  const kind = o.kind === 'image' ? 'image' : 'text';
  const t = isObj(o.text) ? o.text : {};
  return {
    id: typeof o.id === 'string' && o.id ? o.id : stampId(), name: String(o.name || (kind === 'text' ? String(t.text || 'Stamp') : 'Stamp')).slice(0, 40), kind,
    text: { text: String(t.text || '').slice(0, 200), font: ['sans', 'serif', 'mono', 'script'].includes(t.font) ? t.font : 'serif', color: /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color.toLowerCase() : '#ffffff', bold: !!t.bold, italic: !!t.italic, outline: t.outline !== false, outlineColor: /^#[0-9a-fA-F]{6}$/.test(t.outlineColor) ? t.outlineColor.toLowerCase() : '#000000', size: 64 },
    image: kind === 'image' && typeof o.image === 'string' && o.image.startsWith('data:image/') && o.image.length <= MAX_IMG ? o.image : '',
    size: num(o.size, 3, 100, 22), opacity: num(o.opacity, 0.05, 1, 0.7), position: STAMP_POSITIONS.includes(o.position) ? o.position : 'br', margin: num(o.margin, 0, 30, 3), tile: !!o.tile,
    fx: o.fx === null || o.fx === undefined ? null : num(o.fx, 0, 1, 0.5), fy: o.fy === null || o.fy === undefined ? null : num(o.fy, 0, 1, 0.5),
  };
}
export function stampsGet() {
  try { const raw = store.get(STAMPS_KEY); const a = raw ? JSON.parse(raw) : []; return (Array.isArray(a) ? a : []).filter(isObj).map(normalizeStamp).filter(s => s.kind === 'text' ? s.text.text.trim() : s.image).slice(0, MAX_STAMPS); } catch (e) { return []; }
}
export function stampsSet(list) { return safeSet(STAMPS_KEY, JSON.stringify(list.map(normalizeStamp).slice(0, MAX_STAMPS))); }
export function stampAdd(s) { const l = stampsGet(); const n = normalizeStamp(s); l.push(n); return stampsSet(l) ? n : null; }
export function stampUpdate(id, patch) { const l = stampsGet(), i = l.findIndex(s => s.id === id); if (i < 0) return null; l[i] = normalizeStamp({ ...l[i], ...patch, id }); return stampsSet(l) ? l[i] : null; }
export function stampRemove(id) { return stampsSet(stampsGet().filter(s => s.id !== id)); }
