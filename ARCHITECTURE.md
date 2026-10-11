# How LoreOS is put together

Vanilla HTML/CSS/JS. No framework, no bundler. The app is native ES modules (`<script type="module">`), so it must be served over http(s). Opening `index.html` from disk shows a message instead.

## Layout

```
index.html            the shell only: nav, view panels, the editor frame
css/                  base.css (includes the mobile styles), components.css
vendor/               lz-string and JSZip, served locally so the app works offline
js/main.js            entry point: imports everything, injects markup, starts the app in a fixed order
js/state.js           the one shared, mutable `state` object (+ WS_MAX_TABS)
js/util.js            g(), esc(), toast, dialogs (askConfirm/askInput), dlFile, markup registry
js/storage.js         safeSet(), localStorage reads/writes, the lorebook <-> library link
js/history.js         field undo/redo, item undo/redo, per-item version history
js/workshop.js        workshop tabs, autosave (commitActiveEditor), switchMode, tab restore
js/lorebook*.js       editor (lorebook.js), entry model (lorebook_model.js), import/export (lorebook_io.js)
js/library.js         saved-lorebook library dialog        js/search.js  find & replace
js/character.js       character editor                      js/character_io.js  JSON/PNG/.charx/Saucepan
js/avatar.js          avatar sizing                         js/preset.js  preset editor
js/pronoun.js         pronoun and noun converter            js/templates.js (+ templates_data.js)
js/attach_lb.js       attach lorebooks to a card            js/fullscreen.js  big field editor
js/settings.js        themes, fonts, storage panel          js/sync.js  backup/restore   js/gdrive.js  Drive sync
js/mobile.js          phone nav and drawer                  js/router.js  views + the journal
js/pwa.js             service worker registration           js/help.js  the help dialog
js/tiptap-bundle.js   journal editor (classic script, built with esbuild)
sw.js                 service worker (offline)
```

## Rules that matter

1. **Shared state lives on `state`** (`state.lorebook`, `state.activeCharId`, ...). An imported binding can't be reassigned from another module, a property can. Don't add loose module-level `let`s that other files need to write.
2. **Start-up order is in `main.js`.** Events are wired before saved data is loaded; each step runs through `initStep` so one failure can't stop the rest.
3. **Dialogs and fixed elements are owned by the module that uses them.** Each registers its markup with `registerMarkup(order, html)` at the bottom of its file; `main.js` injects it all before anything is wired. `order` keeps the original page order (it matters for stacking).
4. **Every write goes through `safeSet()`** so a full disk is reported, never silent.
5. **Escape with `esc()`** (it escapes quotes too) for anything interpolated into HTML. Prefer building elements with the DOM.
6. **Commit before exporting** (`commitBeforeExport`), and **validate imports into a scratch object** before touching live data.
7. **Never leave an editor without calling `commitActiveEditor()`** (autosave).
8. **Fullscreen field editor** closes only from Apply / Cancel / X (not backdrop, not Escape).
9. **Mobile CSS stays in `base.css`.** Custom theme variables go on `document.body`.
10. **A new JS file must be added to `ASSETS` in `sw.js`** (or it won't work offline), and imported from somewhere. `build.sh` stamps the cache name on deploy.

## Offline

`sw.js` precaches the app (relative paths, so it works in a subfolder such as GitHub Pages) and serves saved files first while refreshing them in the background, so deploys show up without a build step. Open pages get an "update ready" message when something changed.

## Console

`LoreOS` (on `window`) exposes every export and the state variables, e.g. `LoreOS.createChar()`, `LoreOS.lorebook`.

## Checks

- Syntax: `for f in js/*.js; do node --input-type=module --check < $f; done`
- Lint (catches undefined names and writes to imports): `npx eslint@8 --no-eslintrc --env browser,es2022 --parser-options sourceType:module,ecmaVersion:2022 --rule '{"no-undef":"error","no-import-assign":"error"}' --global LZString,JSZip,google,TiptapEditor,TiptapStarterKit,TiptapMarkdown js/*.js`
- Browser tests: see `tests/e2e/README.md`.
