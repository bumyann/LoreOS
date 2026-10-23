// ═══════════════════════════════════════════════════════
// JOURNAL MODEL — the pure part: pages that nest inside pages, templates, and links to Library items.
// No DOM here, so it can be tested on its own.
//
//   loreos_notebook = { notebooks: { [id]: { id, title, createdAt, updatedAt, order } },
//                       pages: { [id]: { id, title, content, createdAt, updatedAt, parent, order, notebook } },
//                       activeNotebookId, activePageId, collapsed: { [id]: true }, templates: { [id]: { id, name, title, content, createdAt } } }
//
// A notebook holds pages; pages nest inside pages. A page always belongs to the notebook its top-level ancestor is in.
// `content` is Markdown. Older data (no notebooks/parent/order/collapsed/templates) loads fine: its pages are put in one
// notebook called "Journal", every page is top level in it and keeps the newest-first order it always had.
// ═══════════════════════════════════════════════════════
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const MAX_DEPTH = 40;
export const DEFAULT_BOOK = 'bk_journal';

export const bookId = () => 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const nbId = () => 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
export const tplId = () => 'tp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function normalizeJournal(d) {
  const src = isObj(d) ? d : {};
  const pages = {};
  Object.entries(isObj(src.pages) ? src.pages : {}).forEach(([id, p]) => {
    if (!isObj(p)) return;
    pages[id] = { ...p, id: typeof p.id === 'string' && p.id ? p.id : id, title: typeof p.title === 'string' ? p.title : '', content: typeof p.content === 'string' ? p.content : '' };
  });
  // a page's parent must exist and must not lead back to the page itself
  Object.values(pages).forEach(p => {
    if (typeof p.parent !== 'string' || !pages[p.parent] || p.parent === p.id) p.parent = null;
  });
  Object.values(pages).forEach(p => {
    let hops = 0, cur = p.parent;
    while (cur && hops++ < MAX_DEPTH) { if (cur === p.id) { p.parent = null; break; } cur = pages[cur] ? pages[cur].parent : null; }
    if (hops >= MAX_DEPTH) p.parent = null;
  });
  // old pages have no order: keep the newest-first order they always had
  Object.values(pages).forEach(p => {
    if (!Number.isFinite(p.order)) p.order = -(Date.parse(p.updatedAt || p.createdAt || '') || 0) / 1000;
  });
  // notebooks. Pages from before notebooks existed go in one called "Journal".
  const notebooks = {};
  Object.entries(isObj(src.notebooks) ? src.notebooks : {}).forEach(([id, b]) => {
    if (!isObj(b)) return;
    const bid = typeof b.id === 'string' && b.id ? b.id : id;
    notebooks[bid] = { id: bid, title: String(b.title || 'Notebook').slice(0, 80), createdAt: typeof b.createdAt === 'string' ? b.createdAt : '', updatedAt: typeof b.updatedAt === 'string' ? b.updatedAt : (typeof b.createdAt === 'string' ? b.createdAt : ''), order: Number.isFinite(b.order) ? b.order : 0 };
  });
  const rootOf = p => { let cur = p, hops = 0; while (cur.parent && pages[cur.parent] && hops++ < MAX_DEPTH) cur = pages[cur.parent]; return cur; };
  const orphan = Object.values(pages).some(p => !p.parent && !notebooks[p.notebook]);
  if (orphan) {
    if (!notebooks[DEFAULT_BOOK]) notebooks[DEFAULT_BOOK] = { id: DEFAULT_BOOK, title: 'Journal', createdAt: '', updatedAt: '', order: -1 };
    Object.values(pages).forEach(p => { if (!p.parent && !notebooks[p.notebook]) p.notebook = DEFAULT_BOOK; });
  }
  // a subpage is always in its top-level ancestor's notebook
  Object.values(pages).forEach(p => { p.notebook = rootOf(p).notebook; });
  const collapsed = {};
  Object.keys(isObj(src.collapsed) ? src.collapsed : {}).forEach(id => { if (pages[id] && src.collapsed[id]) collapsed[id] = true; });
  const templates = {};
  Object.entries(isObj(src.templates) ? src.templates : {}).forEach(([id, t]) => {
    if (!isObj(t)) return;
    templates[id] = { id, name: String(t.name || 'Template').slice(0, 60), title: String(t.title || '').slice(0, 120), content: typeof t.content === 'string' ? t.content : '', createdAt: typeof t.createdAt === 'string' ? t.createdAt : '' };
  });
  const activePageId = typeof src.activePageId === 'string' && pages[src.activePageId] ? src.activePageId : null;
  const activeNotebookId = activePageId ? pages[activePageId].notebook : (typeof src.activeNotebookId === 'string' && notebooks[src.activeNotebookId] ? src.activeNotebookId : null);
  return { ...src, notebooks, pages, activeNotebookId, activePageId, collapsed, templates };
}

