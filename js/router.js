// ═══════════════════════════════════════════════════════
// ROUTER.JS — SPA view router for LoreOS v1.0.0
// Views: home | library | editor | settings
// ═══════════════════════════════════════════════════════

let currentView = null;

const VIEWS = ['home', 'library', 'editor', 'settings'];

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
  if (viewId === 'settings') renderSettingsView();

  // Persist last view
  try { localStorage.setItem('loreos_lastView', viewId); } catch(e) {}
}

function getLastView() {
  try { return localStorage.getItem('loreos_lastView') || 'home'; } catch(e) { return 'home'; }
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
      <span class="dash-recent-name">${esc(item.name)}</span>
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
              <div class="lib-card-name">${esc(item.name)}</div>
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
