// ═══════════════════════════════════════════════════════
// HOME — a launchpad: jump back in, quick actions, your favourites, and an inspiration board.
//
// The board is free-form: image cards, note cards and link cards, kept in `aet_home`:
//   { v: 1, board: [ { id, type: 'image'|'note'|'link', title, text, url, image, color, createdAt } ] }
// Favourites come from the Library (anything pinned there), so they are never copied.
// ═══════════════════════════════════════════════════════
import { readFileAsDataUrl, resizeImage } from './avatar.js';
import { BOOK_COLORS, bookThumb, libraryRows, openLibraryItem } from './library_view.js';
import { navigateTo } from './router.js';
import { safeSet } from './storage.js';
import { store } from './kv.js';
import { registerTrashRestorer, trashPush } from './trash.js';
import { askConfirm, closeAllDropdowns, closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const HOME_KEY = 'aet_home';
export const CARD_TYPES = [['image', 'Image'], ['note', 'Note'], ['link', 'Link']];
const MAX_IMG = 700000;
export const homeId = () => 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

// ── The record ──
export const safeUrl = u => { const s = String(u || '').trim(); return /^https?:\/\/[^\s]+$/i.test(s) ? s : ''; };
const cleanColor = v => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : '');
const cleanImg = v => (typeof v === 'string' && v.startsWith('data:image/') && v.length <= MAX_IMG ? v : '');

export function normalizeCard(c) {
  const o = isObj(c) ? c : {};
  const type = CARD_TYPES.some(t => t[0] === o.type) ? o.type : 'note';
  return {
    id: typeof o.id === 'string' && o.id ? o.id : homeId(), type,
    title: String(o.title || '').slice(0, 120), text: String(o.text || '').slice(0, 4000),
    url: type === 'link' ? safeUrl(o.url) : '', image: type === 'image' ? cleanImg(o.image) : '',
    color: cleanColor(o.color), createdAt: typeof o.createdAt === 'string' ? o.createdAt : '',
  };
}
export function normalizeHome(h) {
  const o = isObj(h) ? h : {};
  const seen = new Set();
  const board = (Array.isArray(o.board) ? o.board : []).filter(isObj).map(normalizeCard).filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  return { v: 1, board };
}
export function homeGet() {
  try { const raw = store.get(HOME_KEY); return raw ? normalizeHome(JSON.parse(raw)) : normalizeHome(null); } catch (e) { return normalizeHome(null); }
}
export function homeSet(h) { return safeSet(HOME_KEY, JSON.stringify(normalizeHome(h))); }

// Move a card one step (-1 earlier, +1 later); returns true when it moved
export function moveCard(h, id, dir) {
  const i = h.board.findIndex(c => c.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= h.board.length) return false;
  [h.board[i], h.board[j]] = [h.board[j], h.board[i]];
  return true;
}

// ── Rendering ──
const fmtDate = iso => { try { return iso ? new Date(iso).toLocaleDateString() : ''; } catch (e) { return ''; } };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

