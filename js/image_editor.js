// ═══════════════════════════════════════════════════════
// IMAGE EDITOR — a Workshop mode for the pictures in the Gallery.
//
// Each open picture is a small session kept in memory while its tab is open: the working canvas, the live
// colour adjustments, the undo history and whether it has unsaved edits. Colour adjustments stay live
// (and can be changed again) until another edit or a save bakes them into the pixels.
// Saving writes back to the Gallery (over the original or as a copy); nothing is autosaved, because
// an edit that overwrites a picture is not something to do behind your back.
// ═══════════════════════════════════════════════════════
import { addPicture, getEntry, getFull, hooks, listPictures, replacePicture } from './gallery.js';
import { state } from './state.js';
import { askConfirm, askInput, closeAllDropdowns, esc, g, toast } from './util.js';
import { closeMobSidebar } from './mobile.js';
import { showLibraryTab } from './library_view.js';
import { navigateTo } from './router.js';
import { wsMarkSaved, wsMarkUnsaved, wsShowItem, renderWsTabs } from './workshop.js';
import * as ops from './image_ops.js';
import { readFileAsDataUrl, resizeImage } from './avatar.js';
import { stampAdd, stampRemove, stampUpdate, stampsGet } from './stamps.js';
import { CAN_EDIT, KEYED, editImage, keyNameFor, loadGenSettings } from './imagegen.js';
import { getSecret } from './secrets.js';

const sessions = new Map();          // picture id -> session
let tool = 'adjust';                 // adjust | crop | transform | resize | draw | text | layer | stamp | cutout | ai
let pending = null;                  // something placed on the picture but not applied yet: { kind: 'image' | 'stamp', src, ... }
let picking = false;                 // the cutout tool is waiting for a click to choose the colour to remove
let cutColor = null, cutTol = 24, cutSoft = 1;
let stampSel = '';
const stampSrc = new Map();          // stamp id -> its picture, as a canvas
let aiPrompt = '', aiStrength = 0.6, aiBusy = null;
const brush = { size: 12, color: '#ffffff', opacity: 1, erase: false };
const textOpts = { text: 'Your text', size: 64, color: '#ffffff', font: 'serif', bold: true, italic: false, outline: true, outlineColor: '#000000', x: 40, y: 40 };
let crop = null;                     // { x, y, w, h } in picture pixels, only while the crop tool is open
let cropRatio = 0;
let stroke = null, strokeBase = null;                   // points of the stroke being drawn
let showOriginal = false;

export const isImageDirty = id => !!(sessions.get(id) && sessions.get(id).dirty);
export const dropImageSession = id => { sessions.delete(id); };
const cur = () => sessions.get(state.activeImageId);

const loadImage = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('That picture could not be read.')); im.src = url; });

export async function openImageDoc(id) {
  state.activeImageId = id;
  const entry = getEntry(id);
  if (!entry) { renderImageEditor(); return; }
  pending = null; picking = false;
  if (!sessions.has(id)) {
    try {
      const im = await loadImage(getFull(id));
      const canvas = ops.newCanvas(im.naturalWidth || entry.w || 1, im.naturalHeight || entry.h || 1);
      canvas.getContext('2d').drawImage(im, 0, 0);
      sessions.set(id, { id, canvas, adjust: { ...ops.ADJUST_DEFAULT }, preset: 'none', history: new ops.History(8), dirty: false, name: entry.name });
    } catch (e) { toast(e.message, 'err'); }
  }
  if (state.activeImageId === id) { renderImageSidebar(); renderImageEditor(); }
}

// ── The sidebar: every picture in the Gallery ──
export function renderImageSidebar() {
  const list = g('entryList'), count = g('entryCount'); if (!list) return;
  const q = (g('sbSearch') && g('sbSearch').value || '').trim().toLowerCase();
  const pics = listPictures().filter(p => !q || (p.name || '').toLowerCase().includes(q)).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  count.textContent = `${pics.length} ${pics.length === 1 ? 'picture' : 'pictures'}`;
  list.innerHTML = '';
  if (!pics.length) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:1.2rem .75rem;text-align:center;font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:1px';
    li.textContent = 'no pictures yet. add some in the Library > Gallery';
    list.append(li); return;
  }
  pics.forEach(p => {
    const li = document.createElement('li');
    li.className = 'ei img-ei' + (p.id === state.activeImageId ? ' open' : '');
    li.dataset.imgId = p.id;
    li.innerHTML = `<div class="ei-head"><img class="img-ei-thumb" src="${esc(p.thumb)}" alt=""><div class="ei-name">${esc(p.name)}${isImageDirty(p.id) ? ' •' : ''}</div></div><div class="ei-kws"><span class="kw-tag">${p.w}×${p.h}</span></div>`;
    li.addEventListener('click', () => { wsShowItem('image', p.id); closeMobSidebar(); });
    list.append(li);
  });
}

// ── Pixels ──
function snapshot(s) { return { canvas: ops.cloneCanvas(s.canvas), adjust: { ...s.adjust }, preset: s.preset }; }
function pushHistory(s) { s.history.push(snapshot(s)); }
function markDirty(s) { if (!s.dirty) { s.dirty = true; wsMarkUnsaved('image', s.id); } updateBar(); }
function bake(s) {
  if (ops.isNeutral(s.adjust)) return;
  s.canvas = ops.adjustCanvas(s.canvas, s.adjust);
  s.adjust = { ...ops.ADJUST_DEFAULT }; s.preset = 'none';
}
// Run a pixel edit as one undoable step
function edit(s, fn) {
  pushHistory(s); bake(s);
  const out = fn(s.canvas);
  if (out) s.canvas = out;
  markDirty(s); crop = null;
  renderImageEditor();
}
function undo(s) { const p = s.history.undo(snapshot(s)); if (!p) return; s.canvas = p.canvas; s.adjust = p.adjust; s.preset = p.preset; markDirty(s); crop = null; renderImageEditor(); }
function redo(s) { const p = s.history.redo(snapshot(s)); if (!p) return; s.canvas = p.canvas; s.adjust = p.adjust; s.preset = p.preset; markDirty(s); crop = null; renderImageEditor(); }

