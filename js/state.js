// ═══════════════════════════════════════════════════════
// STATE — the app's shared, mutable state in one place. Modules read and write these
// variables; nothing here has behaviour.
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let mode = 'lore'; // 'lore' | 'char' | 'preset'
let lorebook = { entries: {} };
let openTabs = [];
let activeTabId = null;
let nextUid = 0;
let sideBySide = false;
let selectedEntries = [];
let draggedEntries = [];
let unsaved = new Set();
let formState = {};
let mergeStaging = null;
let mergeSelected = [];
let zoomLevel = 1;
let searchResults = [];
let searchIdx = 0;

// Character card library: { id: { id, name, card, savedAt } }
let charLibrary = {};
let activeCharId = null;
let charFormState = {};
let charUnsaved = false;

// Preset library: { id: { id, name, preset, savedAt } }
let presetLibrary = {};
let activePresetId = null;
let presetFormState = {};
let presetUnsaved = false; // preset form edited since its last save

// ── Workshop-level tabs ──
// wsItems: array of { id, type: 'lore'|'char'|'preset', itemId, unsaved }
// Max 5 tabs open at once
const WS_MAX_TABS = 5;
let wsItems = [];      // open workshop tabs
let wsActiveId = null; // currently focused ws tab id
let wsNextId = 1;      // internal tab id counter

// Set while a backup / Drive restore is being applied (the page reloads right
// after). The editors keep in-memory copies and write them back on pagehide,
// autosave and snapshot timers; without this guard those writes land after the
// restore and silently replace the restored data with the old in-memory data.
let restoringBackup = false;