function cardHtml(c) {
  const tint = c.color ? ` style="--hb:${esc(c.color)}"` : '';
  const edit = `data-card="${esc(c.id)}" tabindex="0" role="button" aria-label="Edit ${esc(c.title || c.type + ' card')}"`;
  if (c.type === 'image') return `<figure class="hb-card hb-image" ${edit}>${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy">` : '<div class="hb-noimg">no picture</div>'}${c.title || c.text ? `<figcaption>${c.title ? `<b>${esc(c.title)}</b>` : ''}${c.text ? `<span>${esc(c.text)}</span>` : ''}</figcaption>` : ''}</figure>`;
  if (c.type === 'link') return `<div class="hb-card hb-link${c.color ? ' tinted' : ''}"${tint} ${edit}><div class="hb-title">${esc(c.title || hostOf(c.url) || 'Link')}</div>${c.text ? `<div class="hb-text">${esc(c.text)}</div>` : ''}${c.url ? `<a class="hb-open" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(c.url))} ↗</a>` : '<div class="hb-text">No link yet</div>'}</div>`;
  return `<div class="hb-card hb-note${c.color ? ' tinted' : ''}"${tint} ${edit}>${c.title ? `<div class="hb-title">${esc(c.title)}</div>` : ''}<div class="hb-text">${esc(c.text)}</div></div>`;
}

export function renderHomeDashboard(el) {
  const { rows, m } = libraryRows();
  const home = homeGet();
  const byUsed = [...rows].sort((a, b) => (b.used || '').localeCompare(a.used || ''));
  const recent = byUsed.slice(0, 6);
  const pinned = rows.filter(r => r.rec.pinned).sort((a, b) => (b.used || '').localeCompare(a.used || ''));
  const counts = k => rows.filter(r => r.kind === k).length;
  const tile = (r, i, attr) => `<div class="dash-recent-item" data-kind="${esc(r.kindLabel)}" ${attr}="${i}" tabindex="0" role="button"${r.rec.color ? ` style="--bk:${esc(r.rec.color)}"` : ''}>
      <span class="dash-recent-thumb">${bookThumb(r)}</span>
      <span class="dash-recent-name">${esc(r.name || 'Untitled')}</span>
      <span class="dash-recent-type">${esc(r.kindLabel)}</span>
      <span class="dash-recent-date">${esc(fmtDate(r.used))}</span>
    </div>`;
  const last = recent[0];

  el.innerHTML = `
    <div class="dashboard">
      ${last ? `<div class="dash-continue"><div><div class="dash-continue-k">Jump back in</div><div class="dash-continue-n">${esc(last.name || 'Untitled')}</div><div class="dash-continue-m">${esc(last.kindLabel)} · ${esc(fmtDate(last.used))}</div></div><button class="btn btn-p" id="homeContinue">Continue →</button></div>` : ''}
      <div class="dash-section">
        <div class="dash-section-title">Quick Actions</div>
        <div class="dash-actions">
          <button class="btn btn-ok dash-act" data-new="lore">✦ New Entry</button>
          <button class="btn btn-p dash-act" data-new="char">+ New Character</button>
          <button class="btn btn-s dash-act" data-new="preset">⚙︎ New Preset</button>
          <button class="btn btn-s dash-act" data-new="prompt">✎︎ New Prompt Pack</button>
          <button class="btn btn-s dash-act" data-new="regex">⌕ New Regex Set</button>
          <button class="btn btn-s dash-act" data-go="library">▤ Library</button>
        </div>
      </div>
      ${pinned.length ? `<div class="dash-section"><div class="dash-section-title">Favourites</div><div class="dash-recent dash-tiles" id="dash-pinned-list">${pinned.slice(0, 8).map((r, i) => tile(r, i, 'data-pin-idx')).join('')}</div></div>` : ''}
      <div class="dash-section">
        <div class="dash-section-title">Recent</div>
        <div class="dash-recent dash-tiles" id="dash-recent-list">${recent.length ? recent.map((r, i) => tile(r, i, 'data-recent-idx')).join('') : '<div class="dash-empty">nothing yet</div>'}</div>
      </div>
      <div class="dash-section">
        <div class="hb-head"><div class="dash-section-title">Inspiration</div>
          <div class="dd" id="hbAddDd"><button class="btn btn-s btn-sm dd-btn" id="hbAddBtn" aria-haspopup="true">+ Add</button>
            <div class="dd-menu"><button class="dd-item" data-hbnew="image">Image</button><button class="dd-item" data-hbnew="note">Note</button><button class="dd-item" data-hbnew="link">Link</button></div></div></div>
        <div class="hb-zone" id="hbZone" data-drop-own>
        ${home.board.length ? `<div class="home-board" id="homeBoard">${home.board.map(cardHtml).join('')}</div>` : '<div class="dash-empty">A board for anything that sparks an idea: pictures, notes, links. Use + Add, or drop pictures here.</div>'}
        </div>
      </div>
      <div class="dash-overview">
        <div class="dash-stat"><span class="dash-stat-num">${counts('lore')}</span><span class="dash-stat-lbl">lorebooks</span></div>
        <div class="dash-stat"><span class="dash-stat-num">${counts('char')}</span><span class="dash-stat-lbl">characters</span></div>
        <div class="dash-stat"><span class="dash-stat-num">${counts('preset')}</span><span class="dash-stat-lbl">presets</span></div>
        <div class="dash-stat"><span class="dash-stat-num">${counts('prompt')}</span><span class="dash-stat-lbl">prompt packs</span></div>
        <div class="dash-stat"><span class="dash-stat-num">${counts('regex')}</span><span class="dash-stat-lbl">regex</span></div>
        <div class="dash-stat"><span class="dash-stat-num">${counts('persona')}</span><span class="dash-stat-lbl">personas</span></div>
      </div>
      <div class="home-footer-note">// all data stays in your browser &nbsp;·&nbsp; <a href="https://loreos.net/legal.html" target="_blank" rel="noopener" style="color:var(--txm);text-decoration:none;border-bottom:1px solid var(--bd)">privacy &amp; terms</a></div>
    </div>`;

  const open = r => () => openLibraryItem(r);
  el.querySelectorAll('[data-recent-idx]').forEach(n => { const f = open(recent[Number(n.dataset.recentIdx)]); n.addEventListener('click', f); n.addEventListener('keydown', e => { if (e.key === 'Enter') f(); }); });
  el.querySelectorAll('[data-pin-idx]').forEach(n => { const f = open(pinned[Number(n.dataset.pinIdx)]); n.addEventListener('click', f); n.addEventListener('keydown', e => { if (e.key === 'Enter') f(); }); });
  const cont = el.querySelector('#homeContinue'); if (cont && last) cont.onclick = open(last);

  // the + Add menu is drawn with the page, after the app's one-time dropdown wiring, so it wires itself
  const dd = el.querySelector('#hbAddDd'), menu = dd.querySelector('.dd-menu');
  dd.querySelector('.dd-btn').onclick = e => { e.stopPropagation(); const isOpen = menu.classList.contains('open'); closeAllDropdowns(); if (!isOpen) menu.classList.add('open'); };
  el.querySelectorAll('[data-hbnew]').forEach(b => b.onclick = () => { closeAllDropdowns(); openCardEditor(null, b.dataset.hbnew); });
  el.querySelectorAll('[data-card]').forEach(n => {
    const edit = () => openCardEditor(n.dataset.card);
    n.addEventListener('click', e => { if (e.target.closest('a') || justDragged) return; edit(); });
    n.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target === n) { edit(); return; }
      // Alt + arrow keys move the card without a mouse
      if (e.altKey && e.target === n && /^Arrow(Left|Up|Right|Down)$/.test(e.key)) {
        e.preventDefault();
        const id = n.dataset.card, h = homeGet();
        if (moveCard(h, id, /Left|Up/.test(e.key) ? -1 : 1)) { homeSet(h); rerender(); const again = document.querySelector('[data-card="' + id + '"]'); if (again) again.focus(); }
      }
    });
  });
  const board = el.querySelector('#homeBoard');
  if (board) wireBoardDrag(board);
  wireBoardDrop(el.querySelector('#hbZone'));
}

// ── Rearranging: drag a card (mouse: just drag; touch: press and hold, then drag) ──
let justDragged = false;
export function reorderBoard(order) {
  const home = homeGet();
  const byId = new Map(home.board.map(c => [c.id, c]));
  const next = order.map(id => byId.get(id)).filter(Boolean);
  home.board.forEach(c => { if (!next.includes(c)) next.push(c); });
  home.board = next;
  return homeSet(home);
}
function wireBoardDrag(board) {
  let st = null;
  const THRESH = 6, HOLD_MS = 280;
  const scroller = board.closest('.view-scroll') || document.scrollingElement;
  let rafId = 0, lastY = 0;
  const cleanup = () => {
    if (!st) return;
    clearTimeout(st.timer); cancelAnimationFrame(rafId);
    if (st.ghost) st.ghost.remove();
    st.card.classList.remove('hb-dragging'); board.classList.remove('dragging');
    document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel); document.removeEventListener('keydown', onKey);
    st = null;
  };
  const startDrag = () => {
    if (!st || st.dragging) return;
    st.dragging = true;
    const r = st.card.getBoundingClientRect();
    st.offX = st.x - r.left; st.offY = st.y - r.top;
    const ghost = st.card.cloneNode(true);
    ghost.classList.add('hb-ghost'); ghost.removeAttribute('data-card'); ghost.removeAttribute('tabindex');
    ghost.style.width = r.width + 'px'; ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px';
    document.body.append(ghost); st.ghost = ghost;
    st.card.classList.add('hb-dragging'); board.classList.add('dragging');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* not available */ } }
    const tick = () => {
      if (!st || !st.dragging) return;
      const box = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight };
      if (lastY < box.top + 70) scroller.scrollBy(0, -14); else if (lastY > box.bottom - 70) scroller.scrollBy(0, 14);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  };
  const onMove = e => {
    if (!st || e.pointerId !== st.id) return;
    lastY = e.clientY;
    if (!st.dragging) {
      const moved = Math.hypot(e.clientX - st.x, e.clientY - st.y);
      if (st.type === 'mouse' || st.type === 'pen') { if (moved > THRESH) startDrag(); }
      else if (moved > 10) { cleanup(); return; } // moved before the hold finished: it is a scroll
      if (!st || !st.dragging) return;
    }
    e.preventDefault();
    st.ghost.style.left = (e.clientX - st.offX) + 'px'; st.ghost.style.top = (e.clientY - st.offY) + 'px';
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const t = hit && hit.closest ? hit.closest('.hb-card') : null;
    if (t && t !== st.card && board.contains(t)) {
      const r = t.getBoundingClientRect();
      board.insertBefore(st.card, e.clientY < r.top + r.height / 2 ? t : t.nextSibling);
    }
  };
  const onUp = e => {
    if (!st || e.pointerId !== st.id) return;
    const was = st.dragging;
    if (was) {
      const order = [...board.querySelectorAll('.hb-card[data-card]')].map(c => c.dataset.card);
      cleanup(); justDragged = true; setTimeout(() => { justDragged = false; }, 80);
      reorderBoard(order);
    } else cleanup();
  };
  const onCancel = () => { const was = st && st.dragging; cleanup(); if (was) rerender(); };
  const onKey = e => { if (e.key === 'Escape' && st && st.dragging) { cleanup(); rerender(); } };
  board.addEventListener('pointerdown', e => {
    const card = e.target.closest('.hb-card');
    if (!card || e.target.closest('a') || (e.pointerType === 'mouse' && e.button !== 0) || st) return;
    st = { card, x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, dragging: false, timer: null };
    lastY = e.clientY;
    if (st.type !== 'mouse' && st.type !== 'pen') st.timer = setTimeout(startDrag, HOLD_MS);
    document.addEventListener('pointermove', onMove, { passive: false }); document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel); document.addEventListener('keydown', onKey);
  });
  // once a touch drag has begun the page must not scroll under the finger
  board.addEventListener('touchmove', e => { if (st && st.dragging && e.cancelable) e.preventDefault(); }, { passive: false });
  board.addEventListener('contextmenu', e => { if (st) e.preventDefault(); });
  board.addEventListener('dragstart', e => e.preventDefault()); // no native picture dragging
}

// ── Dropping picture files on the board makes image cards ──
async function addPictureFiles(files) {
  const imgs = [...files].filter(f => /^image\//.test(f.type));
  if (!imgs.length) { toast('Drop pictures here to add them to the board.', 'info'); return 0; }
  const home = homeGet();
  let added = 0, skipped = 0;
  for (const f of imgs) {
    const out = await resizeImage(await readFileAsDataUrl(f), 640, 640);
    if (!out || out.length > MAX_IMG) { skipped++; continue; }
    home.board.unshift(normalizeCard({ id: homeId(), type: 'image', title: f.name.replace(/\.[^.]+$/, '').slice(0, 60), image: out, createdAt: new Date().toISOString() }));
    added++;
  }
  if (added) homeSet(home);
  toast(added ? `Added ${added} picture${added === 1 ? '' : 's'} to the board.` + (skipped ? ` ${skipped} could not be used.` : '') : 'Those pictures could not be used.', added ? 'ok' : 'warn');
  return added;
}
export { addPictureFiles };
function wireBoardDrop(zone) {
  if (!zone) return;
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  zone.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); zone.classList.add('over'); } });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('over'); });
  zone.addEventListener('drop', async e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); zone.classList.remove('over');
    await addPictureFiles(e.dataTransfer.files); rerender();
  });
}

// ── The card editor ──
let editing = null; // { id|null, type, image, color }
export function openCardEditor(id, type) {
  const home = homeGet();
  const card = id ? home.board.find(c => c.id === id) : null;
  if (id && !card) return;
  editing = { id: card ? card.id : null, type: card ? card.type : (CARD_TYPES.some(t => t[0] === type) ? type : 'note'), image: card ? card.image : '', color: card ? card.color : '' };
  g('hbTitle').value = card ? card.title : '';
  g('hbText').value = card ? card.text : '';
  g('hbUrl').value = card ? card.url : '';
  g('hbHead').textContent = (card ? 'Edit ' : 'New ') + CARD_TYPES.find(t => t[0] === editing.type)[1].toLowerCase() + ' card';
  g('hbUrlRow').style.display = editing.type === 'link' ? '' : 'none';
  g('hbImgRow').style.display = editing.type === 'image' ? '' : 'none';
  g('hbColorRow').style.display = editing.type === 'image' ? 'none' : '';
  g('hbDelete').style.display = card ? '' : 'none';
  g('hbEarlier').style.display = g('hbLater').style.display = card ? '' : 'none';
  g('hbText').placeholder = editing.type === 'image' ? 'Caption (optional)' : editing.type === 'link' ? 'Why it is here (optional)' : 'What is on your mind...';
  paintEditor();
  openModal('hbModal');
}
function paintEditor() {
  if (!editing) return;
  g('hbPrev').innerHTML = editing.image ? `<img src="${esc(editing.image)}" alt="">` : '<span>no picture yet</span>';
  g('hbImgClear').style.display = editing.image ? '' : 'none';
  g('hbColors').querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === editing.color));
}
function saveCard() {
  if (!editing) return false;
  const card = normalizeCard({ id: editing.id || homeId(), type: editing.type, title: g('hbTitle').value.trim(), text: g('hbText').value, url: g('hbUrl').value, image: editing.image, color: editing.color, createdAt: new Date().toISOString() });
  if (editing.type === 'link' && g('hbUrl').value.trim() && !card.url) { toast('That link needs to start with http:// or https://', 'warn'); return false; }
  if (editing.type === 'image' && !card.image) { toast('Choose a picture first.', 'warn'); return false; }
  if (editing.type !== 'image' && !card.title && !card.text && !card.url) { toast('Write something first.', 'warn'); return false; }
  const home = homeGet();
  const i = home.board.findIndex(c => c.id === card.id);
  if (i >= 0) { card.createdAt = home.board[i].createdAt || card.createdAt; home.board[i] = card; } else home.board.unshift(card);
  homeSet(home);
  return true;
}
const rerender = () => { const el = document.getElementById('home-content'); if (el && document.getElementById('view-home') && document.getElementById('view-home').classList.contains('view-active')) renderHomeDashboard(el); };

export function wireHome() {
  g('hbColors').innerHTML = BOOK_COLORS.map(c => `<button type="button" class="libx-swatch" data-c="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('') + '<button type="button" class="btn btn-s btn-sm" data-c="">None</button>';
  g('hbColors').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b || !editing) return; editing.color = b.dataset.c; paintEditor(); });
  g('hbImgBtn').onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f || !editing) return;
      if (!/^image\//.test(f.type)) { toast('That is not a picture.', 'warn'); return; }
      const out = await resizeImage(await readFileAsDataUrl(f), 640, 640);
      if (!out) { toast('Could not read that picture.', 'err'); return; }
      if (out.length > MAX_IMG) { toast('That picture is too big to keep. Try a smaller one.', 'warn'); return; }
      editing.image = out; paintEditor();
    };
    inp.click();
  };
  g('hbImgClear').onclick = () => { if (editing) { editing.image = ''; paintEditor(); } };
  g('hbSave').onclick = () => { if (saveCard()) { closeModal('hbModal'); editing = null; rerender(); } };
  g('hbDelete').onclick = async () => {
    if (!editing || !editing.id) return;
    if (!await askConfirm('Delete this card? You can bring it back from Settings > Storage > Recently deleted.')) return;
    const home = homeGet(); const c = home.board.find(x => x.id === editing.id); if (!c) return;
    trashPush('homecard', c.title || c.type + ' card', c);
    home.board = home.board.filter(x => x.id !== c.id); homeSet(home);
    closeModal('hbModal'); editing = null; rerender();
  };
  const move = dir => { if (!editing || !editing.id) return; const home = homeGet(); if (moveCard(home, editing.id, dir)) { homeSet(home); rerender(); } };
  g('hbEarlier').onclick = () => move(-1);
  g('hbLater').onclick = () => move(1);
}