// What is on screen: the canvas with the live adjustments
function paintStage() {
  const s = cur(), view = g('imgView'); if (!s || !view) return;
  const src = showOriginal && s.history.past.length ? s.history.past[0].canvas : s.canvas;
  const shown = showOriginal ? src : (ops.isNeutral(s.adjust) ? src : ops.adjustCanvas(ops.previewCanvas(src, 1000), s.adjust));
  view.width = shown.width; view.height = shown.height;
  view.getContext('2d').drawImage(shown, 0, 0);
  if (tool === 'text' && !showOriginal) {
    const scale = shown.width / s.canvas.width;
    const c = view.getContext('2d'); c.save(); c.scale(scale, scale);
    ops.drawText(view, textOpts); c.restore();
  }
  if (pending && !showOriginal) {
    const sc = shown.width / s.canvas.width;
    if (pending.kind === 'image') ops.drawOverlay(view, pending.src, { x: pending.x * sc, y: pending.y * sc, w: pending.w * sc, rot: pending.rot, opacity: pending.opacity, flip: pending.flip });
    else if (pending.kind === 'stamp') ops.drawStamp(view, pending.src, pending.params);
  }
  paintCrop();
}
function paintCrop() {
  const box = g('imgCrop'), s = cur(); if (!box) return;
  if (tool !== 'crop' || !crop || !s) { box.style.display = 'none'; return; }
  box.style.display = '';
  box.style.left = (crop.x / s.canvas.width * 100) + '%'; box.style.top = (crop.y / s.canvas.height * 100) + '%';
  box.style.width = (crop.w / s.canvas.width * 100) + '%'; box.style.height = (crop.h / s.canvas.height * 100) + '%';
  const info = g('imgCropInfo'); if (info) info.textContent = `${Math.round(crop.w)} × ${Math.round(crop.h)}`;
}
function updateBar() {
  const s = cur(); if (!s) return;
  const u = g('imgUndo'), r = g('imgRedo'), sv = g('imgSave');
  if (u) u.disabled = !s.history.canUndo; if (r) r.disabled = !s.history.canRedo;
  if (sv) sv.textContent = s.dirty ? 'Save •' : 'Save';
  const dim = g('imgDims'); if (dim) dim.textContent = `${s.canvas.width} × ${s.canvas.height}`;
  const nm = g('imgName'); if (nm && document.activeElement !== nm) nm.value = s.name;
  renderImageSidebarSoft();
}
function renderImageSidebarSoft() { if (state.mode === 'image') renderImageSidebar(); }

// ── Saving ──
export async function saveImage({ copy = false } = {}) {
  const s = cur(); if (!s) return false;
  bake(s);
  const url = ops.toDataUrl(s.canvas, 'image/webp', 0.95);
  const name = (g('imgName') && g('imgName').value.trim()) || s.name;
  if (copy) {
    const id = await addPicture({ dataUrl: url, name: name + ' (edit)', source: 'edited' });
    if (!id) { toast('Could not keep that copy (is the storage full?).', 'err'); return false; }
    toast('Saved as a new picture in the Gallery.', 'ok');
    wsShowItem('image', id);
    return true;
  }
  const ok = await replacePicture(s.id, url, { name, source: 'edited' });
  if (!ok) { toast('Could not save (is the storage full?).', 'err'); return false; }
  s.name = name; s.dirty = false; s.history.clear();
  wsMarkSaved('image', s.id); renderWsTabs();
  toast('Saved to the Gallery.', 'ok');
  renderImageEditor();
  return true;
}
export function downloadImage(type = 'image/png') {
  const s = cur(); if (!s) return;
  const url = ops.toDataUrl(ops.adjustCanvas(s.canvas, s.adjust), type, 0.95);
  const a = document.createElement('a'); a.href = url; a.download = (s.name || 'picture').replace(/[^\w\- ]+/g, '').trim() + (url.startsWith('data:image/png') ? '.png' : type === 'image/jpeg' ? '.jpg' : '.webp');
  a.style.display = 'none'; document.body.append(a); a.click(); a.remove();
}
export async function confirmDiscard(id) {
  if (!isImageDirty(id)) return true;
  return askConfirm('This picture has edits that are not saved. Close it and lose them?');
}

// ── The editor panel ──
const TOOLS = [['adjust', 'Adjust'], ['crop', 'Crop'], ['transform', 'Rotate'], ['resize', 'Resize'], ['draw', 'Draw'], ['text', 'Text'], ['layer', 'Image'], ['stamp', 'Stamp'], ['cutout', 'Cut out'], ['ai', 'AI edit']];
const slider = (key, label) => {
  const [lo, hi, step, unit] = ops.ADJUST_RANGES[key];
  return `<label class="img-sl"><span>${label}</span><input type="range" data-adj="${key}" min="${lo}" max="${hi}" step="${step}"><output data-out="${key}"></output></label>`.replace('</output>', `</output>`) + (unit ? '' : '');
};

