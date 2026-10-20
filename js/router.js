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
import { askConfirm, esc } from './util.js';
import { switchMode } from './workshop.js';
import { cancelJournalAutosave, nbSaveActive, renderNotebookView } from './journal.js';

export let currentView = null;

// HTML escape helper used throughout router/notebook
export function routerEsc(s) { return esc(s); }

export const VIEWS = ['home', 'library', 'notebook', 'editor', 'laboratory'];

export function navigateTo(viewId) {
  if (!VIEWS.includes(viewId)) return;
  // Leaving the journal: bank anything still inside the 2s autosave window
  if (currentView === 'notebook' && viewId !== 'notebook') {
    try { cancelJournalAutosave(); nbSaveActive(); } catch (e) {}
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

// the journal lives in journal.js; these stay available from here for the modules that already import them
export { cancelJournalAutosave, nbSaveActive, renderNotebookView };
