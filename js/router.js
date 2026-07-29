// ═══════════════════════════════════════════════════════
// ROUTER.JS — SPA view router for LoreOS v1.0.0
// Views: home | library | editor | settings
// ═══════════════════════════════════════════════════════

let currentView = null;

// HTML escape helper used throughout router/notebook
function routerEsc(s) { const d = document.createElement('div'); d.textContent = String(s||''); return d.innerHTML; }

const VIEWS = ['home', 'library', 'notebook', 'editor', 'settings'];

function navigateTo(viewId) {
  if (!VIEWS.includes(viewId)) return;
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

  // Render view content if needed
  if (viewId === 'home') renderHomeView();
  if (viewId === 'library') renderLibraryView();
  if (viewId === 'notebook') renderNotebookView();
  if (viewId === 'settings') renderSettingsView();

  // Persist last view
  try { localStorage.setItem('loreos_lastView', viewId); } catch(e) {}
}

function getLastView() {
  try {
    const v = localStorage.getItem('loreos_lastView') || 'home';
    // never restore directly into editor on cold load — always start at home
    return v === 'editor' ? 'home' : v;
  } catch(e) { return 'home'; }
}

// ─── HOME VIEW ───────────────────────────────────────
function renderHomeView() {
  const el = document.getElementById('home-content');
  if (!el) return;

  // Check if returning user (has any data)
  const lb_data = (typeof libGet === 'function') ? libGet() : {};
  const hasLorebooks = Object.keys(lb_data).length > 0;
  const hasChars = Object.keys(typeof charLibrary !== 'undefined' ? charLibrary : {}).length > 0;
  const hasPresets = Object.keys(typeof presetLibrary !== 'undefined' ? presetLibrary : {}).length > 0;
  const isReturning = hasLorebooks || hasChars || hasPresets;

  if (isReturning) {
    renderDashboard(el);
  } else {
    renderGetStarted(el);
  }
}

function renderGetStarted(el) {
  el.innerHTML = `
    <div class="home-hero">
      <div class="home-hero-title">LoreOS<span class="home-hero-sub">Universal Editor</span></div>
      <div class="home-hero-tagline">// lorebooks. characters. presets. all in one place.</div>
      <div class="home-hero-actions">
        <button class="btn btn-ok home-cta" onclick="navigateTo('editor'); setTimeout(()=>{ switchMode('lore'); createEntry(); },80)">✦ New Lorebook Entry</button>
        <button class="btn btn-p home-cta" onclick="navigateTo('editor'); setTimeout(()=>{ switchMode('char'); createChar(); },80)">+ New Character</button>
        <button class="btn btn-s home-cta" onclick="navigateTo('editor'); setTimeout(()=>switchMode('preset'),80)">⚙ New Preset</button>
      </div>
      <div class="home-cards">
        <div class="home-card">
          <div class="home-card-icon">📖</div>
          <div class="home-card-title">Lorebook Editor</div>
          <div class="home-card-desc">Build and edit ST-format lorebooks with keyword triggers, merge tools, and batch export.</div>
        </div>
        <div class="home-card">
          <div class="home-card-icon">🎭</div>
          <div class="home-card-title">Character Cards</div>
          <div class="home-card-desc">Create V3 character cards, embed lorebooks, convert pronouns to macros, export as PNG.</div>
        </div>
        <div class="home-card">
          <div class="home-card-icon">⚙</div>
          <div class="home-card-title">Preset Editor</div>
          <div class="home-card-desc">Edit SillyTavern chat completion presets with full prompt list support and drag-to-reorder.</div>
        </div>
        <div class="home-card">
          <div class="home-card-icon">📋</div>
          <div class="home-card-title">Template Library</div>
          <div class="home-card-desc">22+ built-in templates for characters, lorebooks, and NPCs. Save your own for reuse.</div>
        </div>
      </div>
      <div class="home-footer-note">// built for SillyTavern · JanitorAI · SaucepanAI &nbsp;·&nbsp; all data stays in your browser</div>
    </div>
  `;
}

