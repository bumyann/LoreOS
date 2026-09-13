# LoreOS — From Yuu, For You [Early Access]

**A creator's sanctuary. built for the ones who write too much lore and have too many tabs open.**

LoreOS is an all-in-one creative workspace for AI roleplay creators — lorebook editor, character card editor, chat completion preset editor, a private journal, and more — all in one place. No accounts, no subscriptions.
Don't want to install anything? I got you! It's hosted online, accessible from anywhere! Otherwise, you can run it yourself on a local server! Available on desktop and mobile!
Currently compatible with: **SillyTavern**, **Lumiverse**, **SaucepanAI**, **JanitorAI**.

> Made with AI assistance by someone who writes a lot of lore and has poor impulse control. Tested before publishing because I'm not a rat².

---

## Website
Hosted, no install needed!
- Main Branch: [loreos.net](https://loreos.net)
- Staging Branch (Experimental updates here!):[loreos.github.io](https://bumyann.github.io/LoreOS/)

---

## What's In It?

- **🛠 Workshop** — editors for lorebooks, character cards, and chat completion presets. Open several tabs at once and swap between them instantly, autosave keeps everything safe mid-swap.
  - **Lorebook editor** — import/merge lorebooks, global settings, search & replace, advanced entry settings
  - **Character editor** — pronoun/noun ↔ macro converter with auto grammar correction on any field, attach and merge multiple lorebooks into a character's embedded `character\_book`, Lumiverse Variants support, Saucepan multi-intro support. Export as V2 or V3 JSON, V2 or V3 PNG, SaucepanAI Companion, or .charx (Lumiverse)
  - **Preset editor** — variable scanning + easy renaming, markers, sampler settings, full prompt tree view
- **📚 Library** — everything you've made, all in one place
- **📓 Journal** — a built-in Notion/Docs-style markdown notebook for your own notes
- **⚙ Settings** — theme/font customization, Google Drive sync, or manual backup/restore via import/export JSON
- Field-level and item-level undo/redo, plus per-item version history with named checkpoints you can restore or export individually
- Works on desktop, mobile, and tablet (tablet UI still needs some love)

---

## Roadmap

LoreOS is organized around **rooms**, not features — each one has a distinct purpose and grows over time.

| Room | Status | Purpose |
|------|--------|---------|
| Home | Implemented | Dashboard — recent items, quick actions |
| Library | Implemented, WIP | Everything you've made, browsable and searchable |
| Workshop | Implemented, WIP | All editors — Lorebook, Character, Preset (Persona, Prompt, Regex tabs in progress) |
| Journal | Implemented, WIP | Private WYSIWYG writing space |
| Laboratory | Not Started | Analysis tools for cards, lorebooks, and prompts |
| Observatory | Unconfirmed | Timelines, relationship graphs, world maps |
| Market | Unconfirmed | Community sharing of cards, lorebooks, presets, themes |

---

## Installation
The hosted version works fine for most people, but if you want it fully local:

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
LoreOS is in **Early Access** — actively developed, features ship regularly. If something breaks, open an issue or find me on Discord!

---

## Credits

Inspired by [SLEd](https://github.com/ActualBroeckchen/SLEd) by ActualBroeckchen — that's where the lorebook editor idea started. Go check it out!

---

## License

AGPL-3.0
