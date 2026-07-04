# LoreOS // Universal Editor

A single-file, offline-first editor for **SillyTavern**, **JanitorAI**, and **SaucepanAI** workflows. No install, no server, no account — just open the HTML file and go.

**Three editors in one:**
- 📖 Lorebook editor
- 🎭 Character card editor (V2/V3 + PNG embed)
- ⚙ Chat completion preset editor

---

## Features

### 📖 Lorebook Editor
- Import/export ST-format lorebook JSON (object or array style)
- Merge entries from a second lorebook with cherry-pick selection
- Multi-tab editing with optional side-by-side view
- Full entry fields: keywords, secondary keywords, logic, activation, position/depth, character filter, generation triggers, recursion settings, group weight, and more
- Search & replace with regex support, scoped by field (content / keywords / names / all)
- Export as JSON, plain text, or public markdown (strips XML tags and code blocks)
- Library: save and load named lorebook snapshots
- Template library: save and reuse entry content snippets
- Fullscreen field editor (⛶) on all textareas
- **Ctrl+T** — open template library from any focused field

### 🎭 Character Card Editor
- Import JSON cards or PNG cards (reads embedded tEXt chunk data)
- Export as JSON or PNG (embeds card data directly into the image)
- Upload a base image for PNG export — no re-picking every time
- Supports **V2 and V3** card spec
- Attach a lorebook to a character (`character_book` field) — ST will offer to import it alongside the card
- **Pronoun → Macro tool**: converts he/him, she/her, or they/them pronouns to ST-compatible macros (`{{sub}}`, `{{obj}}`, `{{poss}}`, `{{poss_p}}`, `{{ref}}`) with verb agreement correction (e.g. "where are they" → "where is {{sub}}")
  - Manual mode: pronouns highlighted by colour, click to convert individually
  - Ambiguous cases (his/her) flagged in yellow — click to cycle options
- Character library with duplicate/delete
- Template library for field snippets

### ⚙ Chat Completion Preset Editor
- Import/export full ST chat completion preset JSON
- Sampler settings with sliders + number inputs (temperature, top_p, top_k, top_a, min_p, repetition/frequency/presence penalty, max context, max tokens, seed, and more)
- Prompt strings editor (impersonation prompt, WI format, continue nudge, etc.)
- Full prompt tree editor:
  - Drag to reorder
  - Collapse/expand individual nodes or all at once
  - Enable/disable per prompt
  - Insert prompt above or below any node
  - Sticky search bar — search by name or content, cycle with ↑↓
  - Special ST anchor identifiers (main, chatHistory, worldInfoBefore, charDescription, etc.) shown with coloured badge
- **Prompt Library**: ST system anchors available to add in one click, plus your own saved prompts
- **Variables panel**: scan all prompts for `{{setvar::name::value}}` patterns, grouped by variable name with rename-across-all
- Preset library with duplicate/delete

### ✦ General
- **◑** — toggle dark/light mode
- **⚙** — full theme customiser: edit all CSS colour variables for both modes, save named themes, set a custom site title
- **?** — quick reference / cheat sheet
- All data stored in `localStorage` — nothing leaves your browser
- Works fully offline after first load
- Mobile-friendly with off-canvas sidebar drawer (swipe from left edge) and bottom navigation bar
- **Ctrl+T** — template library from any field
- **Ctrl+D** — toggle theme

---

## Usage

1. Download `LoreOS.html`
2. Open it in any modern browser (Chrome, Firefox, Edge, Safari)
3. That's it

No install, no dependencies, no internet required after download.

### Installing as a PWA (mobile/desktop app)

For PWA install to work the file needs to be served over HTTP, not opened as a local file. Options:

#### Cloudflare Pages (recommended)
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) and sign up free
2. Create a new project → Upload assets → drop in `LoreOS.html`
3. You get a `yourname.pages.dev` URL — open it on mobile and install from there

#### GitHub Pages
If you're hosting the repo on GitHub:
1. Repo settings → Pages → Source: Deploy from branch → `main` / `root`
2. Available at `yourusername.github.io/LoreOS`

#### Local server on desktop
```bash
# Python (usually pre-installed)
python -m http.server 8080
# then open http://localhost:8080/LoreOS.html
```

#### Local server on Android (Termux)
Run LoreOS locally on your phone without any hosting:

1. Install [Termux](https://f-droid.org/packages/com.termux/) from F-Droid
2. Open Termux and run:
```bash
pkg update && pkg install python
```
3. Copy `LoreOS.html` to your phone storage, then in Termux:
```bash
# navigate to where the file is, e.g.:
cd /sdcard/Download
python -m http.server 8080
```
4. Open Chrome on your phone → `http://localhost:8080/LoreOS.html`
5. Three dot menu → **Add to Home Screen** to install as a PWA

> Termux needs storage permission: run `termux-setup-storage` first if it can't see your files.

---

## Compatibility

Designed for use with:
- **SillyTavern** (lorebooks, character cards V2/V3, chat completion presets)
- **JanitorAI** (character cards, pronoun macros)
- **SaucepanAI** (character cards, pronoun macros)

Pronoun macros use the shared `{{sub}}` / `{{obj}}` / `{{poss}}` / `{{poss_p}}` / `{{ref}}` format supported across all three platforms.

---

## Notes

- All data is stored in your browser's `localStorage`. Clearing browser data will erase your libraries. Export regularly.
- PNG character card embed uses the standard `tEXt` chunk with keyword `chara` — compatible with SillyTavern and JanitorAI PNG card format.
- The `character_book` field in exported cards follows the V2/V3 spec and is read natively by SillyTavern.

---

## License

MIT — do whatever you want with it.

---

*Built with the F.A.Y.E. OS aesthetic. Made for bot makers, lore writers, and worldbuilders.*