registerMarkup(190, `<div id="hbModal" class="modal">
  <div class="modal-box" style="max-width:480px">
    <div class="modal-head"><h2 id="hbHead">Card</h2><button class="modal-x" data-close="hbModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.65rem">
      <div id="hbImgRow" style="display:flex;flex-direction:column;gap:.4rem">
        <div id="hbPrev" class="hb-prev"></div>
        <div class="pr-row"><button class="btn btn-s btn-sm" id="hbImgBtn" type="button">Choose a picture</button><button class="btn btn-s btn-sm" id="hbImgClear" type="button">Remove</button></div>
      </div>
      <input class="finput" id="hbTitle" maxlength="120" placeholder="Title (optional)" aria-label="Title">
      <div id="hbUrlRow"><input class="finput" id="hbUrl" placeholder="https://..." aria-label="Link"></div>
      <textarea class="ftextarea" id="hbText" style="min-height:90px" aria-label="Text"></textarea>
      <div id="hbColorRow"><div class="pr-lbl">Colour</div><div id="hbColors" class="libx-colorgrid"></div></div>
      <div class="pr-row"><button class="btn btn-p btn-sm" id="hbSave">Save</button><button class="btn btn-s btn-sm" id="hbEarlier" title="Move earlier on the board">←</button><button class="btn btn-s btn-sm" id="hbLater" title="Move later on the board">→</button><button class="btn btn-err btn-sm" id="hbDelete">Delete</button></div>
    </div>
  </div>
</div>`);

registerTrashRestorer('homecard', data => {
  const home = homeGet();
  const c = normalizeCard(data);
  if (home.board.some(x => x.id === c.id)) c.id = homeId();
  home.board.unshift(c); homeSet(home); rerender();
});
