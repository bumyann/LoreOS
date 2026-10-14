// ═══════════════════════════════════════════════════════
// JOURNAL — pages that nest inside pages, written in a TipTap editor that stores Markdown.
//
//   - the sidebar is a tree: open and close branches, add a subpage with the + on a row, search
//   - "/" in a page opens a menu of things to insert (headings, lists, to-dos, quote, code, divider, toggle,
//     today's date, a subpage); "@" links to anything in the Library, a gallery picture, or another page
//   - toggles are collapsible blocks; to-do lists are tickable
//   - new pages can start from a template (built in, or saved from one of your own pages)
//
// The data model is in journal_model.js. Pages are saved as Markdown (toggles as a little HTML inside it, links to
// Library items as ordinary [Name](loreos://kind/id) links).
// ═══════════════════════════════════════════════════════
import { openViewer } from './gallery_view.js';
import { listPictures } from './gallery.js';
import { allLibraryItems } from './meta.js';
import { libraryRows, openLibraryItem } from './library_view.js';
import { store } from './kv.js';
import { safeSet } from './storage.js';
import { registerTrashRestorer, trashPush } from './trash.js';
import { askConfirm, askInput, closeModal, esc, g, openModal, registerMarkup, toast } from './util.js';
import * as model from './journal_model.js';

const { normalizeJournal, nbId } = model;
export { nbId };

export let _nbEditor = null;  // active tiptap instance
export let _nbActiveId = null;
export let _nbAutoSaveTimer = null;
export let _nbDirty = false;   // typed since the last save (so just visiting a page doesn't bump its date)
let searchQuery = '';

const KEY = 'loreos_notebook';
export function nbGet() {
  try { return normalizeJournal(JSON.parse(store.get(KEY) || '{}')); }
  catch (e) { return normalizeJournal({}); }
}
export function nbSet(data) { return safeSet(KEY, JSON.stringify(normalizeJournal(data))); }

const SYM = { open: '▾︎', closed: '▸︎' };