// ── The tree ──
const byOrder = (a, b) => (a.order - b.order) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id);
// Pages under `parent`. At the top level (parent = null) a notebook can be given to see only its pages.
export const childrenOf = (d, parent = null, notebook = null) => Object.values(d.pages).filter(p => (p.parent || null) === (parent || null) && (parent || !notebook || p.notebook === notebook)).sort(byOrder);
export function descendants(d, id) {
  const out = [];
  childrenOf(d, id).forEach(c => { out.push(c.id, ...descendants(d, c.id)); });
  return out;
}
export function breadcrumb(d, id) {
  const out = []; let cur = id, hops = 0;
  while (cur && d.pages[cur] && hops++ < MAX_DEPTH) { out.unshift(d.pages[cur]); cur = d.pages[cur].parent; }
  return out;
}
// The pages in the order the sidebar shows them: [{ page, depth, kids, open }]. While searching, matches and the
// pages they sit in are shown, whatever is collapsed.
export function flattenTree(d, query = '', notebook = null) {
  const q = String(query || '').trim().toLowerCase();
  const show = new Set();
  if (q) Object.values(d.pages).forEach(p => {
    if ((p.title || '').toLowerCase().includes(q) || (p.content || '').toLowerCase().includes(q)) breadcrumb(d, p.id).forEach(a => show.add(a.id));
  });
  const out = [];
  const walk = (parent, depth) => childrenOf(d, parent, notebook).forEach(p => {
    if (q && !show.has(p.id)) return;
    const kids = childrenOf(d, p.id).length, open = q ? true : !d.collapsed[p.id];
    out.push({ page: p, depth, kids, open });
    if (kids && open) walk(p.id, depth + 1);
  });
  walk(null, 0);
  return out;
}

// ── Notebooks ──
export const notebooksOf = d => Object.values(d.notebooks).sort(byOrder);
export const pageCount = (d, notebook) => Object.values(d.pages).filter(p => p.notebook === notebook).length;
export function newNotebook(d, { title = '' } = {}) {
  const id = bookId(), now = new Date().toISOString(), all = notebooksOf(d);
  d.notebooks[id] = { id, title: String(title).trim().slice(0, 80) || 'New notebook', createdAt: now, updatedAt: now, order: all.length ? all[all.length - 1].order + 1 : 0 };
  return id;
}
export function renameNotebook(d, id, title) {
  const b = d.notebooks[id]; if (!b) return false;
  b.title = String(title).trim().slice(0, 80) || b.title; b.updatedAt = new Date().toISOString(); return true;
}
// Deleting a notebook deletes its pages too. Returns what was removed so it can be put back.
export function removeNotebook(d, id) {
  const b = d.notebooks[id]; if (!b) return null;
  const pages = Object.values(d.pages).filter(p => p.notebook === id).map(p => ({ ...p }));
  pages.forEach(p => { delete d.pages[p.id]; delete d.collapsed[p.id]; });
  delete d.notebooks[id];
  if (d.activeNotebookId === id) d.activeNotebookId = null;
  if (d.activePageId && !d.pages[d.activePageId]) d.activePageId = null;
  return { notebook: { ...b }, pages };
}
export function restoreNotebook(d, snap) {
  if (!snap || !snap.notebook) return null;
  const id = d.notebooks[snap.notebook.id] ? bookId() : snap.notebook.id;
  d.notebooks[id] = { ...snap.notebook, id };
  const keep = new Set(Object.keys(d.pages));
  (snap.pages || []).forEach(p => { const pid = keep.has(p.id) ? nbId() : p.id; d.pages[pid] = { ...p, id: pid, notebook: id }; });
  return id;
}
// Move a top-level page (with everything inside it) to another notebook
export function moveToNotebook(d, id, notebook) {
  const p = d.pages[id]; if (!p || !d.notebooks[notebook]) return false;
  p.parent = null; const sibs = childrenOf(d, null, notebook).filter(s => s.id !== id);
  [id, ...descendants(d, id)].forEach(i => { d.pages[i].notebook = notebook; });
  p.order = sibs.length ? sibs[sibs.length - 1].order + 1 : 0;
  return true;
}
export const notebookOf = (d, pageId) => (d.pages[pageId] ? d.notebooks[d.pages[pageId].notebook] || null : null);

