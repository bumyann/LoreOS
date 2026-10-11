# Browser tests

End-to-end checks that drive the real app in headless Chromium. They are not served by the app and not part of the build.

## Setup

```bash
npm install playwright        # anywhere; the scripts just need `require('playwright')` to work
npx playwright install chromium
# or point at an existing Chromium: export CHROMIUM=/path/to/chromium
```

## Run

```bash
node tests/e2e/run.js            # the regression suite (19 scenarios)  [pass a name prefix to run one]
node tests/e2e/crawl.js          # clicks every button and dialog on phone + desktop, reports JS errors
node tests/e2e/layout.js         # no sideways scroll / errors at phone, tablet, desktop widths
node tests/e2e/offline.js        # offline boot, save and export at / and at a /LoreOS/ subfolder; update toast
```

## How the tests reach the app

The app is ES modules, so nothing is global. `window.LoreOS` exposes every export and the state variables, and `harness.js` runs each scenario inside `with (window.LoreOS) { ... }`, so a scenario can call `createChar()`, read `lorebook` or assign `charLibrary = {...}`. Files the app "downloads" are captured in `window.__dl` (use `await dl()` for the latest one).

Each file in `scenarios/` returns a plain result object; `run.js` holds the check for it. A scenario that throws, or a page error during it, fails.