export function renderImageEditor() {
  const host = g('editorContent'); if (!host) return;
  const s = cur();
  if (!s) {
    host.innerHTML = `<div class="empty-state" style="flex-direction:column;gap:.6rem"><div style="font-family:var(--fp);font-size:1.4rem;color:var(--p);opacity:.6">▣ image editor</div><div style="font-family:var(--fx);font-size:.78rem;color:var(--txm);max-width:320px;text-align:center">pick a picture from the list, or open one from the Library > Gallery with <b>Edit</b>.${hooks.generate ? '<br><br><button class="btn btn-s btn-sm" id="imgEmptyGen">Generate a picture</button>' : ''}</div></div>`;
    const gb = g('imgEmptyGen'); if (gb) gb.onclick = () => hooks.generate && hooks.generate();
    return;
  }
  host.innerHTML = `<div class="img-ed">
    <div class="img-bar">
      <input class="finput img-name" id="imgName" value="${esc(s.name)}" maxlength="80" aria-label="Picture name">
      <span class="rx-none" id="imgDims"></span>
      <button class="btn btn-s btn-sm" id="imgUndo" title="Undo">↶</button>
      <button class="btn btn-s btn-sm" id="imgRedo" title="Redo">↷</button>
      <button class="btn btn-s btn-sm" id="imgCompare" title="Hold to see the original">Original</button>
      <button class="btn btn-p btn-sm" id="imgSave">Save</button>
      <div class="dd" id="dd-imgsave"><button class="btn btn-s btn-sm dd-btn">More ▾</button><div class="dd-menu">
        <button class="dd-item" id="imgSaveCopy">Save as a copy</button>
        <button class="dd-item" id="imgDlPng">Download PNG</button>
        <button class="dd-item" id="imgDlWebp">Download WebP</button>
        <button class="dd-item" id="imgDlJpg">Download JPG</button>
        <button class="dd-item" id="imgRevert">Revert to saved</button>
      </div></div>
    </div>
    <div class="img-main">
      <div class="img-stage" id="imgStage"><div class="img-wrap" id="imgWrap"><canvas id="imgView"></canvas><div class="img-crop" id="imgCrop" style="display:none"><span class="img-crop-info" id="imgCropInfo"></span><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
      <div class="img-side">
        <div class="img-tools">${TOOLS.map(([k, l]) => `<button class="img-tool${tool === k ? ' active' : ''}" data-tool="${k}">${l}</button>`).join('')}</div>
        <div class="img-panel" id="imgPanel"></div>
      </div>
    </div>
  </div>`;
  wireEditor(s);
  renderPanel(s);
  paintStage(); updateBar();
}