// Search across every notebook and page: notebooks by title, pages by title or text. Best matches first.
const strip = md => String(md || '').replace(/<[^>]+>/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~-]+/g, ' ').replace(/\s+/g, ' ').trim();
export function searchAll(d, query, limit = 60) {
  const q = String(query || '').trim().toLowerCase(); if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean), out = [];
  const score = (title, body) => {
    const t = title.toLowerCase(), b = body.toLowerCase();
    if (!words.every(w => t.includes(w) || b.includes(w))) return 0;
    return (t === q ? 100 : t.startsWith(q) ? 60 : words.every(w => t.includes(w)) ? 40 : 10) + (b.includes(q) ? 5 : 0);
  };
  Object.values(d.notebooks).forEach(b => { const sc = score(b.title || '', ''); if (sc) out.push({ type: 'notebook', id: b.id, title: b.title, path: [], notebook: b.id, snippet: pageCount(d, b.id) + ' pages', score: sc + 2 }); });
  Object.values(d.pages).forEach(p => {
    const body = strip(p.content), sc = score(p.title || '', body); if (!sc) return;
    const at = body.toLowerCase().indexOf(words[0]); const from = Math.max(0, at - 30);
    const crumbs = breadcrumb(d, p.id).slice(0, -1).map(a => a.title || 'Untitled');
    out.push({ type: 'page', id: p.id, title: p.title || 'Untitled', path: [(d.notebooks[p.notebook] || {}).title || 'Journal', ...crumbs], notebook: p.notebook, snippet: at >= 0 ? (from ? '…' : '') + body.slice(from, from + 90) : body.slice(0, 90), score: sc });
  });
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

// ── Changing it (these mutate the data they are given and return what is useful) ──
export function newPage(d, { parent = null, notebook = null, title = '', content = '' } = {}) {
  const id = nbId(), now = new Date().toISOString();
  const par = parent && d.pages[parent] ? parent : null;
  // a subpage lives where its parent does; a top-level page goes in the notebook asked for, else the open one, else the first
  let book = par ? d.pages[par].notebook : (d.notebooks[notebook] ? notebook : d.notebooks[d.activeNotebookId] ? d.activeNotebookId : (notebooksOf(d)[0] || {}).id);
  if (!book) { if (!d.notebooks[DEFAULT_BOOK]) d.notebooks[DEFAULT_BOOK] = { id: DEFAULT_BOOK, title: 'Journal', createdAt: now, updatedAt: now, order: -1 }; book = DEFAULT_BOOK; }
  const sibs = childrenOf(d, par, book);
  // top-level pages go to the top (newest first, as before); subpages go to the end of their parent
  const order = par ? (sibs.length ? sibs[sibs.length - 1].order + 1 : 0) : (sibs.length ? sibs[0].order - 1 : 0);
  d.pages[id] = { id, title, content, createdAt: now, updatedAt: now, parent: par, order, notebook: book };
  d.notebooks[book].updatedAt = now;
  if (par) delete d.collapsed[par];
  return id;
}
export function canMove(d, id, parent) {
  if (!d.pages[id]) return false;
  if (!parent) return true;
  return !!d.pages[parent] && parent !== id && !descendants(d, id).includes(parent);
}
// Put `id` under `parent` (null = top level), before `beforeId` among its new siblings, or at the end
export function movePage(d, id, parent = null, beforeId = null) {
  if (!canMove(d, id, parent)) return false;
  const sibs = childrenOf(d, parent, parent ? null : d.pages[id].notebook).filter(p => p.id !== id);
  const at = beforeId ? sibs.findIndex(p => p.id === beforeId) : -1;
  sibs.splice(at < 0 ? sibs.length : at, 0, d.pages[id]);
  d.pages[id].parent = parent || null;
  if (parent) { const book = d.pages[parent].notebook; [id, ...descendants(d, id)].forEach(i => { d.pages[i].notebook = book; }); }
  sibs.forEach((p, i) => { p.order = i; });
  if (parent) delete d.collapsed[parent];
  return true;
}
export function nudge(d, id, dir) {
  const p = d.pages[id]; if (!p) return false;
  const sibs = childrenOf(d, p.parent, p.notebook), i = sibs.findIndex(s => s.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= sibs.length) return false;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  sibs.forEach((s, k) => { s.order = k; });
  return true;
}
// Deleting a page keeps what is inside it: its subpages move up one level
export function removePage(d, id) {
  const p = d.pages[id]; if (!p) return null;
  const kids = childrenOf(d, id), at = childrenOf(d, p.parent, p.notebook);
  const insertAt = at.findIndex(s => s.id === id);
  const rest = at.filter(s => s.id !== id);
  rest.splice(insertAt, 0, ...kids);
  kids.forEach(k => { k.parent = p.parent || null; });
  rest.forEach((s, i) => { s.order = i; });
  delete d.pages[id]; delete d.collapsed[id];
  if (d.activePageId === id) d.activePageId = null;
  return p;
}
export function toggleCollapsed(d, id) { if (d.collapsed[id]) delete d.collapsed[id]; else if (d.pages[id]) d.collapsed[id] = true; return !!d.collapsed[id]; }