function renderDashboard(el) {
  // Gather recent items across all libraries
  const recentItems = [];

  // Lorebooks
  const lb = (typeof libGet === 'function') ? libGet() : {};
  Object.values(lb).forEach(s => {
    recentItems.push({ type: 'lorebook', icon: '📖', name: s.name || 'Untitled Lorebook', savedAt: s.savedAt, action: () => { navigateTo('editor'); setTimeout(() => { switchMode('lore'); libLoad(s.name); }, 80); } });
  });
  // Characters
  const ch = typeof charLibrary !== 'undefined' ? charLibrary : {};
  Object.values(ch).forEach(s => {
    recentItems.push({ type: 'character', icon: '🎭', name: s.name || 'Unnamed Character', savedAt: s.savedAt, action: () => { navigateTo('editor'); setTimeout(() => { switchMode('char'); openChar(s.id); }, 80); } });
  });
  // Presets
  const pr = typeof presetLibrary !== 'undefined' ? presetLibrary : {};
  Object.values(pr).forEach(s => {
    recentItems.push({ type: 'preset', icon: '⚙', name: s.name || 'Untitled Preset', savedAt: s.savedAt, action: () => { navigateTo('editor'); setTimeout(() => { switchMode('preset'); openPreset(s.id); }, 80); } });
  });

  // Sort by savedAt desc, take top 6
  recentItems.sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  const recent = recentItems.slice(0, 6);

  const recentHTML = recent.length ? recent.map((item, i) => `
    <div class="dash-recent-item" data-recent-idx="${i}">
      <span class="dash-recent-icon">${item.icon}</span>
      <span class="dash-recent-name">${routerEsc(item.name)}</span>
      <span class="dash-recent-type">${item.type}</span>
      <span class="dash-recent-date">${item.savedAt ? new Date(item.savedAt).toLocaleDateString() : ''}</span>
    </div>
  `).join('') : `<div class="dash-empty">// nothing yet</div>`;

  el.innerHTML = `
    <div class="dashboard">
      <div class="dash-section">
        <div class="dash-section-title">// Quick Actions</div>
        <div class="dash-actions">
          <button class="btn btn-ok dash-act" onclick="navigateTo('editor'); setTimeout(()=>{ switchMode('lore'); createEntry(); },80)">✦ New Entry</button>
          <button class="btn btn-p dash-act" onclick="navigateTo('editor'); setTimeout(()=>{ switchMode('char'); createChar(); },80)">+ New Character</button>
          <button class="btn btn-s dash-act" onclick="navigateTo('editor'); setTimeout(()=>{ switchMode('preset'); createPreset(); },80)">⚙ New Preset</button>
          <button class="btn btn-s dash-act" onclick="navigateTo('library')">📚 Library</button>
        </div>
      </div>
      <div class="dash-section">
        <div class="dash-section-title">// Recent</div>
        <div class="dash-recent" id="dash-recent-list">${recentHTML}</div>
      </div>
      <div class="dash-overview">
        <div class="dash-stat"><span class="dash-stat-num">${Object.keys((typeof libGet==='function')?libGet():{}).length}</span><span class="dash-stat-lbl">lorebooks</span></div>
        <div class="dash-stat"><span class="dash-stat-num">${Object.keys(ch).length}</span><span class="dash-stat-lbl">characters</span></div>
        <div class="dash-stat"><span class="dash-stat-num">${Object.keys(pr).length}</span><span class="dash-stat-lbl">presets</span></div>
      </div>
    </div>
  `;

  // Wire recent item clicks after render
  recent.forEach((item, i) => {
    const el2 = el.querySelector(`[data-recent-idx="${i}"]`);
    if (el2) el2.addEventListener('click', item.action);
  });
}

