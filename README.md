# LoreOS // Universal Editor

Wanted an all-in-one so I didn't have to navigate 47 different sites just to get work done. Lorebook on one tab, char card on another, preset on a third — I was losing my mind. SLEd existed and I genuinely loved it, but I also needed everything else. So I just. made it. now it's all in one place and I don't have to copy-paste templates from 4 different text files anymore.

Also, manually scrolling through a 2000 word description to fix every single gendered pronoun one by one? Not doing that. The pronoun tool exists because I'm lazy and I have standards.

Disclaimer: vibe-coded with AI assistance. Tested before publishing because I'm not feral about it. Built for SillyTavern, JanitorAI, and SaucepanAI workflows but honestly it's just a file, do whatever you want with it.

---

## What's in it

**📖 Lorebook editor** — import, edit, export ST-format lorebooks. multi-tab editing, search & replace (with regex), merge entries from other lorebooks, export as JSON / plain text / public markdown. template library so you're not copy-pasting the same entry formats forever.

**🎭 Character card editor** — V2 and V3 spec support. import/export JSON or PNG cards (actual PNG tEXt chunk embed, not fake). attach a lorebook directly to a character card (`character_book` field — ST reads this on import). pronoun → macro converter that handles verb agreement so you don't have to. template library for field content.

**⚙ Chat completion preset editor** — full ST preset JSON support. sampler sliders, prompt tree with drag-to-reorder, collapse/expand nodes, sticky search bar, ST system anchor identifiers labelled properly. prompt library with one-click anchor insertion. variable scanner for `{{setvar}}` patterns with rename-across-all.

**✦ General** — fully customizable colour scheme (all vars, both modes, saved theme slots). custom site title. everything stored in localStorage, nothing leaves your browser. single HTML file, works offline.

---

## Features

### 📖 Lorebook
- Import/export ST-format lorebook JSON (object and array style both work)
- Merge entries from a second lorebook with cherry-pick selection
- Multi-tab editing with optional side-by-side view
- Full entry fields: keywords, secondary keywords, selective logic, activation settings, position/depth, character filter, generation triggers, recursion, group weight
- Search & replace — regex support, scoped by field (content / keywords / names / all)
- Export as JSON, plain text, or public markdown (XML tags and code blocks stripped automatically)
- Library: save and load named lorebook snapshots
- Template library: reusable entry content snippets
- Fullscreen field editor (⛶) on every textarea
- **Ctrl+T** — open template library from any focused field

### 🎭 Character Card
- Import JSON cards or PNG cards (reads embedded tEXt chunk)
- Export as JSON or PNG (embeds card data into the image file)
- Upload a base image once — it stays attached to the card
- V2 and V3 card spec, selectable
- Attach a lorebook to a character (`character_book`) — ST will offer to import it alongside the card
- **Pronoun → Macro tool**: highlights he/him, she/her, or they/them pronouns in your text. click to convert to ST macros (`{{sub}}`, `{{obj}}`, `{{poss}}`, `{{poss_p}}`, `{{ref}}`). verb agreement gets fixed automatically (e.g. "where are they" → "where is {{sub}}"). ambiguous cases (his/her) flagged in yellow — click to cycle through options. manual mode only, you're in control.
- Character library with duplicate and delete
- Template library for field snippets (descriptions, system prompts, etc.)

### ⚙ Preset
- Import/export full ST chat completion preset JSON
- Sampler settings: temperature, top_p, top_k, top_a, min_p, repetition/frequency/presence penalty, max context, max tokens, seed — all as sliders + number inputs
- Prompt strings editor (impersonation prompt, WI format, continue nudge, group nudge, etc.)
- Full prompt tree:
  - Renders in `prompt_order` sequence (canonical ST display order)
  - Drag to reorder
  - Collapse/expand individual nodes or all at once
  - Enable/disable per prompt
  - Insert prompt above or below any node
  - Sticky search bar — searches name and content, ↑↓ to cycle matches
  - ST system anchors (`main`, `chatHistory`, `worldInfoBefore`, `worldInfoAfter`, `charDescription`, `charPersonality`, `scenario`, `personaDescription`, `nsfw`, `jailbreak`, `dialogueExamples`, `enhanceDefinitions`) labelled with badges
- **Prompt Library**: click to insert any ST system anchor into your preset, plus your own saved prompts
- **+ New Prompt** in header — adds blank prompt to the top, no scrolling required
- **🔡 Variables panel**: scans all prompt content for `{{setvar::name::value}}` patterns, groups by variable name, lets you rename a variable across all prompts at once
- Export preserves full ST format including prompt_order

### ✦ General
- **◑** — toggle dark/light mode
- **⚙** — full colour customiser: edit all CSS variables for both modes, save named theme slots, custom site title
- **?** — quick reference cheat sheet
- **Ctrl+T** — template library from any field
- **Ctrl+D** — toggle theme
- All data in `localStorage` — nothing leaves your browser
- Single HTML file, works fully offline
- Mobile-friendly: swipe from left edge to open sidebar, bottom navigation bar

---

## Usage

1. Download `index.html`
2. Open it in any modern browser
3. That's it

No install. No server. No dependencies.

### Run locally on desktop (for PWA install)

PWA install requires HTTP, not a local file. Easiest way on desktop:

```bash
# Python (usually pre-installed on mac/linux, available on windows too)
python -m http.server 8080
# open http://localhost:8080 in your browser
```

Then install from the browser address bar.

### Run locally on Android with Termux

1. Install [Termux](https://f-droid.org/packages/com.termux/) from F-Droid (not the Play Store version)
2. Run:
```bash
termux-setup-storage
pkg update && pkg install python
```
3. Copy `index.html` to your phone, then in Termux:
```bash
cd /sdcard/Download
python -m http.server 8080
```
4. Open Chrome → `http://localhost:8080`
5. Three dot menu → **Add to Home Screen**

---

## Notes

- Data lives in `localStorage`. Clearing your browser data will wipe your libraries. Export regularly.
- PNG card embed uses the standard `tEXt` chunk with keyword `chara` — compatible with ST and JanitorAI PNG format.
- The `character_book` field follows the V2/V3 spec and is read natively by SillyTavern.
- Title and colour scheme are fully customizable from the ⚙ settings panel. Saved themes persist across sessions.

---

## Credits

Inspired by [SLEd](https://github.com/ActualBroeckchen/SLEd) by ActualBroeckchen (CC0). LoreOS is its own thing but SLEd is where the lorebook editor idea started — go check it out.

---

## License

MIT
