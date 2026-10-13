// ═══════════════════════════════════════════════════════
// ROUTER.JS — SPA view router for LoreOS v1.0.0
// Views: home | library | notebook | editor | laboratory
// ═══════════════════════════════════════════════════════

import { createChar, openChar } from './character.js';
import { libLoad } from './library.js';
import { renderLibraryView } from './library_view.js';
import { homeGet, renderHomeDashboard } from './home.js';
import { allLibraryItems } from './meta.js';
import { createPersona, openPersona } from './persona.js';
import { createEntry } from './lorebook.js';
import { updateMobViewBtns } from './mobile.js';
import { createPreset, openPreset } from './preset.js';
import { createPrompt, openPrompt } from './prompt.js';
import { createRegex, openRegex } from './regex.js';
import { openSettings } from './settings.js';
import { state } from './state.js';
import { libGet, safeSet } from './storage.js';
import { registerTrashRestorer, trashPush } from './trash.js';
import { askConfirm, esc } from './util.js';
import { switchMode } from './workshop.js';
import { store } from './kv.js';

export let currentView = null;

// HTML escape helper used throughout router/notebook
export function routerEsc(s) { return esc(s); }

export const VIEWS = ['home', 'library', 'notebook', 'editor', 'laboratory'];

export function navigateTo(viewId) {
  if (!VIEWS.includes(viewId)) return;
  // Leaving the journal: bank anything still inside the 2s autosave window
  if (currentView === 'notebook' && viewId !== 'notebook') {
    try { clearTimeout(_nbAutoSaveTimer); nbSaveActive(); } catch (e) {}
  }
  currentView = viewId;

  // Update nav rail active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewId);
  });

  // Show/hide view panels
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('view-active', v === viewId);
  });

  // Show/hide editor-only mode tabs
  const modeTabs = document.getElementById('modeTabs');
  if (modeTabs) modeTabs.style.display = (viewId === 'editor') ? 'flex' : 'none';

  // Mobile top bar: show on library, notebook, editor
  // Home has its own hero title; editor shows LoreOS left + ? right
  const mobTopbar = document.getElementById('mob-topbar');
  if (mobTopbar) {
    const showTopbar = viewId === 'library' || viewId === 'notebook' || viewId === 'editor' || viewId === 'laboratory';
    mobTopbar.classList.toggle('visible', showTopbar);
    // In editor: show the ? mirror button; hide it in other views
    const topbarHelp = document.getElementById('mob-topbar-help');
    if (topbarHelp) topbarHelp.style.display = (viewId === 'editor') ? '' : 'none';
  }

  // Render view content if needed
  if (viewId === 'home') renderHomeView();
  if (viewId === 'library') renderLibraryView();
  if (viewId === 'notebook') renderNotebookView();
  if (viewId === 'laboratory') renderLaboratoryView();

  // Persist last view
  try { localStorage.setItem('loreos_lastView', viewId); } catch(e) {}

  // Sync mobile nav state
  updateMobViewBtns(viewId);
}

export function getLastView() {
  try {
    const v = localStorage.getItem('loreos_lastView') || 'home';
    // never restore directly into editor on cold load — always start at home
    return (v === 'editor') ? 'home' : v;
  } catch(e) { return 'home'; }
}

// ─── HOME VIEW ───────────────────────────────────────
export function renderHomeView() {
  const el = document.getElementById('home-content');
  if (!el) return;

  // A returning user has something in a library, or on the inspiration board
  const isReturning = allLibraryItems().length > 0 || homeGet().board.length > 0;

  if (isReturning) {
    renderHomeDashboard(el);
  } else {
    renderGetStarted(el);
  }
}

export function renderGetStarted(el) {
  el.innerHTML = `
    <div class="home-hero">
      <div class="home-hero-title">LoreOS</div>
      <div class="home-hero-tagline">// lorebooks. characters. presets. prompts. all in one place.</div>
      <div class="home-hero-actions">
        <button class="btn btn-ok home-cta" data-new="lore">❖︎ New Lorebook Entry</button>
        <button class="btn btn-p home-cta" data-new="char">+ New Character</button>
        <button class="btn btn-s home-cta" data-new="preset">⚙︎ New Preset</button>
        <button class="btn btn-s home-cta" data-new="prompt">✎︎ New Prompt Pack</button>
        <button class="btn btn-s home-cta" data-new="regex">⌕ New Regex Set</button>
      </div>
      <div class="home-cards">
        <div class="home-card">
          <div class="home-card-icon">❖</div>
          <div class="home-card-title">Lorebook Editor</div>
          <div class="home-card-desc">Build and edit ST-format lorebooks with keyword triggers, merge tools, and batch export.</div>
        </div>
        <div class="home-card">
          <div class="home-card-icon">☺︎</div>
          <div class="home-card-title">Character Cards</div>
          <div class="home-card-desc">Create V3 character cards, embed lorebooks, convert pronouns to macros, export as PNG.</div>
        </div>
        <div class="home-card">
          <div class="home-card-icon">⚙︎</div>
          <div class="home-card-title">Preset Editor</div>
          <div class="home-card-desc">Edit SillyTavern chat completion presets with full prompt list support and drag-to-reorder.</div>
        </div>
        <div class="home-card">
          <div class="home-card-icon">⚙︎</div>
          <div class="home-card-title">Template Library</div>
          <div class="home-card-desc">22+ built-in templates for characters, lorebooks, and NPCs. Save your own for reuse.</div>
        </div>
      </div>
      <div class="home-footer-note">// built for SillyTavern · JanitorAI · SaucepanAI &nbsp;·&nbsp; all data stays in your browser &nbsp;·&nbsp; <a href="https://loreos.net/legal.html" target="_blank" style="color:var(--txm);text-decoration:none;border-bottom:1px solid var(--bd)">privacy & terms</a></div>
    </div>
  `;
}