// ── Templates ──
export const JOURNAL_TEMPLATES = [
  { id: 'b_daily', name: 'Daily log', title: '', content: '## Today\n\n- [ ] First thing\n- [ ] Second thing\n- [ ] Third thing\n\n## Notes\n\n\n## Ideas to come back to\n\n' },
  { id: 'b_session', name: 'Writing session', title: 'Session: ', content: '## Goal for this session\n\n\n## Where I left off\n\n\n## Written\n\n- Words:\n- Scenes:\n\n## Next time\n\n- [ ] First step\n' },
  { id: 'b_char', name: 'Character sketch', title: 'Character: ', content: '## Who they are\n\n**Name:**  \n**Age:**  \n**Role:**  \n\n## Looks\n\n\n## Personality\n\n\n## Voice and habits\n\n\n## Secrets\n\n\n## Relationships\n\n\n## Sample lines\n\n> \n' },
  { id: 'b_world', name: 'World entry', title: 'Place or thing: ', content: '## What it is\n\n\n## What it looks and feels like\n\n\n## Who is connected to it\n\n\n## History\n\n\n## Rules and limits\n\n\n## Open questions\n\n- [ ] A question to answer\n' },
  { id: 'b_plot', name: 'Plot outline', title: 'Plot: ', content: '## Premise\n\n\n## Beginning\n\n\n## Middle\n\n\n## End\n\n\n## Scenes\n\n1. \n2. \n3. \n\n## Loose threads\n\n- [ ] A thread to tie up\n' },
  { id: 'b_bot', name: 'Bot idea', title: 'Bot: ', content: '## One-line pitch\n\n\n## Who the bot is\n\n\n## Who the user plays\n\n\n## Opening scene\n\n\n## First message draft\n\n\n## Lorebook entries to write\n\n- [ ] First entry\n- [ ] Second entry\n\n## Tags\n\n' },
];
export const templatesAll = d => [...JOURNAL_TEMPLATES.map(t => ({ ...t, builtin: true })), ...Object.values(d.templates).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(t => ({ ...t, builtin: false }))];
export function addTemplate(d, { name, title = '', content = '' }) {
  const id = tplId();
  d.templates[id] = { id, name: String(name || 'Template').trim().slice(0, 60) || 'Template', title: String(title).slice(0, 120), content: String(content), createdAt: new Date().toISOString() };
  return id;
}
export const removeTemplate = (d, id) => { if (d.templates[id]) { delete d.templates[id]; return true; } return false; };

// ── Links from a page to a Library item or another page: [Name](loreos://kind/id) ──
// Plain Markdown links, so they still read fine anywhere else.
export const MENTION_KINDS = ['lore', 'char', 'preset', 'prompt', 'regex', 'persona', 'image', 'page', 'notebook'];
export const mentionHref = (kind, id) => 'loreos://' + kind + '/' + encodeURIComponent(id);
export function parseMentionHref(href) {
  const m = String(href || '').match(/^loreos:\/\/([a-z]+)\/(.+)$/);
  if (!m || !MENTION_KINDS.includes(m[1])) return null;
  let id; try { id = decodeURIComponent(m[2]); } catch (e) { return null; }
  return id ? { kind: m[1], id } : null;
}
