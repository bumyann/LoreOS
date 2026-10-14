// ═══════════════════════════════════════════════════════
// STATE — the app's shared, mutable state in one place.
//
// Every module reads and writes these through `state.x`. (An imported binding
// can't be reassigned from another module, a property of a shared object can.)
// Nothing here has behaviour.
// ═══════════════════════════════════════════════════════

// Workshop tabs: at most this many items are open at once
export const WS_MAX_TABS = 5;

export const state = {
  // ── Editor ──
  mode: 'lore', // 'lore' | 'char' | 'preset' | 'prompt' | 'regex'

  // ── Lorebook editor ──
  lorebook: { entries: {} },
  openTabs: [],
  activeTabId: null,
  nextUid: 0,
  sideBySide: false,
  selectedEntries: [],
  draggedEntries: [],
  unsaved: new Set(),
  formState: {},
  mergeStaging: null,
  mergeSelected: [],
  zoomLevel: 1,
  searchResults: [],
  searchIdx: 0,

  // ── Character cards: { id: { id, name, card, savedAt } } ──
  charLibrary: {},
  activeCharId: null,
  charFormState: {},
  charUnsaved: false,

  // ── Presets: { id: { id, name, preset, savedAt } } ──
  presetLibrary: {},
  activePresetId: null,
  presetFormState: {},
  presetUnsaved: false, // preset form edited since its last save

  // ── Prompt packs: { id: { id, name, pack, savedAt } } (see prompt_model.js) ──
  promptLibrary: {},
  activePromptId: null,
  promptUnsaved: false,
  promptTab: 'build',   // which part of the pack editor is showing

  // ── Personas: { id: { id, name, persona, savedAt } } (see persona.js) ──
  personaLibrary: {},
  // ── Gallery: { id: { id, name, thumb, w, h, source, prompt, savedAt } }; the full picture is at aet_img_<id> (see gallery.js) ──
  galleryLibrary: {},
  activePersonaId: null,

  // ── Regex sets: { id: { id, name, set, savedAt } } (see regex_model.js) ──
  regexLibrary: {},
  activeRegexId: null,
  regexUnsaved: false,
  regexOpen: null,      // id of the script card that is expanded

  // ── Workshop tabs: { id, type: 'lore'|'char'|'preset'|'prompt'|'regex', itemId, unsaved } ──
  wsItems: [],      // open tabs
  wsActiveId: null, // currently focused tab id
  wsNextId: 1,      // internal tab id counter

  // Set while a backup / Drive restore is being applied (the page reloads right
  // after). The editors keep in-memory copies and write them back on pagehide,
  // autosave and snapshot timers; without this guard those writes land after the
  // restore and silently replace the restored data with the old in-memory data.
  restoringBackup: false,
};