function renderPanel(s) {
  const p = g('imgPanel'); if (!p) return;
  if (tool === 'adjust') {
    p.innerHTML = `<div class="img-presets">${ops.PRESETS.map(f => `<button class="img-preset${s.preset === f.id ? ' active' : ''}" data-preset="${f.id}">${f.label}</button>`).join('')}</div>
      ${[['brightness', 'Brightness'], ['contrast', 'Contrast'], ['saturate', 'Saturation'], ['hue', 'Hue'], ['sepia', 'Sepia'], ['gray', 'Grayscale'], ['invert', 'Invert'], ['vignette', 'Vignette'], ['blur', 'Blur']].map(([k, l]) => slider(k, l)).join('')}
      <button class="btn btn-s btn-sm" id="imgAdjReset">Reset adjustments</button>`;
    p.querySelectorAll('[data-adj]').forEach(inp => {
      const k = inp.dataset.adj, out = p.querySelector(`[data-out="${k}"]`), unit = ops.ADJUST_RANGES[k][3];
      const sync = () => { inp.value = s.adjust[k]; out.textContent = s.adjust[k] + unit; };
      sync();
      let pushed = false;
      inp.addEventListener('input', () => {
        if (!pushed) { pushHistory(s); pushed = true; }
        s.adjust[k] = Number(inp.value); s.preset = 'custom'; out.textContent = inp.value + unit;
        p.querySelectorAll('.img-preset').forEach(b => b.classList.remove('active'));
        markDirty(s); paintStage();
      });
      inp.addEventListener('change', () => { pushed = false; });
    });
    p.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      const f = ops.PRESETS.find(x => x.id === b.dataset.preset); if (!f) return;
      pushHistory(s); s.adjust = ops.normalizeAdjust(f.adjust); s.preset = f.id; markDirty(s); renderPanel(s); paintStage();
    });
    g('imgAdjReset').onclick = () => { if (ops.isNeutral(s.adjust)) return; pushHistory(s); s.adjust = { ...ops.ADJUST_DEFAULT }; s.preset = 'none'; markDirty(s); renderPanel(s); paintStage(); };
  } else if (tool === 'crop') {
    if (!crop) crop = ops.ratioRect(s.canvas.width, s.canvas.height, cropRatio);
    p.innerHTML = `<div class="img-presets">${[['Free', 0], ['1:1', 1], ['3:4', 3 / 4], ['4:3', 4 / 3], ['2:3', 2 / 3], ['16:9', 16 / 9], ['9:16', 9 / 16]].map(([l, r]) => `<button class="img-preset${cropRatio === r ? ' active' : ''}" data-ratio="${r}">${l}</button>`).join('')}</div>
      <div class="rx-none">Drag the box or its corners on the picture.</div>
      <div class="pr-row"><button class="btn btn-p btn-sm" id="imgCropApply">Apply crop</button><button class="btn btn-s btn-sm" id="imgCropAll">Reset box</button></div>`;
    p.querySelectorAll('[data-ratio]').forEach(b => b.onclick = () => { cropRatio = Number(b.dataset.ratio); crop = ops.ratioRect(s.canvas.width, s.canvas.height, cropRatio); renderPanel(s); paintCrop(); });
    g('imgCropApply').onclick = () => { const r = crop; edit(s, c => ops.cropCanvas(c, r)); };
    g('imgCropAll').onclick = () => { crop = ops.ratioRect(s.canvas.width, s.canvas.height, cropRatio); paintCrop(); };
  } else if (tool === 'transform') {
    p.innerHTML = `<div class="pr-row"><button class="btn btn-s btn-sm" id="imgRotL">⟲ Rotate left</button><button class="btn btn-s btn-sm" id="imgRotR">⟳ Rotate right</button></div>
      <div class="pr-row"><button class="btn btn-s btn-sm" id="imgFlipH">⇋ Flip left-right</button><button class="btn btn-s btn-sm" id="imgFlipV">⇅ Flip top-bottom</button></div>`;
    g('imgRotL').onclick = () => edit(s, c => ops.rotateCanvas(c, -1));
    g('imgRotR').onclick = () => edit(s, c => ops.rotateCanvas(c, 1));
    g('imgFlipH').onclick = () => edit(s, c => ops.flipCanvas(c, 'h'));
    g('imgFlipV').onclick = () => edit(s, c => ops.flipCanvas(c, 'v'));
  } else if (tool === 'resize') {
    p.innerHTML = `<label class="pr-lbl">Width (px)</label><input class="finput" id="imgW" type="number" min="1" max="4000" value="${s.canvas.width}">
      <label class="pr-lbl">Height (px)</label><input class="finput" id="imgH" type="number" min="1" max="4000" value="${s.canvas.height}">
      <label class="rx-none"><input type="checkbox" id="imgKeep" checked> Keep the shape</label>
      <button class="btn btn-p btn-sm" id="imgResizeApply">Apply size</button>`;
    const w = g('imgW'), h = g('imgH'), keep = g('imgKeep'), ratio = s.canvas.width / s.canvas.height;
    w.oninput = () => { if (keep.checked) h.value = Math.max(1, Math.round(w.value / ratio)); };
    h.oninput = () => { if (keep.checked) w.value = Math.max(1, Math.round(h.value * ratio)); };
    g('imgResizeApply').onclick = () => {
      const nw = Math.min(4000, Math.max(1, Math.round(Number(w.value)))), nh = Math.min(4000, Math.max(1, Math.round(Number(h.value))));
      if (nw === s.canvas.width && nh === s.canvas.height) return;
      edit(s, c => ops.resizeCanvas(c, nw, nh));
    };
  } else if (tool === 'draw') {
    p.innerHTML = `<label class="pr-lbl">Brush size <output id="imgBrushOut">${brush.size}</output></label><input type="range" id="imgBrushSize" min="1" max="120" value="${brush.size}">
      <label class="pr-lbl">Opacity</label><input type="range" id="imgBrushOp" min="5" max="100" value="${Math.round(brush.opacity * 100)}">
      <div class="pr-row"><label class="pr-lbl" style="margin:0">Colour</label><input type="color" id="imgBrushColor" value="${brush.color}"><label class="rx-none"><input type="checkbox" id="imgBrushErase"${brush.erase ? ' checked' : ''}> eraser</label></div>
      <div class="rx-none">Draw straight on the picture. The eraser makes parts see-through (undo brings them back).</div>`;
    g('imgBrushErase').onchange = e => { brush.erase = e.target.checked; };
    g('imgBrushSize').oninput = e => { brush.size = Number(e.target.value); g('imgBrushOut').textContent = brush.size; };
    g('imgBrushOp').oninput = e => { brush.opacity = Number(e.target.value) / 100; };
    g('imgBrushColor').oninput = e => { brush.color = e.target.value; };
  } else if (tool === 'text') {
    p.innerHTML = `<label class="pr-lbl">Text</label><textarea class="ftextarea" id="imgTxt" style="min-height:70px">${esc(textOpts.text)}</textarea>
      <div class="pr-row"><select class="finput" id="imgTxtFont">${ops.FONTS.map(f => `<option value="${f[0]}"${textOpts.font === f[0] ? ' selected' : ''}>${f[0]}</option>`).join('')}</select>
        <input type="color" id="imgTxtColor" value="${textOpts.color}"><label class="rx-none"><input type="checkbox" id="imgTxtBold"${textOpts.bold ? ' checked' : ''}> bold</label><label class="rx-none"><input type="checkbox" id="imgTxtOutline"${textOpts.outline ? ' checked' : ''}> outline</label></div>
      <label class="pr-lbl">Size <output id="imgTxtSizeOut">${textOpts.size}</output></label><input type="range" id="imgTxtSize" min="8" max="400" value="${textOpts.size}">
      <div class="rx-none">Tap or drag on the picture to move the text, then apply.</div>
      <button class="btn btn-p btn-sm" id="imgTxtApply">Apply text</button>`;
    const upd = () => { paintStage(); };
    g('imgTxt').oninput = e => { textOpts.text = e.target.value; upd(); };
    g('imgTxtFont').onchange = e => { textOpts.font = e.target.value; upd(); };
    g('imgTxtColor').oninput = e => { textOpts.color = e.target.value; upd(); };
    g('imgTxtBold').onchange = e => { textOpts.bold = e.target.checked; upd(); };
    g('imgTxtOutline').onchange = e => { textOpts.outline = e.target.checked; upd(); };
    g('imgTxtSize').oninput = e => { textOpts.size = Number(e.target.value); g('imgTxtSizeOut').textContent = textOpts.size; upd(); };
    g('imgTxtApply').onclick = () => { if (!textOpts.text.trim()) return; const o = { ...textOpts }; edit(s, c => { ops.drawText(c, o); return null; }); };
  } else if (tool === 'layer') panelLayer(s, p);
  else if (tool === 'stamp') panelStamp(s, p);
  else if (tool === 'cutout') panelCutout(s, p);
  else if (tool === 'ai') panelAi(s, p);
}

const canvasFromUrl = async url => { const im = await loadImage(url); const c = ops.newCanvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); return c; };
const pickFile = () => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files && i.files[0] || null); i.click(); });

