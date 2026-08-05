# LoreOS

**A creator's sanctuary. built for the ones who write too much lore and have too many tabs open.**

LoreOS is an all-in-one creative workspace for AI roleplay creators — lorebook editor, character card editor, chat completion preset editor, and a private journal, all in one place. no accounts, no subscriptions, nothing leaves your browser. just your work, organized.

Currently compatible with: **SillyTavern**, **JanitorAI** — SaucepanAI support in progress.

> Made with AI assistance by someone who writes a lot of lore and has poor impulse control. Tested before publishing because i'm not a rat².

---

## 🌐 Use it now

**[loreos.pages.dev](https://loreos.pages.dev/)** — hosted, no install needed

---

## What's in it

### 📖 Lorebook
Import, edit, and export lorebooks. multi-tab editing, search & replace (regex supported), entry merge, fullscreen field editor on every textarea. exports to ST JSON, plain text, or public markdown.

### 🎭 Character Card
V3 cards as JSON or PNG (real tEXt chunk embed). attach a lorebook to a card, convert pronouns to macros with automatic verb agreement, template library for field snippets.

### ⚙️ Preset
Full ST chat completion preset editor. sampler sliders, prompt tree with drag-to-reorder, ST system anchors labelled, variable scanner for `{{setvar}}` patterns.

### 📓 Journal
Private writing space. Notion-style WYSIWYG — type markdown, it renders inline. stays in your browser.

### 🔬 Laboratory *(coming soon)*
Static analysis tools — token inspector, trigger inspector, conflict detector, consistency checker, and more. Wave 1 needs no API key.

### ✦ General
Fully customizable themes (both modes, saved slots), template libraries everywhere, rolling 10-snapshot backup history, PWA, mobile-friendly.

---

## Roadmap

LoreOS is organized around **rooms**, not features — each one has a distinct purpose and grows over time.

| Room | Status | Purpose |
|------|--------|---------|
| 🏠 Home | ✅ | Dashboard — recent items, quick actions |
| 📚 Library | ✅ | Everything you've made, browsable and searchable |
| 🛠 Workshop | ✅ | All editors — Lorebook, Character, Preset (Persona, Prompt, Regex stubs coming) |
| 📓 Journal | ✅ | Private WYSIWYG writing space |
| 🔬 Laboratory | 🔨 | Analysis tools for cards, lorebooks, and prompts |
| 🔭 Observatory | 📋 | Timelines, relationship graphs, world maps |
| 🛒 Market | 📋 | Community sharing of cards, lorebooks, presets, themes |

### Workshop 

| Tab | Status |
|-----|--------|
| Lorebook | ✅ shipped |
| Character | ✅ shipped |
| Preset | ✅ shipped |
| Persona | 🔨 coming |
| Prompt | 🔨 coming — modular prompt workbench |
| Regex | 🔨 coming — ST regex rule editor |

### Laboratory — tool waves

**Wave 1** *(no API key needed)*
Token Inspector · Lorebook Trigger Inspector · Prompt Conflict Detector · Character Consistency Checker · Context Viewer · Lorebook Dependency Viewer

**Wave 2** *(BYOK)*
AI Assistant (creative collaborator modes) · LLM Interpreter · Prompt Health Check

**Wave 3** *(ambitious/later)*
Prompt Stack Viewer · Prompt Comparator · Instruction Trace · Behaviour Simulator · Testing Grounds · Memory Inspector

---

## Running locally
The hosted version works fine for most people. if you want it fully local:

### Windows
Double-click `start.bat`.

### Mac / Linux
```bash
bash start.sh
```

### Android (Termux)
1. Install [Termux](https://f-droid.org/packages/com.termux/) from F-Droid (not the Play Store version)
2. Clone the repo and run:
```bash
bash start-termux.sh
```
3. Open Chrome → `http://localhost:8080`
4. Three-dot menu → **Add to Home Screen**

---

## Status

LoreOS is in **Early Access** — actively developed, features ship regularly. no version numbers until beta. if something breaks, open an issue or find me.

---

## Credits

Inspired by [SLEd](https://github.com/ActualBroeckchen/SLEd) by ActualBroeckchen — that's where the lorebook editor idea started. go check it out!

---

## License

MIT — do whatever you want with it.