// ─── LABORATORY VIEW ─────────────────────────────────
export function renderLaboratoryView() {
  const el = document.getElementById('laboratory-content');
  if (!el) return;
  el.innerHTML = `
    <div class="lab-stub">
      <div class="lab-stub-icon">⚗</div>
      <div class="lab-stub-title">Laboratory</div>
      <div class="lab-stub-desc">Tools for understanding and debugging your AI creations.<br>Token inspector, lorebook trigger viewer, prompt conflict detector — coming soon.</div>
    </div>
  `;
}

// ─── SETTINGS VIEW ───────────────────────────────────

// ─── SIDEBAR NAV TOGGLE ──────────────────────────────
export function initNavSidebar() {
  const nav = document.getElementById('nav-sidebar');
  const toggle = document.getElementById('nav-toggle');
  const collapsed = (() => { try { return localStorage.getItem('loreos_navCollapsed') === '1'; } catch(e) { return false; } })();
  if (collapsed) nav.classList.add('collapsed');

  toggle.addEventListener('click', () => {
    nav.classList.toggle('collapsed');
    try { localStorage.setItem('loreos_navCollapsed', nav.classList.contains('collapsed') ? '1' : '0'); } catch(e) {}
  });

  // Wire nav items
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view === 'settings') {
        // openSettings() is what fills the panel in — colour pickers,
        // saved themes, font fields, storage meter. Opening the modal
        // directly (as this used to) left every field blank, and then
        // hitting Apply wrote those blanks back over your saved theme.
        openSettings();
      } else {
        navigateTo(view);
      }
    });
  });
}

// ─── INIT ────────────────────────────────────────────
export function initRouter() {
  initNavSidebar();
  // Home screen buttons ("new ...", "library") are built as HTML strings, so one
  // delegated listener handles them instead of inline onclick attributes
  const homeEl = document.getElementById('home-content');
  if (homeEl) homeEl.addEventListener('click', e => {
    const mk = e.target.closest('[data-new]');
    if (mk) {
      const kind = mk.dataset.new;
      if (kind === 'persona') { openPersona(createPersona()); return; } // personas open in their own dialog
      navigateTo('editor');
      setTimeout(() => {
        switchMode(kind);
        if (kind === 'lore') createEntry(); else if (kind === 'char') createChar(); else if (kind === 'preset') createPreset(); else if (kind === 'prompt') createPrompt(); else if (kind === 'regex') createRegex();
      }, 80);
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) navigateTo(go.dataset.go);
  });
  const last = getLastView();
  navigateTo(last);
}

// ═══════════════════════════════════════════════════════
// NOTEBOOK — tiptap-powered WYSIWYG markdown editor
// Storage key: loreos_notebook (object: { pages: {id: page}, activePageId })
// Page: { id, title, content, createdAt, updatedAt }
// content stored as markdown string via tiptap-markdown
// ═══════════════════════════════════════════════════════

export let _nbEditor = null;  // active tiptap instance
export let _nbActiveId = null;
export let _nbAutoSaveTimer = null;
export let _nbDirty = false;   // typed since the last save (so just visiting a page doesn't bump its date)