// ── Put another picture on top ──
function panelLayer(s, p) {
  p.innerHTML = `<div class="pr-row"><button class="btn btn-s btn-sm" id="imgLayerFile" type="button">From my device</button><button class="btn btn-s btn-sm" id="imgLayerGal" type="button">From the Gallery</button></div>
    <div id="imgLayerThumbs" class="img-thumbs" style="display:none"></div>
    <div id="imgLayerCtl" style="display:${pending && pending.kind === 'image' ? 'flex' : 'none'};flex-direction:column;gap:.4rem">
      <label class="img-sl"><span>Size</span><input type="range" id="imgLaySize" min="3" max="200" value="${pending && pending.kind === 'image' ? Math.round(pending.w / s.canvas.width * 100) : 30}"><output id="imgLaySizeO"></output></label>
      <label class="img-sl"><span>Turn</span><input type="range" id="imgLayRot" min="-180" max="180" value="${pending ? pending.rot : 0}"><output id="imgLayRotO"></output></label>
      <label class="img-sl"><span>Opacity</span><input type="range" id="imgLayOp" min="5" max="100" value="${pending ? Math.round(pending.opacity * 100) : 100}"><output id="imgLayOpO"></output></label>
      <label class="rx-none"><input type="checkbox" id="imgLayFlip"${pending && pending.flip ? ' checked' : ''}> mirror</label>
      <div class="pr-row"><button class="btn btn-p btn-sm" id="imgLayApply" type="button">Place it</button><button class="btn btn-s btn-sm" id="imgLayCancel" type="button">Cancel</button></div>
    </div>
    <div class="rx-none">Choose a picture, then drag it into place on the picture.</div>`;
  const ctl = g('imgLayerCtl');
  const sync = () => { if (!pending || pending.kind !== 'image') return; g('imgLaySizeO').textContent = Math.round(pending.w / s.canvas.width * 100) + '%'; g('imgLayRotO').textContent = pending.rot + '°'; g('imgLayOpO').textContent = Math.round(pending.opacity * 100) + '%'; };
  const take = canvas => { pending = { kind: 'image', src: canvas, x: s.canvas.width / 2, y: s.canvas.height / 2, w: s.canvas.width * 0.3, rot: 0, opacity: 1, flip: false }; ctl.style.display = 'flex'; g('imgLaySize').value = 30; g('imgLayRot').value = 0; g('imgLayOp').value = 100; g('imgLayFlip').checked = false; sync(); paintStage(); };
  sync();
  g('imgLayerFile').onclick = async () => { const f = await pickFile(); if (!f) return; try { take(await canvasFromUrl(await readFileAsDataUrl(f))); } catch (e) { toast('That is not a picture I can read.', 'err'); } };
  g('imgLayerGal').onclick = () => {
    const box = g('imgLayerThumbs'); box.style.display = box.style.display === 'none' ? '' : 'none';
    box.innerHTML = listPictures().filter(x => x.id !== s.id).slice(0, 60).map(x => `<button type="button" class="img-thumb" data-pic="${esc(x.id)}" title="${esc(x.name)}"><img src="${esc(x.thumb)}" alt="${esc(x.name)}"></button>`).join('') || '<div class="rx-none">No other pictures in the Gallery yet.</div>';
    box.querySelectorAll('[data-pic]').forEach(b => b.onclick = async () => { try { take(await canvasFromUrl(getFull(b.dataset.pic))); box.style.display = 'none'; } catch (e) { toast('Could not open that picture.', 'err'); } });
  };
  const upd = () => { if (!pending || pending.kind !== 'image') return; pending.w = s.canvas.width * Number(g('imgLaySize').value) / 100; pending.rot = Number(g('imgLayRot').value); pending.opacity = Number(g('imgLayOp').value) / 100; pending.flip = g('imgLayFlip').checked; sync(); paintStage(); };
  ['imgLaySize', 'imgLayRot', 'imgLayOp'].forEach(id => g(id).addEventListener('input', upd)); g('imgLayFlip').onchange = upd;
  g('imgLayCancel').onclick = () => { pending = null; ctl.style.display = 'none'; paintStage(); };
  g('imgLayApply').onclick = () => { if (!pending || pending.kind !== 'image') return; const o = { ...pending }; pending = null; edit(s, c => { ops.drawOverlay(c, o.src, o); return null; }); };
}