// ─── LIBRARY VIEW ────────────────────────────────────
function renderLibraryView() {
  const el = document.getElementById('library-content');
  if (!el) return;

  const lb = (typeof libGet === 'function') ? libGet() : {};
  const ch = typeof charLibrary !== 'undefined' ? charLibrary : {};
  const pr = typeof presetLibrary !== 'undefined' ? presetLibrary : {};

  const allItems = [];
  Object.values(lb).forEach(s => allItems.push({ type: 'lorebook', icon: '📖', typeLabel: 'Lorebook', name: s.name || 'Untitled', savedAt: s.savedAt, id: s.id, mode: 'lore', openFn: () => libLoad(s.name) }));
  Object.values(ch).forEach(s => allItems.push({ type: 'character', icon: '🎭', typeLabel: 'Character', name: s.name || 'Unnamed', savedAt: s.savedAt, id: s.id, mode: 'char', openFn: () => openChar(s.id) }));
  Object.values(pr).forEach(s => allItems.push({ type: 'preset', icon: '⚙', typeLabel: 'Preset', name: s.name || 'Untitled', savedAt: s.savedAt, id: s.id, mode: 'preset', openFn: () => openPreset(s.id) }));
  allItems.sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));

  const filterState = el._filterState || 'all';

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'lorebook', label: '📖 Lorebooks' },
    { key: 'character', label: '🎭 Characters' },
    { key: 'preset', label: '⚙ Presets' },
  ];

  const filtered = filterState === 'all' ? allItems : allItems.filter(i => i.type === filterState);

  el.innerHTML = `
    <div class="library-wrap">
      <div class="lib-view-header">
        <div class="lib-view-title">// Library</div>
        <div class="lib-filter-tabs">
          ${tabs.map(t => `<button class="lib-filter-tab ${filterState === t.key ? 'active' : ''}" data-filter="${t.key}">${t.label}</button>`).join('')}
        </div>
      </div>
      <div class="lib-grid" id="lib-grid">
        ${filtered.length ? filtered.map((item, i) => `
          <div class="lib-card" data-lib-idx="${i}">
            <div class="lib-card-icon">${item.icon}</div>
            <div class="lib-card-info">
              <div class="lib-card-name">${routerEsc(item.name)}</div>
              <div class="lib-card-meta"><span class="lib-card-type">${item.typeLabel}</span>${item.savedAt ? ' · ' + new Date(item.savedAt).toLocaleDateString() : ''}</div>
            </div>
            <button class="btn btn-p btn-sm lib-card-open" data-lib-idx="${i}">Open →</button>
          </div>
        `).join('') : `<div class="lib-view-empty">// nothing in your library yet<br><span style="font-size:.7rem;opacity:.6">create something in the editor to see it here</span></div>`}
      </div>
    </div>
  `;

  // Wire filter tabs
  el.querySelectorAll('.lib-filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      el._filterState = btn.dataset.filter;
      renderLibraryView();
    });
  });

  // Wire open buttons
  filtered.forEach((item, i) => {
    el.querySelectorAll(`[data-lib-idx="${i}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        navigateTo('editor');
        setTimeout(() => { switchMode(item.mode); item.openFn(); }, 80);
      });
    });
  });
}

// ─── SETTINGS VIEW ───────────────────────────────────
function renderSettingsView() {
  // Settings view just shows the existing settings modal content inline
  // The modal itself is still available via the ⚙ icon in the nav
  const el = document.getElementById('settings-content');
  if (!el) return;
  el.innerHTML = `
    <div class="settings-view-wrap">
      <div class="dash-section-title" style="margin-bottom:1rem">// Settings</div>
      <div style="font-family:var(--fx);font-size:.75rem;color:var(--txm);letter-spacing:.4px;line-height:1.8">
        Open the full settings panel below to customise themes, colours, fonts, and manage backups.
      </div>
      <div style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:.5rem">
        <button class="btn btn-p" onclick="openModal('settingsModal')">⚙ Open Settings Panel</button>
        <button class="btn btn-s" onclick="document.getElementById('syncExportBtn').click()">⬇ Export Backup</button>
        <button class="btn btn-s" onclick="document.getElementById('syncImportBtn').click()">⬆ Import Backup</button>
      </div>
    </div>
  `;
}