export function nbGet() {
  try { return JSON.parse(store.get('loreos_notebook') || '{"pages":{},"activePageId":null}'); }
  catch(e) { return { pages: {}, activePageId: null }; }
}
export function nbSet(data) {
  return safeSet('loreos_notebook', JSON.stringify(data));
}
export function nbId() { return 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

export function renderNotebookView() {
  const el = document.getElementById('notebook-content');
  if (!el) return;

  // Destroy any existing tiptap instance (saving it first: this runs every time
  // you come back to the journal, and used to throw away unsaved typing)
  if (_nbEditor) {
    try { clearTimeout(_nbAutoSaveTimer); nbSaveActive(); } catch(e) {}
    try { _nbEditor.destroy(); } catch(e) {}
    _nbEditor = null;
  }

  const data = nbGet();
  const pages = Object.values(data.pages).sort((a,b) => (b.updatedAt||"").localeCompare(a.updatedAt||""));
  _nbActiveId = data.activePageId || (pages[0]?.id ?? null);

  el.innerHTML = `
    <div class="nb-layout">
      <div class="nb-sidebar" id="nb-sidebar">
        <div class="nb-sidebar-head">
          <div class="nb-title">Journal</div>
          <button class="btn btn-ok btn-sm" id="nbNewBtn">+ New</button>
        </div>
        <div class="nb-page-list" id="nb-page-list"></div>
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

  document.getElementById('nbNewBtn').addEventListener('click', nbNewPage);
  const alt = document.getElementById('nbNewBtnAlt');
  if (alt) alt.addEventListener('click', nbNewPage);

  nbRenderPageList();
  if (_nbActiveId && data.pages[_nbActiveId]) nbOpenPage(_nbActiveId);
}

export function nbRenderPageList() {
  const list = document.getElementById('nb-page-list');
  if (!list) return;
  const data = nbGet();
  const pages = Object.values(data.pages).sort((a,b) => (b.updatedAt||"").localeCompare(a.updatedAt||""));

  list.innerHTML = pages.length ? pages.map(p => `
    <div class="nb-page-item ${p.id === _nbActiveId ? 'active' : ''}" data-nb-id="${routerEsc(p.id)}">
      <span class="nb-page-title">${routerEsc(p.title || 'Untitled')}</span>
      <span class="nb-page-date">${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}</span>
    </div>
  `).join('') : `<div class="nb-empty">no pages yet</div>`;

  list.querySelectorAll('.nb-page-item').forEach(item => {
    item.addEventListener('click', () => {
      nbSaveActive();
      nbOpenPage(item.dataset.nbId);
    });
  });
}

export function nbOpenPage(id) {
  const data = nbGet();
  const page = data.pages[id];
  if (!page) return;

  // Destroy existing tiptap instance before re-rendering
  clearTimeout(_nbAutoSaveTimer);
  if (_nbEditor) { try { _nbEditor.destroy(); } catch(e) {} _nbEditor = null; }

  _nbActiveId = id;
  _nbDirty = false;
  data.activePageId = id;
  nbSet(data);

  document.querySelectorAll('.nb-page-item').forEach(el => {
    el.classList.toggle('active', el.dataset.nbId === id);
  });

  const inner = document.getElementById('nb-editor-inner');
  if (!inner) return;

  inner.innerHTML = `
    <div class="nb-page-header">
      <input class="nb-page-title-input" id="nbTitleInput" value="${routerEsc(page.title || '')}" placeholder="Page title...">
      <div class="nb-page-acts">
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

  // Init tiptap
  _nbEditor = new TiptapEditor({
    element: document.getElementById('nb-tiptap-mount'),
    extensions: [
      TiptapStarterKit,
      TiptapMarkdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: page.content || '',
    autofocus: 'end',
    onUpdate() {
      markUnsaved();
    },
  });

  document.getElementById('nbSaveBtn').addEventListener('click', () => {
    nbSaveActive();
    saveStatus.textContent = 'saved';
    saveStatus.style.color = 'var(--ok)';
  });

  document.getElementById('nbDeleteBtn').addEventListener('click', async () => {
    if (!await askConfirm('Delete this page? You can bring it back from Settings > Storage > Recently deleted.')) return;
    { const cur = nbGet().pages[id]; if (cur) trashPush('journal', cur.title || 'Untitled page', cur); }
    if (_nbEditor) { try { _nbEditor.destroy(); } catch(e) {} _nbEditor = null; }
    const d = nbGet();
    delete d.pages[id];
    d.activePageId = null;
    nbSet(d);
    _nbActiveId = null;
    renderNotebookView();
  });
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
  // Get markdown from tiptap if editor is active
  if (_nbEditor) {
    data.pages[_nbActiveId].content = _nbEditor.storage.markdown.getMarkdown();
  }
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

// The journal autosaves 2s after you stop typing. Closing the tab
// mid-sentence used to lose whatever was inside that window.
window.addEventListener('beforeunload', () => {
  try { if (_nbActiveId) nbSaveActive(); } catch(e) {}
});

export function nbNewPage() {
  nbSaveActive();
  const data = nbGet();
  const id = nbId();
  data.pages[id] = {
    id, title: '', content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.activePageId = id;
  nbSet(data);
  _nbActiveId = id;
  nbRenderPageList();
  nbOpenPage(id);
  setTimeout(() => document.getElementById('nbTitleInput')?.focus(), 80);
}

registerTrashRestorer('journal', page => {
  const d = nbGet();
  const id = page.id && !d.pages[page.id] ? page.id : nbId();
  d.pages[id] = { ...page, id };
  nbSet(d);
  if (document.getElementById('nb-page-list')) nbRenderPageList();
});
