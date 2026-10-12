// ═══════════════════════════════════════════════════════
// HELP — the help dialog.
// ═══════════════════════════════════════════════════════

import { registerMarkup } from './util.js';

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(260, `<!-- HELP MODAL -->
<div id="helpModal" class="modal">
  <div class="modal-box lg" style="max-width:700px">
    <div class="modal-head"><h2>LoreOS — Quick Reference</h2><button class="modal-x" data-close="helpModal">×</button></div>
    <div class="modal-body" style="font-family:var(--fb);font-size:.83rem;line-height:1.75;color:var(--txd)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.1rem">
        <div>
          <div style="font-family:var(--fp);font-size:.95rem;color:var(--p);letter-spacing:1.5px;margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid var(--bd)">❖ Lorebook</div>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:.35rem">
            <li><strong>Import</strong> — ST or JanitorAI lorebook JSON</li>
            <li><strong>Merge</strong> — cherry-pick entries from a second lorebook</li>
            <li><strong>Library</strong> — save/load named lorebook snapshots</li>
            <li><strong>LB Settings</strong> — scanDepth, tokenBudget, matchWholeWords etc.</li>
            <li><strong>Templates</strong> — reusable entry content snippets</li>
            <li><strong>Find &amp; Replace</strong> — regex-capable, scoped by field</li>
            <li><strong>Export JSON</strong> — ST or JanitorAI format</li>
            <li><strong>Export Text / Public</strong> — strips XML tags &amp; code blocks</li>
          </ul>
        </div>
        <div>
          <div style="font-family:var(--fp);font-size:.95rem;color:var(--p);letter-spacing:1.5px;margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid var(--bd)">☺ Character</div>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:.35rem">
            <li><strong>Import JSON or PNG</strong> — reads card data from tEXt chunk</li>
            <li><strong>Export PNG</strong> — embeds card JSON (V3) into your image</li>
            <li><strong>Attach Lorebook</strong> — embeds lorebook as <code>character_book</code></li>
            <li><strong>⇄ Pronouns &amp; Nouns</strong> — convert pronouns to ST macros or swap gender. Verb agreement auto-applied.</li>
            <li><strong>Templates</strong> — field snippets for descriptions, system prompts etc.</li>
          </ul>
        </div>
        <div>
          <div style="font-family:var(--fp);font-size:.95rem;color:var(--p);letter-spacing:1.5px;margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid var(--bd)">⚙ Preset</div>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:.35rem">
            <li><strong>Import</strong> — loads any ST chat completion preset JSON</li>
            <li><strong>Prompt Library</strong> — ST system anchors + saved prompts</li>
            <li><strong>+ New Prompt</strong> — adds blank to top of list</li>
            <li><strong>Drag</strong> rows to reorder; ▶/▼ to collapse</li>
            <li>Export preserves full ST format incl. prompt_order</li>
          </ul>
        </div>
        <div>
          <div style="font-family:var(--fp);font-size:.95rem;color:var(--p);letter-spacing:1.5px;margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid var(--bd)">✦ General</div>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:.35rem">
            <li><strong>◑</strong> — toggle dark/light mode</li>
            <li><strong>Ctrl+D</strong> — toggle theme from anywhere</li>
            <li><strong>Ctrl+S / N / I / E</strong> — save / new / import / export, for whichever editor you're in</li>
            <li><strong>Esc</strong> — close a dialog &nbsp;·&nbsp; <strong>F1</strong> — this help</li>
            <li>All data in <strong>localStorage</strong> — nothing leaves your browser</li>
            <li><strong>⇅ Sync</strong> — export/import .json backup, rolling 10-snapshot history</li>
          </ul>
        </div>
      </div>
      <div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--bd);font-family:var(--fx);font-size:.7rem;color:var(--txm);letter-spacing:.5px">
        LoreOS — built for SillyTavern · JanitorAI · SaucepanAI
      </div>
    </div>
  </div>
</div>`);

