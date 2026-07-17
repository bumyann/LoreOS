# LoreOS // Universal Editor

Wanted an all-in-one so I didn't have to navigate 47 different sites just to get work done. Lorebook on one tab, char card on another, preset on a third... girl, I'm not dealing with all that. SLEd existed and I absolutely adored it, but I also needed everything else or I'd genuinely tweak out. Soooo here we are. Now it's all in one place and I don't have to copy-paste templates from 4 different text files anymore!

Disclaimer: Vibe-coded with AI assistance because I don't code shit, I just write lots of lore and have poor impulse control. Tested before publishing because I'm not a rat^2. Built for SillyTavern, JanitorAI, and SaucepanAI workflows but honestly it's just a file, do whatever you want with it. Made everything in one file on purpose because I'm not downloading folders of code when I already have so many as is.

https://loreos.pages.dev/
---

## What's In It

**📖 Lorebook Editor** — Import, edit, export ST-format lorebooks. multi-tab editing, search & replace (with regex), merge entries from other lorebooks, export as JSON. Exporting as plain text/markdown also available, in case you want to dump your lore content in JanitorAI's public script pages without painstakingly copypasting each individual entry and editing everything.

**🎭 Character Card Editor** — V2 and V3 spec support. Import/export JSON or PNG cards (actual PNG tEXt chunk embed, not fake). Attach a lorebook directly to a character card (`character_book` field — ST reads this on import). Pronoun macro converter that handles verb agreement so you don't have to.

**⚙ Chat Completion Preset Editor** — Full ST preset JSON support. Sampler sliders, prompt tree with drag-to-reorder, collapse/expand nodes, sticky search bar, ST system anchor identifiers labelled properly. Prompt library with one-click anchor insertion. Variable scanner for `{{setvar}}` patterns with rename-across-all.

**✦ General** — Fully customizable colour scheme (all vars, both modes, saved theme slots). Custom site title. everything stored in localStorage, nothing leaves your browser. Might do something about the fonts in the future. Template libraries all across, separated for each section so you don't have to go on a wild goose chase for templates you found in 2021 and forgot the link for.

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

### 🎭 Character Card
- Import JSON cards or PNG cards (reads embedded tEXt chunk)
- Export as JSON or PNG (embeds card data into the image file)
- V2 and V3 card spec, selectable
- Attach a lorebook to a character (`character_book`) — ST will offer to import it alongside the card
- **Pronoun → Macro tool**: highlights he/him, she/her, or they/them pronouns in your text. click to convert to pronoun macros (`{{sub}}`, `{{obj}}`, `{{poss}}`, `{{poss_p}}`, `{{ref}}`). verb agreement gets fixed automatically (e.g. "where are they" → "where is {{sub}}"). ambiguous cases (his/her) flagged in yellow — click to cycle through options. 
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
- **◑** — Toggle dark/light mode
- **⚙** — Full colour customiser: edit all CSS variables for both modes, save named theme slots, custom site title
- **?** — Quick reference cheat sheet
- All data in `localStorage` — nothing leaves your browser
- Single HTML file, works fully offline
- Mobile-friendly: swipe from left edge to open sidebar, bottom navigation bar

---

## Usage

### Online
Use https://loreos.pages.dev/ online!

### Local Server
#### Desktop

```bash
# Python (usually pre-installed on mac/linux, available on windows too)
python -m http.server 8080
# open http://localhost:8080 in your browser
```

#### Android (Termux)
1. Install [Termux](https://f-droid.org/packages/com.termux/) from F-Droid (not the Play Store version)
2. Run:
```bash
termux-setup-storage
pkg update && pkg install git python
git clone https://github.com/bumyann/LoreOS-Universal-Editor
cd LoreOS
python -m http.server 8080
```
3. Open Chrome → `http://localhost:8080`
4. Three dot menu → **Add to Home Screen**

---

## Credits
Inspired by [SLEd](https://github.com/ActualBroeckchen/SLEd) by ActualBroeckchen! LoreOS is its own thing but SLEd is where the lorebook editor idea started — go check it out!!

---

## License

MIT
