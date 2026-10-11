# LoreOS changelog

Work on the `staging` branch, newest first. No version numbers: these are grouped by what was done, not released.

## Full audit (editor, imports, presets, journal, backup)

Tested by driving the real app in headless Chromium. 29 regression scenarios now pass (10 new ones from this audit), plus the 865-click crawl, the layout test and the offline test.

### Fixed
- **Lorebook: character filter was wiped on every entry save.** The filter UI was missing, so saving any entry cleared it. Restored (include/exclude, names, tags).
- **Lorebook: regex keys with commas were split on save** (`/a,b/i` became two keys). Keys now split with a regex-aware parser, and an untouched keyword box keeps the original array.
- **Lorebook: NOT ANY / NOT ALL labels were swapped** in the logic dropdown. Worth a second look against SillyTavern, since the numeric values are what matter on export.
- **Lorebook: entries with secondary keys now set `selective`** so they actually use them.
- **Search & Replace** was broken three ways: autosave reverted replacements, replacements were not persisted, and it could not see text you had typed but not saved. Now it commits the open editor first, saves after replacing, replaces the n-th match correctly, and supports `$1`, `$&`, `$$` and `$<name>` in regex mode.
- **Whole-word search failed on non-Latin text** (Japanese, Cyrillic, accents). Uses unicode-aware boundaries now.
- **Janitor / Saucepan imports** were not normalised or saved, and `enabled:false` was ignored. Fixed, and the export writes `enabled` back correctly.
- **Janitor paste dialog** had a dead "open a file" path. Added a real file picker.
- **Importing over an unsaved lorebook replaced it silently.** Now asks first (only when there is something to lose).
- **Text export** ignored the Entry Titles option and mishandled order `0`.
- **Character greetings lost their titles on save.** Alternate greetings are stored as `{title, message}` and flattened correctly for V2 and V3 export.
- **Attach lorebook to character** now keeps each entry's own order as `insertion_order`.
- **Presets lost data on open and save.** Unknown dropdown values (for example `reasoning_effort: "min"`, `names_behavior: -1`), extra `prompt_order` lists for other character ids, and a newline in `continue_postfix` are all kept now. An import then export of a real ST preset is identical apart from default keys being filled in.

### Checked and fine
- Journal: hostile titles and HTML in saved pages do not run or land in the DOM.
- Backup: export, import and restore round-trips byte for byte; a hostile bundle does not pollute prototypes.
- Preset prompt list actions (insert above/below, delete) keep `prompt_order` in sync.

### Not covered yet
- Google Drive sync against a fake Drive (connect, push, pull, conflict, expired token).
- Corrupted or full localStorage per key.

## Pass 4: modules

- Split the old `core.js` and oversized files into focused modules under `js/` and converted the app to native ES modules (no bundler).
- Each feature owns its dialog markup; `index.html` is now just the shell.
- Removed the `switchMode` monkey-patch and inline `onclick` handlers.
- Behaviour verified identical: same DOM, same 865-click crawl result, 0 ESLint errors.

## Pass 3: offline

- Service worker with relative paths (works at a site root or the GitHub Pages subfolder).
- Stale-while-revalidate for app files, so updates arrive without relying on the build step. Open pages get an "update ready, reload" prompt.
- Best-effort precache: one missing file never blocks install. Google Fonts are cached on first sight.

## Bug rounds 1 and 2

- Entry renumbering no longer breaks open tabs.
- Selective import and journal navigation no longer lose data.
- Character exports are spec-correct (V2, V3, PNG `chara` and `ccv3`, `.charx`), and ccv3-only PNGs import.
- Preset import is validated; blank seed handled; names escaped; deleting a preset closes its tab.
- Pronoun conversion and noun table collisions fixed.
- Restoring a backup can no longer be overwritten by in-memory editor state; a failed restore rolls back every key.
- Escaping swept through every attribute context (lists, pickers, library, titles).
- Sidebar for characters and presets brought back (the Library button stays for snapshots).
- Lorebook import no longer drops entries; shortcuts and Escape are mode-aware; unicode filenames; larger touch targets.
