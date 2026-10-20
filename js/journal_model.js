// ═══════════════════════════════════════════════════════
// JOURNAL MODEL — the pure part: pages that nest inside pages, templates, and links to Library items.
// No DOM here, so it can be tested on its own.
//
//   loreos_notebook = { pages: { [id]: { id, title, content, createdAt, updatedAt, parent, order } },
//                       activePageId, collapsed: { [id]: true }, templates: { [id]: { id, name, title, content, createdAt } } }
//
// `content` is Markdown. Older data (no parent/order/collapsed/templates) loads fine: every page is top level and
// keeps the newest-first order it always had. Older versions of LoreOS ignore the new fields and show a flat list.
// ═══════════════════════════════════════════════════════
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const MAX_DEPTH = 40;

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
  const collapsed = {};
  Object.keys(isObj(src.collapsed) ? src.collapsed : {}).forEach(id => { if (pages[id] && src.collapsed[id]) collapsed[id] = true; });
  const templates = {};
  Object.entries(isObj(src.templates) ? src.templates : {}).forEach(([id, t]) => {
    if (!isObj(t)) return;
    templates[id] = { id, name: String(t.name || 'Template').slice(0, 60), title: String(t.title || '').slice(0, 120), content: typeof t.content === 'string' ? t.content : '', createdAt: typeof t.createdAt === 'string' ? t.createdAt : '' };
  });
  return { ...src, pages, activePageId: typeof src.activePageId === 'string' && pages[src.activePageId] ? src.activePageId : null, collapsed, templates };
}

// ── The tree ──
const byOrder = (a, b) => (a.order - b.order) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id);
export const childrenOf = (d, parent = null) => Object.values(d.pages).filter(p => (p.parent || null) === (parent || null)).sort(byOrder);
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
export function flattenTree(d, query = '') {
  const q = String(query || '').trim().toLowerCase();
  const show = new Set();
  if (q) Object.values(d.pages).forEach(p => {
    if ((p.title || '').toLowerCase().includes(q) || (p.content || '').toLowerCase().includes(q)) breadcrumb(d, p.id).forEach(a => show.add(a.id));
  });
  const out = [];
  const walk = (parent, depth) => childrenOf(d, parent).forEach(p => {
    if (q && !show.has(p.id)) return;
    const kids = childrenOf(d, p.id).length, open = q ? true : !d.collapsed[p.id];
    out.push({ page: p, depth, kids, open });
    if (kids && open) walk(p.id, depth + 1);
  });
  walk(null, 0);
  return out;
}

// ── Changing it (these mutate the data they are given and return what is useful) ──
export function newPage(d, { parent = null, title = '', content = '' } = {}) {
  const id = nbId(), now = new Date().toISOString();
  const par = parent && d.pages[parent] ? parent : null;
  const sibs = childrenOf(d, par);
  // top-level pages go to the top (newest first, as before); subpages go to the end of their parent
  const order = par ? (sibs.length ? sibs[sibs.length - 1].order + 1 : 0) : (sibs.length ? sibs[0].order - 1 : 0);
  d.pages[id] = { id, title, content, createdAt: now, updatedAt: now, parent: par, order };
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
  const sibs = childrenOf(d, parent).filter(p => p.id !== id);
  const at = beforeId ? sibs.findIndex(p => p.id === beforeId) : -1;
  sibs.splice(at < 0 ? sibs.length : at, 0, d.pages[id]);
  d.pages[id].parent = parent || null;
  sibs.forEach((p, i) => { p.order = i; });
  if (parent) delete d.collapsed[parent];
  return true;
}
export function nudge(d, id, dir) {
  const p = d.pages[id]; if (!p) return false;
  const sibs = childrenOf(d, p.parent), i = sibs.findIndex(s => s.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= sibs.length) return false;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  sibs.forEach((s, k) => { s.order = k; });
  return true;
}
// Deleting a page keeps what is inside it: its subpages move up one level
export function removePage(d, id) {
  const p = d.pages[id]; if (!p) return null;
  const kids = childrenOf(d, id), at = childrenOf(d, p.parent);
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
export const MENTION_KINDS = ['lore', 'char', 'preset', 'prompt', 'regex', 'persona', 'image', 'page'];
export const mentionHref = (kind, id) => 'loreos://' + kind + '/' + encodeURIComponent(id);
export function parseMentionHref(href) {
  const m = String(href || '').match(/^loreos:\/\/([a-z]+)\/(.+)$/);
  if (!m || !MENTION_KINDS.includes(m[1])) return null;
  let id; try { id = decodeURIComponent(m[2]); } catch (e) { return null; }
  return id ? { kind: m[1], id } : null;
}
