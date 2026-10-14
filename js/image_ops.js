// ═══════════════════════════════════════════════════════
// IMAGE OPERATIONS — what the Workshop image editor does to pixels.
//
// The adjustments (brightness, contrast, ...) work on raw pixels rather than on the canvas `filter`
// property, because Safari on iPhones and iPads does not support that property. The functions that take
// `ImageData`-shaped objects ({ data, width, height }) need no browser, so they can be tested directly.
// ═══════════════════════════════════════════════════════

export const ADJUST_DEFAULT = Object.freeze({ brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, sepia: 0, gray: 0, invert: 0, vignette: 0 });
export const ADJUST_RANGES = {
  brightness: [0, 200, 1, '%'], contrast: [0, 200, 1, '%'], saturate: [0, 300, 1, '%'], hue: [-180, 180, 1, '°'],
  blur: [0, 20, 0.5, 'px'], sepia: [0, 100, 1, '%'], gray: [0, 100, 1, '%'], invert: [0, 100, 1, '%'], vignette: [0, 100, 1, '%'],
};
export const PRESETS = [
  { id: 'none', label: 'Original', adjust: {} },
  { id: 'vivid', label: 'Vivid', adjust: { contrast: 115, saturate: 140 } },
  { id: 'noir', label: 'Noir', adjust: { gray: 100, contrast: 130, brightness: 90, vignette: 45 } },
  { id: 'sepia', label: 'Sepia', adjust: { sepia: 85, contrast: 105 } },
  { id: 'fade', label: 'Fade', adjust: { contrast: 85, brightness: 108, saturate: 80 } },
  { id: 'cool', label: 'Cool', adjust: { hue: -18, saturate: 110, brightness: 98 } },
  { id: 'warm', label: 'Warm', adjust: { hue: 14, saturate: 115, sepia: 18 } },
  { id: 'dream', label: 'Dream', adjust: { blur: 1.5, brightness: 108, saturate: 120, contrast: 92 } },
  { id: 'gothic', label: 'Gothic', adjust: { saturate: 60, contrast: 125, brightness: 85, hue: -10, vignette: 60 } },
];
export function normalizeAdjust(a) {
  const out = { ...ADJUST_DEFAULT };
  Object.keys(ADJUST_DEFAULT).forEach(k => {
    const v = Number(a && a[k]);
    if (Number.isFinite(v)) { const [lo, hi] = ADJUST_RANGES[k]; out[k] = Math.max(lo, Math.min(hi, v)); }
  });
  return out;
}
export const isNeutral = a => { const n = normalizeAdjust(a); return Object.keys(ADJUST_DEFAULT).every(k => n[k] === ADJUST_DEFAULT[k]); };

const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v);