// ── Stamps: reusable marks and watermarks ──
async function stampCanvas(st) {
  const key = st.id + ':' + (st.kind === 'text' ? JSON.stringify(st.text) : st.image.length);
  if (stampSrc.has(key)) return stampSrc.get(key);
  const c = st.kind === 'text' ? ops.textCanvas(st.text) : await canvasFromUrl(st.image);
  stampSrc.set(key, c); return c;
}
async function showStamp(s, st) {
  if (!st) { pending = null; paintStage(); return; }
  pending = { kind: 'stamp', src: await stampCanvas(st), params: st }; paintStage();
}
function panelStamp(s, p) {
  const list = stampsGet(); if (!list.some(x => x.id === stampSel)) stampSel = '';
  const st = list.find(x => x.id === stampSel);
  p.innerHTML = `<div class="img-stamps">${list.map(x => `<button type="button" class="img-stamp${x.id === stampSel ? ' active' : ''}" data-stamp="${esc(x.id)}" title="${esc(x.name)}">${x.kind === 'image' ? `<img src="${esc(x.image)}" alt="">` : ''}<span>${esc(x.name)}</span></button>`).join('') || '<div class="rx-none">No stamps yet. Make one below.</div>'}</div>
    <div class="pr-row"><button class="btn btn-s btn-sm" id="stNewText" type="button">+ Text</button><button class="btn btn-s btn-sm" id="stNewImg" type="button">+ Picture</button><button class="btn btn-s btn-sm" id="stFromThis" type="button" title="Use the picture you are editing as a stamp">+ This picture</button></div>
    ${st ? `<div class="img-stamp-ctl">
      <label class="img-sl"><span>Size</span><input type="range" id="stSize" min="3" max="100" value="${st.size}"><output id="stSizeO">${st.size}%</output></label>
      <label class="img-sl"><span>Opacity</span><input type="range" id="stOp" min="5" max="100" value="${Math.round(st.opacity * 100)}"><output id="stOpO">${Math.round(st.opacity * 100)}%</output></label>
      <label class="img-sl"><span>Margin</span><input type="range" id="stMargin" min="0" max="30" value="${st.margin}"><output id="stMarginO">${st.margin}%</output></label>
      <div class="img-pos" id="stPos">${ops.STAMP_POSITIONS.map(k => `<button type="button" class="${st.position === k && !st.tile ? 'on' : ''}" data-pos="${k}" aria-label="Position ${k}"></button>`).join('')}</div>
      <label class="rx-none"><input type="checkbox" id="stTile"${st.tile ? ' checked' : ''}> repeat across the picture (watermark)</label>
      <div class="pr-row"><button class="btn btn-p btn-sm" id="stApply" type="button">Stamp this picture</button><button class="btn btn-s btn-sm" id="stAll" type="button">Stamp the whole Gallery</button></div>
      <div class="pr-row">${st.kind === 'text' ? '<button class="btn btn-s btn-sm" id="stEdit" type="button">Edit text</button>' : ''}<button class="btn btn-err btn-sm" id="stDel" type="button">Delete stamp</button></div>
    </div>` : '<div class="rx-none">Pick a stamp to place it. Stamps stay on this device.</div>'}`;
  p.querySelectorAll('[data-stamp]').forEach(b => b.onclick = async () => { stampSel = b.dataset.stamp; panelStamp(s, p); await showStamp(s, stampsGet().find(x => x.id === stampSel)); });
  g('stNewText').onclick = async () => { const text = await askInput('What should the stamp say? (like © yourname)', ''); if (!text || !text.trim()) return; const n = stampAdd({ kind: 'text', name: text.trim().slice(0, 24), text: { text: text.trim() }, position: 'br' }); if (n) { stampSel = n.id; panelStamp(s, p); showStamp(s, n); } else toast('Could not save the stamp.', 'err'); };
  const fromCanvas = async (cv, name) => { const small = await resizeImage(ops.toDataUrl(cv, 'image/png'), 512, 512, 0.9); const keepPng = small && small.length <= 300000 ? small : await resizeImage(ops.toDataUrl(cv, 'image/png'), 256, 256, 0.85); const n = keepPng ? stampAdd({ kind: 'image', name, image: keepPng, position: 'br' }) : null; if (n) { stampSel = n.id; panelStamp(s, p); showStamp(s, n); } else toast('That picture is too big to keep as a stamp.', 'warn'); };
  g('stNewImg').onclick = async () => { const f = await pickFile(); if (!f) return; try { await fromCanvas(await canvasFromUrl(await readFileAsDataUrl(f)), f.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Stamp'); } catch (e) { toast('That is not a picture I can read.', 'err'); } };
  g('stFromThis').onclick = () => { bake(s); fromCanvas(s.canvas, (s.name || 'Stamp').slice(0, 24)); };
  if (!st) return;
  const save = patch => { const n = stampUpdate(st.id, patch); if (n) showStamp(s, n); };
  g('stSize').oninput = e => { g('stSizeO').textContent = e.target.value + '%'; save({ size: Number(e.target.value) }); };
  g('stOp').oninput = e => { g('stOpO').textContent = e.target.value + '%'; save({ opacity: Number(e.target.value) / 100 }); };
  g('stMargin').oninput = e => { g('stMarginO').textContent = e.target.value + '%'; save({ margin: Number(e.target.value) }); };
  g('stTile').onchange = e => { save({ tile: e.target.checked }); panelStamp(s, p); };
  g('stPos').querySelectorAll('[data-pos]').forEach(b => b.onclick = () => { save({ position: b.dataset.pos, tile: false }); panelStamp(s, p); });
  g('stDel').onclick = async () => { if (!await askConfirm('Delete this stamp?')) return; stampRemove(st.id); stampSel = ''; pending = null; panelStamp(s, p); paintStage(); };
  const ed = g('stEdit'); if (ed) ed.onclick = async () => { const text = await askInput('Stamp text', st.text.text); if (text === null || !text.trim()) return; const n = stampUpdate(st.id, { name: text.trim().slice(0, 24), text: { ...st.text, text: text.trim() } }); if (n) { panelStamp(s, p); showStamp(s, n); } };
  g('stApply').onclick = async () => { const cur2 = stampsGet().find(x => x.id === st.id); const src = await stampCanvas(cur2); pending = null; edit(s, c => { ops.drawStamp(c, src, cur2); return null; }); };
  g('stAll').onclick = async () => {
    const cur2 = stampsGet().find(x => x.id === st.id); const pics = listPictures();
    if (!pics.length) { toast('The Gallery is empty.', 'warn'); return; }
    if (!await askConfirm(`Make a stamped copy of each of the ${pics.length} picture${pics.length === 1 ? '' : 's'} in the Gallery? The originals are not changed.`)) return;
    const src = await stampCanvas(cur2); let done = 0;
    for (const pic of pics) {
      try { const c = await canvasFromUrl(getFull(pic.id)); ops.drawStamp(c, src, cur2); const id = await addPicture({ dataUrl: ops.toDataUrl(c, 'image/webp', 0.92), name: pic.name + ' (stamped)', source: 'edited' }); if (id) done++; } catch (e) { /* skip this one */ }
    }
    toast(`Made ${done} stamped cop${done === 1 ? 'y' : 'ies'}.`, done ? 'ok' : 'warn'); renderImageSidebar();
  };
}

// ── Cut out the background (plain backgrounds) ──
function panelCutout(s, p) {
  p.innerHTML = `<div class="rx-none">Clears the background around the subject. Works best on plain or studio backgrounds. For busy photos, try <b>AI edit</b> with "remove the background".</div>
    <label class="img-sl"><span>Reach</span><input type="range" id="cutTol" min="1" max="60" value="${cutTol}"><output id="cutTolO">${cutTol}</output></label>
    <label class="img-sl"><span>Soft edge</span><input type="range" id="cutSoft" min="0" max="4" value="${cutSoft}"><output id="cutSoftO">${cutSoft}</output></label>
    <div class="pr-row"><button class="btn btn-s btn-sm" id="cutPick" type="button">${picking ? 'Click the picture...' : 'Pick the colour to remove'}</button><button class="btn btn-s btn-sm" id="cutAuto" type="button">Use the edge colour</button><span class="img-swatch" id="cutSwatch" style="background:${cutColor ? `rgb(${cutColor.join(',')})` : 'transparent'}" title="${cutColor ? 'Colour to remove' : 'The colour around the edge is used'}"></span></div>
    <button class="btn btn-p btn-sm" id="cutGo" type="button">Remove the background</button>
    <div class="rx-none">Tip: the eraser in <b>Draw</b> cleans up what is left.</div>`;
  g('cutTol').oninput = e => { cutTol = Number(e.target.value); g('cutTolO').textContent = cutTol; };
  g('cutSoft').oninput = e => { cutSoft = Number(e.target.value); g('cutSoftO').textContent = cutSoft; };
  g('cutPick').onclick = () => { picking = !picking; renderPanel(s); };
  g('cutAuto').onclick = () => { cutColor = null; picking = false; renderPanel(s); };
  g('cutGo').onclick = () => {
    let cleared = 0;
    edit(s, c => { const out = ops.removeBackground(ops.canvasToImage(c), { tolerance: cutTol, color: cutColor, feather: cutSoft }); cleared = out.cleared; return ops.imageToCanvas(out); });
    const total = s.canvas.width * s.canvas.height;
    toast(cleared < total * 0.01 ? 'Almost nothing was cleared. Raise "Reach" or pick the background colour.' : cleared > total * 0.97 ? 'Nearly everything was cleared. Lower "Reach" (undo brings it back).' : `Cleared ${Math.round(cleared / total * 100)}% of the picture.`, cleared < total * 0.01 || cleared > total * 0.97 ? 'warn' : 'ok');
  };
}

// ── Change the picture with words (needs a provider that can: OpenAI-compatible, SwarmUI or ComfyUI) ──
function panelAi(s, p) {
  const gs = loadGenSettings(), can = CAN_EDIT[gs.provider], who = { pollinations: 'Pollinations (free)', pollen: 'your Pollinations account', openai: 'OpenAI-compatible', swarmui: 'SwarmUI', comfyui: 'ComfyUI' }[gs.provider];
  p.innerHTML = `<div class="rx-none">Provider: <b>${esc(who)}</b>${can ? '' : ' (cannot change pictures)'} <button class="btn btn-s btn-sm" id="aiSettings" type="button">Settings</button></div>
    <textarea class="ftextarea" id="aiPrompt" style="min-height:80px" placeholder="What should change? Make the dress red. Remove the background. Add falling snow...">${esc(aiPrompt)}</textarea>
    <div class="img-presets">${['Remove the background', 'Make it night', 'Make it look like a watercolour painting', 'Change the hair colour to silver'].map(x => `<button type="button" class="img-preset" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <label class="img-sl"><span>Change</span><input type="range" id="aiStr" min="10" max="100" value="${Math.round(aiStrength * 100)}"><output id="aiStrO">${Math.round(aiStrength * 100)}%</output></label>
    <div class="rx-none">How much the picture may change (SwarmUI and ComfyUI). Lower keeps more of the original.</div>
    <div class="pr-row"><button class="btn btn-p btn-sm" id="aiGo" type="button"${can ? '' : ' disabled'}>${aiBusy ? 'Working...' : 'Apply AI edit'}</button><button class="btn btn-s btn-sm" id="aiStop" type="button">Stop</button></div>
    <div class="rx-none" id="aiStatus" role="status" style="color:var(--err,#e66)"></div>
    <div class="rx-none">This sends your picture and your words to ${esc(who)}${gs.provider === 'swarmui' || gs.provider === 'comfyui' ? ' (your own server)' : ''}. The result can be undone.</div>`;
  g('aiSettings').onclick = () => hooks.generate && hooks.generate();
  g('aiPrompt').oninput = e => { aiPrompt = e.target.value; };
  g('aiStr').oninput = e => { aiStrength = Number(e.target.value) / 100; g('aiStrO').textContent = e.target.value + '%'; };
  p.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { aiPrompt = b.dataset.ex; g('aiPrompt').value = aiPrompt; });
  g('aiStop').onclick = () => { if (aiBusy) aiBusy.abort(); };
  g('aiGo').onclick = async () => {
    if (aiBusy) return; const st = g('aiStatus'); st.textContent = '';
    bake(s); aiBusy = new AbortController(); g('aiGo').disabled = true; g('aiGo').textContent = 'Working...';
    const timer = setTimeout(() => aiBusy && aiBusy.abort(), 240000);
    try {
      const key = KEYED.includes(gs.provider) ? await getSecret(keyNameFor(gs.provider)) : '';
      const image = ops.toDataUrl(ops.previewCanvas(s.canvas, 1536), 'image/png');
      const out = await editImage({ prompt: aiPrompt, image, strength: aiStrength, settings: gs, apiKey: key, signal: aiBusy.signal });
      const c = await canvasFromUrl(out); edit(s, () => c);
      toast('Done. Undo (↶) goes back.', 'ok');
    } catch (e) { st.textContent = e && e.name === 'AbortError' ? 'Stopped.' : (e && e.message) || 'That did not work.'; }
    finally { clearTimeout(timer); aiBusy = null; const b = g('aiGo'); if (b) { b.disabled = !can; b.textContent = 'Apply AI edit'; } }
  };
}

// Pointer position inside the picture, in picture pixels
function toPicture(ev) {
  const s = cur(), v = g('imgView'); const r = v.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * s.canvas.width, y: (ev.clientY - r.top) / r.height * s.canvas.height };
}

function wireEditor(s) {
  g('imgUndo').onclick = () => undo(s);
  g('imgRedo').onclick = () => redo(s);
  g('imgSave').onclick = () => saveImage();
  g('imgSaveCopy').onclick = () => saveImage({ copy: true });
  g('imgDlPng').onclick = () => downloadImage('image/png');
  g('imgDlWebp').onclick = () => downloadImage('image/webp');
  g('imgDlJpg').onclick = () => downloadImage('image/jpeg');
  g('imgRevert').onclick = async () => {
    if (s.dirty && !await askConfirm('Throw away your edits and go back to the saved picture?')) return;
    sessions.delete(s.id); s.dirty = false; wsMarkSaved('image', s.id); openImageDoc(s.id);
  };
  g('imgName').oninput = e => { s.name = e.target.value; if (!s.dirty) markDirty(s); };
  const cmp = g('imgCompare'), on = v => { showOriginal = v; paintStage(); };
  ['pointerdown'].forEach(ev => cmp.addEventListener(ev, e => { e.preventDefault(); on(true); }));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cmp.addEventListener(ev, () => { if (showOriginal) on(false); }));
  const dd = g('dd-imgsave');
  dd.querySelector('.dd-btn').onclick = e => { e.stopPropagation(); const m = dd.querySelector('.dd-menu'), open = m.classList.contains('open'); closeAllDropdowns(); if (!open) m.classList.add('open'); };
  document.querySelectorAll('.img-tool').forEach(b => b.onclick = () => {
    tool = b.dataset.tool; crop = null; pending = null; picking = false;
    document.querySelectorAll('.img-tool').forEach(x => x.classList.toggle('active', x === b));
    renderPanel(s); paintStage();
  });
  wireStage(s);
}

// Keep receiving the pointer when it leaves the picture (not every browser or input can do this)
const capture = (el, ev) => { try { el.setPointerCapture(ev.pointerId); } catch (e) { /* fine without it */ } };

function wireStage(s) {
  const wrap = g('imgWrap'); let drag = null;
  wrap.style.touchAction = 'none';
  wrap.addEventListener('pointerdown', ev => {
    if (showOriginal) return;
    const pt = toPicture(ev);
    if (tool === 'draw') {
      ev.preventDefault(); capture(wrap, ev);
      pushHistory(s); bake(s); renderPanel(s);
      strokeBase = ops.cloneCanvas(s.canvas); stroke = [pt]; drawLive(s);
      drag = { kind: 'draw' };
    } else if (tool === 'layer' && pending && pending.kind === 'image') {
      ev.preventDefault(); capture(wrap, ev);
      pending.x = pt.x; pending.y = pt.y; drag = { kind: 'layer' }; paintStage();
    } else if (tool === 'cutout' && picking) {
      ev.preventDefault(); const d = s.canvas.getContext('2d').getImageData(Math.max(0, Math.min(s.canvas.width - 1, Math.round(pt.x))), Math.max(0, Math.min(s.canvas.height - 1, Math.round(pt.y))), 1, 1).data;
      cutColor = [d[0], d[1], d[2]]; picking = false; renderPanel(s);
    } else if (tool === 'text') {
      ev.preventDefault(); capture(wrap, ev);
      textOpts.x = pt.x; textOpts.y = pt.y; drag = { kind: 'text' }; paintStage();
    } else if (tool === 'crop' && crop) {
      ev.preventDefault(); capture(wrap, ev);
      const h = ev.target.dataset && ev.target.dataset.h;
      drag = { kind: 'crop', handle: h || (inside(pt, crop) ? 'move' : null), start: pt, from: { ...crop } };
      if (!drag.handle) drag = null;
    }
  });
  wrap.addEventListener('pointermove', ev => {
    if (!drag) return;
    const pt = toPicture(ev);
    if (drag.kind === 'draw') { stroke.push(pt); drawLive(s); }
    else if (drag.kind === 'text') { textOpts.x = pt.x; textOpts.y = pt.y; paintStage(); }
    else if (drag.kind === 'layer' && pending) { pending.x = pt.x; pending.y = pt.y; paintStage(); }
    else if (drag.kind === 'crop') {
      const W = s.canvas.width, H = s.canvas.height, f = drag.from, dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
      if (drag.handle === 'move') crop = { x: Math.max(0, Math.min(W - f.w, f.x + dx)), y: Math.max(0, Math.min(H - f.h, f.y + dy)), w: f.w, h: f.h };
      else {
        let x1 = f.x, y1 = f.y, x2 = f.x + f.w, y2 = f.y + f.h;
        if (drag.handle.includes('w')) x1 = Math.max(0, Math.min(x2 - 8, f.x + dx)); else x2 = Math.min(W, Math.max(x1 + 8, x2 + dx));
        if (drag.handle.includes('n')) y1 = Math.max(0, Math.min(y2 - 8, f.y + dy)); else y2 = Math.min(H, Math.max(y1 + 8, y2 + dy));
        if (cropRatio) { // keep the chosen shape: height follows width
          const nw = x2 - x1; let nh = nw / cropRatio;
          if (drag.handle.includes('n')) y1 = y2 - nh; else y2 = y1 + nh;
          if (y1 < 0 || y2 > H) { crop = crop || f; paintCrop(); return; }
        }
        crop = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      paintCrop();
    }
  });
  const end = () => {
    if (drag && drag.kind === 'draw') { stroke = null; strokeBase = null; markDirty(s); paintStage(); }
    drag = null;
  };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
}
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
// Paint the stroke so far on top of the picture while drawing (committed pixel by pixel on the canvas)
function drawLive(s) {
  // redraw the whole stroke over the picture as it was, so a see-through brush does not stack up on itself
  const x = s.canvas.getContext('2d');
  x.clearRect(0, 0, s.canvas.width, s.canvas.height); x.drawImage(strokeBase, 0, 0);
  ops.strokePath(s.canvas, stroke, { size: brush.size, color: brush.color, opacity: brush.opacity, erase: brush.erase });
  paintStage();
}

// ── Opening from the Gallery ──
export function registerImageEditorHooks() {
  hooks.edit = id => { wsShowItem('image', id); };
}
export function wireImageEditor() {
  const gal = g('imgHdrGallery'); if (gal) gal.onclick = () => { showLibraryTab('gallery'); navigateTo('library'); };
  const gen = g('imgHdrGen'); if (gen) gen.onclick = () => hooks.generate && hooks.generate();
  const sv = g('mobImageSave'); if (sv) sv.onclick = () => saveImage();
  const un = g('mobImageUndo'); if (un) un.onclick = () => { const s = cur(); if (s) undo(s); };
}
