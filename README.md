# LoreOS: From Yuu, For You [Early Access]

<img src="https://i.imgur.com/QVwnp23.png" alt="LoreOS">

**A creator's sanctuary. Built for the ones who write too much lore and have too many tabs open.**

LoreOS is an all-in-one creative workspace for AI roleplay creators. Characters, lorebooks, presets, prompts, regex, pictures and notes all live in one place, in your browser. No accounts, no subscriptions, and your work stays on your device.

Compatible with **SillyTavern**, **Lumiverse**, **SaucepanAI** and **JanitorAI**.

> Made with AI assistance by someone who writes a lot of lore and has poor impulse control. Tested before publishing because I'm not a rat².

---

## Try it

Nothing to install, it's hosted:

- **Main:** [loreos.net](https://loreos.net)
- **Staging** (newer, less finished changes): [bumyann.github.io/LoreOS](https://bumyann.github.io/LoreOS/)

Works on desktop, mobile and tablet, works offline once loaded, and can be installed as an app.

**New here?** The [LoreOS page](https://spiffy-temper-1b5.notion.site/LoreOS-3ff0ef120d918184bd61e0f30b6c00a7) walks through every room, plus the FAQ, roadmap and what's new.

---

## What's in it

LoreOS is organised into **rooms**, each for a different part of the creative process.

| Room | What it does |
|------|--------------|
| **Home** | Jump back in, favourites, recent works, quick actions, and a free-form inspiration board for pictures, notes and links. |
| **Library** | Everything you've made, on shelves. Worlds with nested folders, tags, pins, notes, covers and colours. A **Gallery** tab keeps your pictures as polaroids. |
| **Journal** | Notes and writing with pages inside pages, a `/` menu, `@` links to anything in your Library, toggles, to-dos and templates. |
| **Workshop** | The editors, with several open as tabs at once and autosave throughout. |
| **Laboratory** | Analysis and experiments. Not built yet. |
| **Settings** | Themes, fonts, logo, storage, backups and Google Drive sync. |

### Workshop editors

- **Lorebook:** import and merge, global settings, search and replace, advanced entry settings, templates.
- **Character:** pronoun and noun to macro converter, attach and merge lorebooks, Lumiverse Variants, Saucepan multi-intros. Import V2/V3 JSON and PNG, `.charx` and SaucepanAI `companion.json`. Export as V2 or V3 PNG or JSON (with JanitorAI versions of each) or `.charx`.
- **Preset:** variable scanning and renaming, markers, sampler settings, a full prompt tree. Supports Lumiverse **Loom Presets** with a settings panel for their prompt variables.
- **Prompt:** prompt packs for JanitorAI and SaucepanAI, built from modular parts.
- **Regex:** sets with a live tester, SillyTavern and Lumiverse scripts, and import from presets and characters.
- **Image:** crop, rotate, resize, filters, drawing, text, overlays, reusable stamps and watermarks, background cut-out, and AI edit.

### Pictures

- **Generate** with Pollinations (free, no key), a Pollinations account, any OpenAI-compatible endpoint, SwarmUI, or ComfyUI.
- **Edit** by hand or ask a provider to change a picture.
- Gallery pictures stay on your device. They are not part of backups or Drive sync, so use the Gallery's zip export to move them.

### Everywhere

- Field-level and item-level undo and redo, plus per-item version history with named checkpoints.
- Recently deleted with undo, and drop a file anywhere to import it.
- Light and dark themes, custom colours and fonts, saved themes.

---

## Privacy and security

- There is no LoreOS server that stores your work. It lives in your browser, with larger data in IndexedDB.
- Google Drive sync is optional and goes to your own Drive.
- API keys are not kept by default. You can keep one encrypted with a passphrase, or in plain text if you accept the risk. Keys are never part of backups, exports or Drive sync.
- Pollinations accounts connect through their own authorization page. LoreOS never sees your password.
- The site ships a strict Content Security Policy (`_headers` and a meta tag), so injected scripts can't run.

Found a security problem? Please tell me privately before posting it publicly.

---

## Run it yourself

The hosted version is fine for most people, but you can run it locally.

LoreOS is built from native ES modules, so it has to be served over `http://`. Opening `index.html` straight from your files won't work, and the page will tell you so.

**Windows:** double-click `start.bat`.

**Mac / Linux:**
```bash
bash start.sh
```

**Android (Termux):**
1. Install [Termux](https://f-droid.org/packages/com.termux/) from F-Droid (not the Play Store version).
2. Run:
```bash
pkg install python git
git clone https://github.com/bumyann/LoreOS
cd LoreOS
bash start.sh
```
3. Open Chrome and go to `http://localhost:8080`.
4. Three-dot menu, then **Add to Home Screen**.

Self-hosted copies can use the free Pollinations option and any provider you run yourself. Signing in to a Pollinations account only works on the origins registered with the LoreOS app key.

---

## For contributors

Vanilla JavaScript, no framework and no build step for the app itself. Just the files in this repo served as-is.

| Path | What's there |
|------|--------------|
| `index.html`, `css/`, `js/` | The app. `js/main.js` boots it and the modules are native ES modules. |
| `sw.js` | Service worker for offline use. `build.sh` stamps its cache key on deploy. |
| `_headers`, `_redirects` | Cloudflare Pages config, including the CSP. |
| `tools/tiptap/` | Builds `js/tiptap-bundle.js`, the Journal editor. |
| `js/adapters/` | One file per file format: plain functions that turn a card into that format and back. No browser needed. |
| `js/export_targets.js` | The list every character Export menu is built from. |
| `tests/e2e/` | Browser regression suite. |
| `tests/unit/`, `tests/fixtures/` | Tests for the adapters (`node --test`) and the small sample files they use. |
| `vendor/` | Bundled third-party libraries. |

**Adding a format**

Each file format is one adapter file, so a new one does not touch the rest of the app much.

1. **Write the adapter** in `js/adapters/yourformat.js`: plain functions, no DOM and no storage, so it can be tested without a browser. `js/adapters/tavern.js` (export) and `js/adapters/saucepan.js` (import) are short examples. Say at the top of the file which fields map where and what the format cannot hold.
2. **Test it** in `tests/unit/yourformat.test.js` with `node --test`. Cover a round trip (import, export, import again gives the same card), unicode and emoji, Windows line endings, and a bad file. If the platform publishes a spec or JSON Schema, check your output against it.
3. **Add sample files** to `tests/fixtures/`. Use small made-up cards, never a real person's character, and keep the licence with anything copied from a spec.
4. **Export:** add one entry to `CHARACTER_EXPORTS` in `js/export_targets.js`. It becomes a menu item in the editor, the header and on phones, tooltip included.
5. **Import** takes three small edits for now: a button in the Import menu in `index.html`, a file input registered in `js/character.js` and wired in `js/main.js`, and a line in `js/dropimport.js` so dropping the file works.
6. **Be honest about testing.** If you could not try it in the real app, set `untested: true` on the export entry (the menu then says so) and say so in your pull request. Real exports from the platform are the most useful thing anyone can add.

Add the file to the list in `sw.js` so it works offline.

**Rebuild the Journal editor** (only needed when changing the TipTap setup):
```bash
cd tools/tiptap
npm install
npm run build
```

**Run the tests** (needs [Playwright](https://playwright.dev) installed):
```bash
node tests/e2e/run.js            # all scenarios
node tests/e2e/run.js image      # only scenarios starting with "image"
```
The format adapters under `js/adapters/` are plain functions with no browser needed, so they have their own tests:
```bash
node --test                      # no install, finds every *.test.js
```
The image providers and the Pollinations sign-in are only tested against a mocked network, so they need real-world testing.

Development happens on `staging`. `main` is for versioned releases.

---

## Status

LoreOS is in **Early Access**. It's actively developed and features ship regularly, so expect things to change. If something breaks, open an issue.

---

## Credits

Inspired by [SLEd](https://github.com/ActualBroeckchen/SLEd) by ActualBroeckchen. That's where the lorebook editor idea started. Go check it out!

---

## License

AGPL-3.0