// ═══════════════════════════════════════════════════════
// THE VIEW
// ═══════════════════════════════════════════════════════
export function renderNotebookView() {
  const el = document.getElementById('notebook-content');
  if (!el) return;

  // Save and drop any existing editor (this runs every time you come back to the journal)
  if (_nbEditor) {
    try { clearTimeout(_nbAutoSaveTimer); nbSaveActive(); } catch (e) { /* nothing to save */ }
    try { _nbEditor.destroy(); } catch (e) { /* already gone */ }
    _nbEditor = null;
  }
  closePop();

  const data = nbGet();
  const first = model.flattenTree(data)[0];
  _nbActiveId = data.activePageId || (first ? first.page.id : null);

  el.innerHTML = `
    <div class="nb-layout">
      <div class="nb-sidebar" id="nb-sidebar">
        <div class="nb-sidebar-head">
          <div class="nb-title">Journal</div>
          <button class="btn btn-ok btn-sm" id="nbNewBtn">+ New</button>
        </div>
        <div class="nb-search-row"><input class="finput nb-search" id="nbSearch" type="search" placeholder="Search pages..." aria-label="Search pages" value="${esc(searchQuery)}"></div>
        <div class="nb-page-list" id="nb-page-list" role="tree"></div>
      </div>
      <div class="nb-editor" id="nb-editor">
        <div class="nb-editor-inner" id="nb-editor-inner">
          <div class="empty-state" style="min-height:200px">
            <div>no page selected</div>
            <button class="btn btn-ok" id="nbNewBtnAlt">+ New Page</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('nbNewBtn').addEventListener('click', () => openNewPageDialog());
  const alt = document.getElementById('nbNewBtnAlt');
  if (alt) alt.addEventListener('click', () => openNewPageDialog());
  document.getElementById('nbSearch').addEventListener('input', e => { searchQuery = e.target.value; nbRenderPageList(); });

  nbRenderPageList();
  if (_nbActiveId && data.pages[_nbActiveId]) nbOpenPage(_nbActiveId);
}

export function nbRenderPageList() {
  const list = document.getElementById('nb-page-list');
  if (!list) return;
  const data = nbGet();
  const rows = model.flattenTree(data, searchQuery);

  list.innerHTML = rows.length ? rows.map(({ page: p, depth, kids, open }) => `
    <div class="nb-page-item ${p.id === _nbActiveId ? 'active' : ''}" data-nb-id="${esc(p.id)}" role="treeitem" aria-level="${depth + 1}"${kids ? ` aria-expanded="${open}"` : ''} style="--d:${depth}">
      ${kids ? `<button class="nb-caret" data-nb-toggle="${esc(p.id)}" aria-label="${open ? 'Close' : 'Open'} ${esc(p.title || 'Untitled')}">${open ? SYM.open : SYM.closed}</button>` : '<span class="nb-caret nb-caret-none"></span>'}
      <span class="nb-page-title">${esc(p.title || 'Untitled')}</span>
      <button class="nb-add" data-nb-sub="${esc(p.id)}" title="Add a subpage" aria-label="Add a subpage to ${esc(p.title || 'Untitled')}">+</button>
      <span class="nb-page-date">${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}</span>
    </div>
  `).join('') : `<div class="nb-empty">${searchQuery ? 'no pages match' : 'no pages yet'}</div>`;

  list.querySelectorAll('.nb-page-item').forEach(item => {
    item.addEventListener('click', e => {
      const tg = e.target.closest('[data-nb-toggle]'), sub = e.target.closest('[data-nb-sub]');
      if (tg) { const d = nbGet(); model.toggleCollapsed(d, tg.dataset.nbToggle); nbSet(d); nbRenderPageList(); return; }
      if (sub) { newPageAndOpen({ parent: sub.dataset.nbSub }); return; }
      nbSaveActive();
      nbOpenPage(item.dataset.nbId);
    });
  });
}

// ═══════════════════════════════════════════════════════
// A PAGE
// ═══════════════════════════════════════════════════════
export function nbOpenPage(id) {
  const data = nbGet();
  const page = data.pages[id];
  if (!page) return;

  clearTimeout(_nbAutoSaveTimer);
  if (_nbEditor) { try { _nbEditor.destroy(); } catch (e) { /* already gone */ } _nbEditor = null; }
  closePop();

  _nbActiveId = id;
  _nbDirty = false;
  data.activePageId = id;
  // opening a page opens the branches above it, so it can be seen in the tree
  model.breadcrumb(data, id).slice(0, -1).forEach(a => { delete data.collapsed[a.id]; });
  nbSet(data);
  nbRenderPageList();

  const inner = document.getElementById('nb-editor-inner');
  if (!inner) return;
  const crumbs = model.breadcrumb(data, id).slice(0, -1);

  inner.innerHTML = `
    ${crumbs.length ? `<nav class="nb-crumbs" aria-label="Where this page is">${crumbs.map(c => `<a href="#" data-nb-crumb="${esc(c.id)}">${esc(c.title || 'Untitled')}</a>`).join('<span aria-hidden="true">›</span>')}</nav>` : ''}
    <div class="nb-page-header">
      <input class="nb-page-title-input" id="nbTitleInput" value="${esc(page.title || '')}" placeholder="Page title...">
      <div class="nb-page-acts">
        <button class="btn btn-s btn-sm" id="nbSubBtn" title="Add a page inside this one">+ Subpage</button>
        <button class="btn btn-s btn-sm" id="nbMoveBtn" title="Move this page">Move</button>
        <button class="btn btn-s btn-sm" id="nbTplBtn" title="Keep this page as a template for new pages">Save as template</button>
        <button class="btn btn-err btn-sm" id="nbDeleteBtn">✕ Delete</button>
      </div>
    </div>
    <div class="nb-content-wrap">
      <div id="nb-tiptap-mount" class="nb-tiptap-mount"></div>
    </div>
    <div class="nb-footer">
      <span class="nb-save-status" id="nbSaveStatus">saved</span>
      <button class="btn btn-p btn-sm" id="nbSaveBtn">Save</button>
    </div>
  `;
  inner.querySelectorAll('[data-nb-crumb]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); nbSaveActive(); nbOpenPage(a.dataset.nbCrumb); }));

  const titleIn = document.getElementById('nbTitleInput');
  const saveStatus = document.getElementById('nbSaveStatus');

  function markUnsaved() {
    _nbDirty = true;
    saveStatus.textContent = 'unsaved';
    saveStatus.style.color = 'var(--warn)';
    clearTimeout(_nbAutoSaveTimer);
    _nbAutoSaveTimer = setTimeout(nbSaveActive, 2000);
  }

  titleIn.addEventListener('input', () => {
    markUnsaved();
    const item = document.querySelector(`.nb-page-item[data-nb-id="${id}"] .nb-page-title`);
    if (item) item.textContent = titleIn.value || 'Untitled';
  });

  const mount = document.getElementById('nb-tiptap-mount');
  _nbEditor = new TiptapEditor({
    element: mount,
    extensions: buildExtensions(),
    content: page.content || '',
    autofocus: 'end',
    onUpdate() { markUnsaved(); },
  });
  wireLinks(mount);

  document.getElementById('nbSaveBtn').addEventListener('click', () => {
    nbSaveActive();
    saveStatus.textContent = 'saved';
    saveStatus.style.color = 'var(--ok)';
  });
  document.getElementById('nbSubBtn').addEventListener('click', () => { nbSaveActive(); openNewPageDialog({ parent: id }); });
  document.getElementById('nbMoveBtn').addEventListener('click', () => { nbSaveActive(); openMoveDialog(id); });
  document.getElementById('nbTplBtn').addEventListener('click', saveAsTemplate);
  document.getElementById('nbDeleteBtn').addEventListener('click', () => deletePage(id));
}

async function deletePage(id) {
  const d0 = nbGet(), kids = model.childrenOf(d0, id).length;
  if (!await askConfirm('Delete this page?' + (kids ? ` Its ${kids} subpage${kids === 1 ? '' : 's'} will move up one level.` : '') + ' You can bring it back from Settings > Storage > Recently deleted.')) return;
  { const cur = nbGet().pages[id]; if (cur) trashPush('journal', cur.title || 'Untitled page', cur); }
  clearTimeout(_nbAutoSaveTimer); _nbDirty = false;
  if (_nbEditor) { try { _nbEditor.destroy(); } catch (e) { /* already gone */ } _nbEditor = null; }
  const d = nbGet();
  model.removePage(d, id);
  d.activePageId = null;
  nbSet(d);
  _nbActiveId = null;
  renderNotebookView();
}

async function saveAsTemplate() {
  if (!_nbActiveId) return;
  nbSaveActive();
  const d = nbGet(), p = d.pages[_nbActiveId]; if (!p) return;
  const name = await askInput('Name this template', (p.title || 'My template').slice(0, 60));
  if (name === null || !name.trim()) return;
  model.addTemplate(d, { name, title: p.title, content: _nbEditor ? _nbEditor.storage.markdown.getMarkdown() : p.content });
  if (nbSet(d)) toast('Saved. Find it when you make a new page.', 'ok');
}

// Drop the journal's pending autosave
export function cancelJournalAutosave() { clearTimeout(_nbAutoSaveTimer); }

export function nbSaveActive() {
  if (!_nbActiveId || !_nbDirty) return;
  const titleIn = document.getElementById('nbTitleInput');
  if (!titleIn) return;
  const data = nbGet();
  if (!data.pages[_nbActiveId]) return;
  data.pages[_nbActiveId].title = titleIn.value.trim() || 'Untitled';
  if (_nbEditor) data.pages[_nbActiveId].content = _nbEditor.storage.markdown.getMarkdown();
  data.pages[_nbActiveId].updatedAt = new Date().toISOString();
  const ok = nbSet(data);
  if (ok) _nbDirty = false;
  const st = document.getElementById('nbSaveStatus');
  if (!ok) {
    if (st) { st.textContent = 'NOT SAVED'; st.style.color = 'var(--err)'; }
    return false;
  }
  const item = document.querySelector(`.nb-page-item[data-nb-id="${_nbActiveId}"] .nb-page-date`);
  if (item) item.textContent = new Date().toLocaleDateString();
  if (st) { st.textContent = 'saved'; st.style.color = 'var(--ok)'; }
  return true;
}

// The journal autosaves 2s after you stop typing. Closing the tab mid-sentence used to lose whatever was inside that window.
window.addEventListener('beforeunload', () => { try { if (_nbActiveId) nbSaveActive(); } catch (e) { /* closing anyway */ } });

// ── Making pages ──
export function newPageAndOpen({ parent = null, template = null } = {}) {
  nbSaveActive();
  const data = nbGet();
  const id = model.newPage(data, { parent, title: template ? template.title : '', content: template ? template.content : '' });
  data.activePageId = id;
  nbSet(data);
  _nbActiveId = id;
  nbRenderPageList();
  nbOpenPage(id);
  setTimeout(() => document.getElementById('nbTitleInput')?.focus(), 80);
  return id;
}
export function nbNewPage() { return newPageAndOpen(); }

// ═══════════════════════════════════════════════════════
// DIALOGS: new page (with templates) and move
// ═══════════════════════════════════════════════════════
let newParent = null;
export function openNewPageDialog({ parent = null } = {}) {
  newParent = parent;
  paintNewDialog();
  openModal('nbNewModal');
}
function paintNewDialog() {
  const d = nbGet(), host = g('nbNewList'); if (!host) return;
  const par = newParent && d.pages[newParent] ? d.pages[newParent] : null;
  g('nbNewWhere').textContent = par ? 'Inside “' + (par.title || 'Untitled') + '”' : 'At the top level';
  host.innerHTML = `<button class="nb-tpl" data-tpl="" type="button"><b>Blank page</b><span>Start with nothing</span></button>` +
    model.templatesAll(d).map(t => `<div class="nb-tpl-row"><button class="nb-tpl" data-tpl="${esc(t.id)}" type="button"><b>${esc(t.name)}</b><span>${t.builtin ? 'Built in' : 'Yours'}</span></button>${t.builtin ? '' : `<button class="btn btn-err btn-sm nb-tpl-del" data-tpl-del="${esc(t.id)}" type="button" aria-label="Delete the template ${esc(t.name)}">✕</button>`}</div>`).join('');
  host.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => {
    const tpl = b.dataset.tpl ? model.templatesAll(nbGet()).find(t => t.id === b.dataset.tpl) : null;
    closeModal('nbNewModal');
    newPageAndOpen({ parent: newParent, template: tpl });
  });
  host.querySelectorAll('[data-tpl-del]').forEach(b => b.onclick = async () => {
    if (!await askConfirm('Delete this template? Pages made from it are not affected.')) return;
    const dd = nbGet(); model.removeTemplate(dd, b.dataset.tplDel); nbSet(dd); paintNewDialog();
  });
}

let moveId = null;
export function openMoveDialog(id) {
  moveId = id; paintMoveDialog(); openModal('nbMoveModal');
}
function paintMoveDialog() {
  const d = nbGet(), p = d.pages[moveId], host = g('nbMoveList'); if (!p || !host) return;
  const banned = new Set([moveId, ...model.descendants(d, moveId)]);
  const rows = [];
  const walk = (parent, depth) => model.childrenOf(d, parent).forEach(c => { if (banned.has(c.id)) return; rows.push({ c, depth }); walk(c.id, depth + 1); });
  walk(null, 0);
  g('nbMoveName').textContent = '“' + (p.title || 'Untitled') + '”';
  host.innerHTML = `<button class="nb-move-row${!p.parent ? ' here' : ''}" data-to="" type="button">Top level</button>` +
    rows.map(({ c, depth }) => `<button class="nb-move-row${p.parent === c.id ? ' here' : ''}" data-to="${esc(c.id)}" style="--d:${depth + 1}" type="button">${esc(c.title || 'Untitled')}</button>`).join('');
  host.querySelectorAll('[data-to]').forEach(b => b.onclick = () => {
    const dd = nbGet();
    if (model.movePage(dd, moveId, b.dataset.to || null)) { nbSet(dd); closeModal('nbMoveModal'); nbRenderPageList(); if (_nbActiveId === moveId) { nbOpenPage(moveId); } toast('Moved.', 'ok'); }
  });
  g('nbMoveUp').onclick = () => { const dd = nbGet(); if (model.nudge(dd, moveId, -1)) { nbSet(dd); nbRenderPageList(); } };
  g('nbMoveDown').onclick = () => { const dd = nbGet(); if (model.nudge(dd, moveId, 1)) { nbSet(dd); nbRenderPageList(); } };
}

// ═══════════════════════════════════════════════════════
// THE EDITOR: extensions, the "/" menu and "@" links
// ═══════════════════════════════════════════════════════
const KIND_LABEL = { lore: 'Lorebook', char: 'Character', preset: 'Preset', prompt: 'Prompt pack', regex: 'Regex', persona: 'Persona', image: 'Picture', page: 'Page' };

// Things "/" can insert. `run` gets the editor and the range holding "/something" and replaces it.
export function slashItems() {
  const ch = (run) => (editor, range) => run(editor.chain().focus().deleteRange(range)).run();
  return [
    { label: 'Heading 1', hint: 'Big heading', keys: 'h1 title heading', run: ch(c => c.toggleHeading({ level: 1 })) },
    { label: 'Heading 2', hint: 'Medium heading', keys: 'h2 heading', run: ch(c => c.toggleHeading({ level: 2 })) },
    { label: 'Heading 3', hint: 'Small heading', keys: 'h3 heading', run: ch(c => c.toggleHeading({ level: 3 })) },
    { label: 'Bulleted list', hint: 'A simple list', keys: 'bullet list ul', run: ch(c => c.toggleBulletList()) },
    { label: 'Numbered list', hint: 'A list in order', keys: 'number ordered list ol', run: ch(c => c.toggleOrderedList()) },
    { label: 'To-do list', hint: 'Tick things off', keys: 'todo task checkbox check', run: ch(c => c.toggleTaskList()) },
    { label: 'Toggle', hint: 'Hide and show a part', keys: 'toggle collapse details fold', run: ch(c => c.setDetails()) },
    { label: 'Quote', hint: 'Set a passage apart', keys: 'quote blockquote', run: ch(c => c.toggleBlockquote()) },
    { label: 'Code block', hint: 'Monospaced text', keys: 'code pre', run: ch(c => c.toggleCodeBlock()) },
    { label: 'Divider', hint: 'A line across', keys: 'divider line rule hr', run: ch(c => c.setHorizontalRule()) },
    { label: 'Today’s date', hint: new Date().toLocaleDateString(), keys: 'date today now', run: (editor, range) => editor.chain().focus().deleteRange(range).insertContent(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + ' ').run() },
    { label: 'Subpage', hint: 'A new page inside this one', keys: 'subpage page new child', run: (editor, range) => {
      nbSaveActive();
      const data = nbGet(); const sid = model.newPage(data, { parent: _nbActiveId, title: 'Untitled' }); nbSet(data);
      editor.chain().focus().deleteRange(range).insertContent([{ type: 'text', text: 'Untitled', marks: [{ type: 'link', attrs: { href: model.mentionHref('page', sid) } }] }, { type: 'text', text: ' ' }]).run();
      nbSaveActive(); nbRenderPageList();
    } },
    { label: 'Link to something…', hint: 'A Library item, picture or page', keys: 'link mention at library character lorebook preset page picture', run: (editor, range) => editor.chain().focus().deleteRange(range).insertContent('@').run() },
  ];
}
export function filterSlash(items, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return items;
  return items.filter(i => i.label.toLowerCase().includes(q) || i.keys.includes(q)).sort((a, b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)));
}

// Everything a "@" can point at
export function mentionCandidates(query, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  const out = [];
  try { allLibraryItems().forEach(i => out.push({ kind: i.kind, id: i.id, name: i.name || 'Untitled' })); } catch (e) { /* library not ready */ }
  try { listPictures().forEach(p => out.push({ kind: 'image', id: p.id, name: p.name || 'Picture' })); } catch (e) { /* no gallery */ }
  const d = nbGet();
  Object.values(d.pages).forEach(p => { if (p.id !== _nbActiveId) out.push({ kind: 'page', id: p.id, name: p.title || 'Untitled' }); });
  return out.filter(c => !q || c.name.toLowerCase().includes(q)).sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)).slice(0, limit);
}

// A small floating menu that follows the caret
let pop = null;
function closePop() { if (pop) { pop.remove(); pop = null; } }
function popRender(props, rows, onPick) {
  if (!pop) { pop = document.createElement('div'); pop.className = 'nb-pop'; pop.setAttribute('role', 'listbox'); document.body.append(pop); }
  pop._sel = Math.min(pop._sel || 0, Math.max(0, rows.length - 1));
  pop._rows = rows; pop._pick = onPick;
  pop.innerHTML = rows.length ? rows.map((r, i) => `<div class="nb-pop-item${i === pop._sel ? ' on' : ''}" role="option" data-i="${i}"><span>${esc(r.label)}</span><small>${esc(r.hint || '')}</small></div>`).join('') : '<div class="nb-pop-none">nothing matches</div>';
  pop.querySelectorAll('.nb-pop-item').forEach(el => el.addEventListener('pointerdown', e => { e.preventDefault(); onPick(rows[Number(el.dataset.i)]); }));
  const r = props.clientRect && props.clientRect();
  if (r) { pop.style.left = Math.max(8, Math.min(window.innerWidth - 290, r.left)) + 'px'; const below = r.bottom + 6, room = window.innerHeight - below; pop.style.top = (room > 220 ? below : Math.max(8, r.top - pop.offsetHeight - 6)) + 'px'; }
}
function popKeys(event) {
  if (!pop || !pop._rows) return false;
  const n = pop._rows.length;
  if (event.key === 'ArrowDown') { pop._sel = (pop._sel + 1) % Math.max(1, n); highlight(); return true; }
  if (event.key === 'ArrowUp') { pop._sel = (pop._sel - 1 + Math.max(1, n)) % Math.max(1, n); highlight(); return true; }
  if (event.key === 'Enter' || event.key === 'Tab') { if (n) pop._pick(pop._rows[pop._sel]); return true; }
  if (event.key === 'Escape') { closePop(); return true; }
  return false;
}
function highlight() { pop.querySelectorAll('.nb-pop-item').forEach((el, i) => { el.classList.toggle('on', i === pop._sel); if (i === pop._sel) el.scrollIntoView({ block: 'nearest' }); }); }

function suggestion(editor, char, key, getRows, pick, hintLabel) {
  const X = TiptapExt;
  return X.Suggestion({
    editor, char, pluginKey: new X.PluginKey(key), allowSpaces: false,
    items: ({ query }) => getRows(query),
    command: ({ editor: ed, range, props }) => pick(ed, range, props),
    render: () => {
      let latest = null;
      const draw = props => { latest = props; popRender(props, props.items, row => { props.command(row); closePop(); }); };
      return { onStart: draw, onUpdate: draw, onKeyDown: ({ event }) => popKeys(event), onExit: () => { latest = null; closePop(); } };
    },
  });
}

function buildExtensions() {
  const X = TiptapExt;
  const Slash = X.Extension.create({
    name: 'nbSlash',
    addProseMirrorPlugins() {
      return [suggestion(this.editor, '/', 'nbSlash', q => filterSlash(slashItems(), q), (ed, range, row) => row.run(ed, range))];
    },
  });
  const Mention = X.Extension.create({
    name: 'nbMention',
    addProseMirrorPlugins() {
      return [suggestion(this.editor, '@', 'nbMention', q => mentionCandidates(q).map(c => ({ ...c, label: c.name, hint: KIND_LABEL[c.kind] || c.kind })), (ed, range, c) => {
        ed.chain().focus().insertContentAt(range, [{ type: 'text', text: c.name, marks: [{ type: 'link', attrs: { href: model.mentionHref(c.kind, c.id) } }] }, { type: 'text', text: ' ' }]).run();
      })];
    },
  });
  return [
    TiptapStarterKit.configure({ link: { openOnClick: false, autolink: true, protocols: ['loreos'], HTMLAttributes: { rel: 'noopener noreferrer' } } }),
    X.Placeholder.configure({ placeholder: 'Type / for things to add, @ to link to anything' }),
    X.TaskList, X.TaskItem.configure({ nested: true }),
    X.Details.configure({ persist: true }), X.DetailsSummary, X.DetailsContent,
    Slash, Mention,
    TiptapMarkdown.configure({ html: true, transformPastedText: true, transformCopiedText: false }),
  ];
}

// Clicking a link to a Library item or page opens it; other links open with Ctrl or Cmd held
function wireLinks(mount) {
  mount.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a'); if (!a) return;
    const href = a.getAttribute('href') || '';
    const m = model.parseMentionHref(href);
    if (m) { e.preventDefault(); openMention(m); }
    else if (/^https?:\/\//i.test(href) && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(href, '_blank', 'noopener,noreferrer'); }
  });
}
export function openMention({ kind, id }) {
  if (kind === 'page') { if (!nbGet().pages[id]) { toast('That page no longer exists.', 'warn'); return; } nbSaveActive(); nbOpenPage(id); return; }
  if (kind === 'image') { try { openViewer(id); } catch (e) { toast('That picture is gone.', 'warn'); } return; }
  const row = libraryRows().rows.find(r => r.kind === kind && r.id === id);
  if (!row) { toast('That item is no longer in the Library.', 'warn'); return; }
  nbSaveActive();
  openLibraryItem(row);
}

registerTrashRestorer('journal', page => {
  const d = nbGet();
  const id = page.id && !d.pages[page.id] ? page.id : nbId();
  d.pages[id] = { ...page, id, parent: page.parent && d.pages[page.parent] ? page.parent : null };
  nbSet(d);
  if (document.getElementById('nb-page-list')) nbRenderPageList();
});

registerMarkup(194, `<div id="nbNewModal" class="modal">
  <div class="modal-box" style="max-width:480px">
    <div class="modal-head"><h2>New page</h2><button class="modal-x" data-close="nbNewModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.6rem">
      <div class="rx-none" id="nbNewWhere"></div>
      <div class="nb-tpl-list" id="nbNewList"></div>
    </div>
  </div>
</div>
<div id="nbMoveModal" class="modal">
  <div class="modal-box" style="max-width:440px">
    <div class="modal-head"><h2>Move page</h2><button class="modal-x" data-close="nbMoveModal">×</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:.6rem">
      <div class="rx-none">Move <b id="nbMoveName"></b> to:</div>
      <div class="nb-move-list" id="nbMoveList"></div>
      <div class="pr-row"><button class="btn btn-s btn-sm" id="nbMoveUp" type="button">↑ Earlier in its list</button><button class="btn btn-s btn-sm" id="nbMoveDown" type="button">↓ Later in its list</button></div>
    </div>
  </div>
</div>`);