// ── Per-pixel colour work (in place) ──
export function adjustPixels(img, adjust) {
  const a = normalizeAdjust(adjust), d = img.data, n = d.length;
  const br = a.brightness / 100, ct = a.contrast / 100, sat = a.saturate / 100, sep = a.sepia / 100, gry = a.gray / 100, inv = a.invert / 100;
  const hue = a.hue * Math.PI / 180, cos = Math.cos(hue), sin = Math.sin(hue);
  // hue rotation matrix (the same one CSS and SVG use)
  const hm = [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
  const doHue = a.hue !== 0, doSat = a.saturate !== 100, doSep = sep > 0, doGray = gry > 0, doInv = inv > 0;
  for (let i = 0; i < n; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (doHue) { const r2 = hm[0] * r + hm[1] * g + hm[2] * b, g2 = hm[3] * r + hm[4] * g + hm[5] * b, b2 = hm[6] * r + hm[7] * g + hm[8] * b; r = r2; g = g2; b = b2; }
    if (doSat) { const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
    if (doGray) { const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r += (l - r) * gry; g += (l - g) * gry; b += (l - b) * gry; }
    if (doSep) {
      const r2 = 0.393 * r + 0.769 * g + 0.189 * b, g2 = 0.349 * r + 0.686 * g + 0.168 * b, b2 = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (r2 - r) * sep; g += (g2 - g) * sep; b += (b2 - b) * sep;
    }
    if (br !== 1) { r *= br; g *= br; b *= br; }
    if (ct !== 1) { r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; b = (b - 128) * ct + 128; }
    if (doInv) { r += (255 - 2 * r) * inv; g += (255 - 2 * g) * inv; b += (255 - 2 * b) * inv; }
    d[i] = clamp255(r); d[i + 1] = clamp255(g); d[i + 2] = clamp255(b);
  }
  if (a.vignette > 0) vignette(img, a.vignette / 100);
  if (a.blur > 0) boxBlur(img, a.blur);
  return img;
}

// Darken towards the corners
export function vignette(img, amount) {
  const { data: d, width: w, height: h } = img;
  const cx = w / 2, cy = h / 2, maxR = Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxR;
    const f = 1 - amount * Math.max(0, (dist - 0.35) / 0.65) ** 1.6;
    const i = (y * w + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
  }
  return img;
}

// Three passes of a box blur look very close to a gaussian and are fast enough on a phone
export function boxBlur(img, radius) {
  const r = Math.max(1, Math.round(radius)), { data, width: w, height: h } = img;
  const tmp = new Float32Array(w * h * 4), src = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) src[i] = data[i];
  const pass = (from, to, horizontal) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? 4 : w * 4, lineStep = horizontal ? w * 4 : 4;
    for (let l = 0; l < lines; l++) {
      const base = l * lineStep;
      for (let c = 0; c < 4; c++) {
        let sum = 0, cnt = 0;
        for (let k = 0; k <= r && k < len; k++) { sum += from[base + k * step + c]; cnt++; }
        for (let k = 0; k < len; k++) {
          to[base + k * step + c] = sum / cnt;
          const add = k + r + 1, rem = k - r;
          if (add < len) { sum += from[base + add * step + c]; cnt++; }
          if (rem >= 0) { sum -= from[base + rem * step + c]; cnt--; }
        }
      }
    }
  };
  for (let i = 0; i < 3; i++) { pass(src, tmp, true); pass(tmp, src, false); }
  for (let i = 0; i < data.length; i++) data[i] = src[i];
  return img;
}

// ── Geometry on ImageData-shaped objects ──
export function makeImage(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
export function rotateImage(img, dir) {          // dir: 1 = clockwise, -1 = anticlockwise
  const { width: w, height: h, data } = img, out = makeImage(h, w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = dir > 0 ? h - 1 - y : y, ny = dir > 0 ? x : w - 1 - x;
    const s = (y * w + x) * 4, t = (ny * h + nx) * 4;
    out.data[t] = data[s]; out.data[t + 1] = data[s + 1]; out.data[t + 2] = data[s + 2]; out.data[t + 3] = data[s + 3];
  }
  return out;
}
export function flipImage(img, axis) {            // axis: 'h' mirrors left-right, 'v' top-bottom
  const { width: w, height: h, data } = img, out = makeImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = axis === 'h' ? w - 1 - x : x, ny = axis === 'v' ? h - 1 - y : y;
    const s = (y * w + x) * 4, t = (ny * w + nx) * 4;
    out.data[t] = data[s]; out.data[t + 1] = data[s + 1]; out.data[t + 2] = data[s + 2]; out.data[t + 3] = data[s + 3];
  }
  return out;
}
export function cropRect(rect, w, h) {            // keep a crop inside the picture, at least 1px
  let x = Math.round(rect.x), y = Math.round(rect.y), cw = Math.round(rect.w), ch = Math.round(rect.h);
  x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
  cw = Math.max(1, Math.min(w - x, cw)); ch = Math.max(1, Math.min(h - y, ch));
  return { x, y, w: cw, h: ch };
}
export function cropImage(img, rect) {
  const r = cropRect(rect, img.width, img.height), out = makeImage(r.w, r.h);
  for (let y = 0; y < r.h; y++) {
    const s = ((r.y + y) * img.width + r.x) * 4;
    out.data.set(img.data.subarray(s, s + r.w * 4), y * r.w * 4);
  }
  return out;
}
// A crop of a given shape (ratio = width / height) that fits, centred, inside w x h
export function ratioRect(w, h, ratio) {
  if (!ratio) return { x: 0, y: 0, w, h };
  let cw = w, ch = w / ratio;
  if (ch > h) { ch = h; cw = h * ratio; }
  return { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: Math.round(cw), h: Math.round(ch) };
}
// Size that keeps the shape when one side changes
export function scaledSize(w, h, { width, height, keep = true }) {
  if (!keep) return { w: Math.max(1, Math.round(width || w)), h: Math.max(1, Math.round(height || h)) };
  if (width && !height) return { w: Math.max(1, Math.round(width)), h: Math.max(1, Math.round(width * h / w)) };
  if (height && !width) return { w: Math.max(1, Math.round(height * w / h)), h: Math.max(1, Math.round(height)) };
  return { w: Math.max(1, Math.round(width || w)), h: Math.max(1, Math.round(height || h)) };
}