// ─── SIDEBAR NAV TOGGLE ──────────────────────────────
function initNavSidebar() {
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
    item.addEventListener('click', () => navigateTo(item.dataset.view));
  });
}

// ─── INIT ────────────────────────────────────────────
function initRouter() {
  initNavSidebar();
  const last = getLastView();
  navigateTo(last);
}

// ═══════════════════════════════════════════════════════
// NOTEBOOK — basic markdown pages, saves to localStorage
// Storage key: loreos_notebook (object: { pages: {id: page}, activePageId })
// Page: { id, title, content, createdAt, updatedAt }
// ═══════════════════════════════════════════════════════

function nbGet() {
  try { return JSON.parse(localStorage.getItem('loreos_notebook') || '{"pages":{},"activePageId":null}'); }
  catch(e) { return { pages: {}, activePageId: null }; }
}
function nbSet(data) {
  try { localStorage.setItem('loreos_notebook', JSON.stringify(data)); } catch(e) {}
}
function nbId() { return 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

let _nbActiveId = null;
let _nbAutoSaveTimer = null;

function renderNotebookView() {
  const el = document.getElementById('notebook-content');
  if (!el) return;

  const data = nbGet();
  const pages = Object.values(data.pages).sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
  _nbActiveId = data.activePageId || (pages[0]?.id ?? null);

  el.innerHTML = `
    <div class="nb-layout">
      <div class="nb-sidebar" id="nb-sidebar">
        <div class="nb-sidebar-head">
          <div class="nb-title">// Notebook</div>
          <button class="btn btn-ok btn-sm" id="nbNewBtn">+ New</button>
        </div>
        <div class="nb-page-list" id="nb-page-list"></div>
      </div>
      <div class="nb-editor" id="nb-editor">
        <div class="nb-editor-inner" id="nb-editor-inner">
          <div class="empty-state" style="min-height:200px">
            <div>// no page selected</div>
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

function nbRenderPageList() {
  const list = document.getElementById('nb-page-list');
  if (!list) return;
  const data = nbGet();
  const pages = Object.values(data.pages).sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));

  list.innerHTML = pages.length ? pages.map(p => `
    <div class="nb-page-item ${p.id === _nbActiveId ? 'active' : ''}" data-nb-id="${p.id}">
      <span class="nb-page-title">${routerEsc(p.title || 'Untitled')}</span>
      <span class="nb-page-date">${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}</span>
    </div>
  `).join('') : `<div class="nb-empty">// no pages yet</div>`;

  list.querySelectorAll('.nb-page-item').forEach(item => {
    item.addEventListener('click', () => {
      nbSaveActive();
      nbOpenPage(item.dataset.nbId);
    });
  });
}

function nbOpenPage(id) {
  const data = nbGet();
  const page = data.pages[id];
  if (!page) return;
  _nbActiveId = id;
  data.activePageId = id;
  nbSet(data);

  // Update sidebar active state
  document.querySelectorAll('.nb-page-item').forEach(el => {
    el.classList.toggle('active', el.dataset.nbId === id);
  });

  const inner = document.getElementById('nb-editor-inner');
  if (!inner) return;

  inner.innerHTML = `
    <div class="nb-page-header">
      <input class="nb-page-title-input" id="nbTitleInput" value="${routerEsc(page.title || '')}" placeholder="Page title...">
      <div class="nb-page-acts">
        <button class="btn btn-s btn-sm" id="nbPreviewToggle">👁 Preview</button>
        <button class="btn btn-err btn-sm" id="nbDeleteBtn">✕ Delete</button>
      </div>
    </div>
    <div class="nb-content-wrap">
      <textarea class="nb-textarea" id="nbContent" placeholder="Write in markdown...">${routerEsc(page.content || '')}</textarea>
      <div class="nb-preview" id="nbPreview" style="display:none"></div>
    </div>
    <div class="nb-footer">
      <span class="nb-save-status" id="nbSaveStatus">saved</span>
      <button class="btn btn-p btn-sm" id="nbSaveBtn">Save</button>
    </div>
  `;

  const titleIn = document.getElementById('nbTitleInput');
  const contentTA = document.getElementById('nbContent');
  const saveStatus = document.getElementById('nbSaveStatus');

  function markUnsaved() {
    saveStatus.textContent = 'unsaved';
    saveStatus.style.color = 'var(--warn)';
    clearTimeout(_nbAutoSaveTimer);
    _nbAutoSaveTimer = setTimeout(nbSaveActive, 2000);
  }

  titleIn.addEventListener('input', () => {
    markUnsaved();
    // update sidebar title live
    const item = document.querySelector(`.nb-page-item[data-nb-id="${id}"] .nb-page-title`);
    if (item) item.textContent = titleIn.value || 'Untitled';
  });
  contentTA.addEventListener('input', markUnsaved);

  document.getElementById('nbSaveBtn').addEventListener('click', () => {
    nbSaveActive();
    saveStatus.textContent = 'saved';
    saveStatus.style.color = 'var(--ok)';
  });

  document.getElementById('nbDeleteBtn').addEventListener('click', async () => {
    if (!await askConfirm('Delete this page?')) return;
    const d = nbGet();
    delete d.pages[id];
    d.activePageId = null;
    nbSet(d);
    _nbActiveId = null;
    renderNotebookView();
  });

  let previewing = false;
  document.getElementById('nbPreviewToggle').addEventListener('click', () => {
    previewing = !previewing;
    const ta = document.getElementById('nbContent');
    const pv = document.getElementById('nbPreview');
    const btn = document.getElementById('nbPreviewToggle');
    if (previewing) {
      pv.innerHTML = nbRenderMarkdown(ta.value);
      ta.style.display = 'none';
      pv.style.display = '';
      btn.textContent = '✏ Edit';
    } else {
      ta.style.display = '';
      pv.style.display = 'none';
      btn.textContent = '👁 Preview';
    }
  });
}

function nbSaveActive() {
  if (!_nbActiveId) return;
  const titleIn = document.getElementById('nbTitleInput');
  const contentTA = document.getElementById('nbContent');
  if (!titleIn || !contentTA) return;
  const data = nbGet();
  if (!data.pages[_nbActiveId]) return;
  data.pages[_nbActiveId].title = titleIn.value.trim() || 'Untitled';
  data.pages[_nbActiveId].content = contentTA.value;
  data.pages[_nbActiveId].updatedAt = new Date().toISOString();
  nbSet(data);
  // refresh sidebar dates
  const item = document.querySelector(`.nb-page-item[data-nb-id="${_nbActiveId}"] .nb-page-date`);
  if (item) item.textContent = new Date().toLocaleDateString();
  const st = document.getElementById('nbSaveStatus');
  if (st) { st.textContent = 'saved'; st.style.color = 'var(--ok)'; }
}

function nbNewPage() {
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
  setTimeout(() => document.getElementById('nbTitleInput')?.focus(), 50);
}

// ── Very lightweight markdown renderer (no lib needed) ──
function nbRenderMarkdown(md) {
  if (!md) return '';
  let h = md
    // Escape HTML first
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    // Headings
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/__(.+?)__/g,'<strong>$1</strong>')
    .replace(/_(.+?)_/g,'<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g,'<del>$1</del>')
    // Inline code
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>')
    // Horizontal rule
    .replace(/^---+$/gm,'<hr>')
    // Unordered lists
    .replace(/^\* (.+)$/gm,'<li>$1</li>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm,'<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Line breaks → paragraphs (double newline)
    .replace(/\n\n/g,'</p><p>')
    .replace(/\n/g,'<br>');
  return `<div class="nb-rendered"><p>${h}</p></div>`;
}