// ── Undo history: keeps the last few states ──
export class History {
  constructor(limit = 10) { this.limit = limit; this.past = []; this.future = []; }
  push(state) { this.past.push(state); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  undo(current) { if (!this.past.length) return null; this.future.push(current); return this.past.pop(); }
  redo(current) { if (!this.future.length) return null; this.past.push(current); return this.future.pop(); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  clear() { this.past = []; this.future = []; }
}

// ── Canvas helpers (these need a browser) ──
export const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
export function cloneCanvas(src) { const c = newCanvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; }
export function canvasToImage(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); }
export function imageToCanvas(img) { const c = newCanvas(img.width, img.height); c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); return c; }
export function rotateCanvas(c, dir) { return imageToCanvas(rotateImage(canvasToImage(c), dir)); }
export function flipCanvas(c, axis) { return imageToCanvas(flipImage(canvasToImage(c), axis)); }
export function cropCanvas(c, rect) { const r = cropRect(rect, c.width, c.height), o = newCanvas(r.w, r.h); o.getContext('2d').drawImage(c, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); return o; }
export function resizeCanvas(c, w, h) { const o = newCanvas(w, h), x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height); return o; }
export function adjustCanvas(c, adjust) {
  if (isNeutral(adjust)) return cloneCanvas(c);
  const o = cloneCanvas(c), x = o.getContext('2d');
  x.putImageData(new ImageData(new Uint8ClampedArray(adjustPixels(canvasToImage(o), adjust).data), o.width, o.height), 0, 0);
  return o;
}
// A smaller copy for fast previews
export function previewCanvas(c, maxEdge = 900) {
  const s = Math.min(1, maxEdge / Math.max(c.width, c.height));
  return s >= 1 ? c : resizeCanvas(c, c.width * s, c.height * s);
}
export const FONTS = [['sans', 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'], ['serif', 'Georgia, "Times New Roman", serif'], ['mono', 'ui-monospace, Menlo, Consolas, monospace'], ['script', '"Brush Script MT", "Segoe Script", cursive']];
export function drawText(c, o) {
  const x = c.getContext('2d'), size = Math.max(4, Number(o.size) || 48);
  const font = (FONTS.find(f => f[0] === o.font) || FONTS[0])[1];
  x.save();
  x.font = `${o.italic ? 'italic ' : ''}${o.bold ? '700 ' : '400 '}${size}px ${font}`;
  x.textBaseline = 'top'; x.textAlign = o.align || 'left';
  x.fillStyle = o.color || '#ffffff'; x.globalAlpha = o.opacity === undefined ? 1 : o.opacity;
  const lines = String(o.text || '').split('\n'), lh = size * 1.2;
  lines.forEach((line, i) => {
    if (o.outline) { x.lineWidth = Math.max(2, size / 8); x.strokeStyle = o.outlineColor || '#000000'; x.lineJoin = 'round'; x.strokeText(line, o.x, o.y + i * lh); }
    x.fillText(line, o.x, o.y + i * lh);
  });
  x.restore();
  return { w: Math.max(...lines.map(l => x.measureText ? 0 : l.length * size * 0.5), 0), h: lines.length * lh };
}
export function strokePath(c, points, o) {
  if (!points.length) return c;
  const x = c.getContext('2d');
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = Math.max(1, Number(o.size) || 8);
  x.strokeStyle = o.color || '#ffffff'; x.fillStyle = o.color || '#ffffff'; x.globalAlpha = o.opacity === undefined ? 1 : o.opacity;
  if (points.length === 1) { x.beginPath(); x.arc(points[0].x, points[0].y, x.lineWidth / 2, 0, Math.PI * 2); x.fill(); }
  else { x.beginPath(); x.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) { const p = points[i], q = points[i - 1]; x.quadraticCurveTo(q.x, q.y, (q.x + p.x) / 2, (q.y + p.y) / 2); } x.lineTo(points[points.length - 1].x, points[points.length - 1].y); x.stroke(); }
  x.restore();
  return c;
}
export const toDataUrl = (c, type = 'image/webp', q = 0.92) => { let out = c.toDataURL(type, q); if (type === 'image/webp' && out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/png'); return out; };
