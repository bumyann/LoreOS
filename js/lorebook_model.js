// ═══════════════════════════════════════════════════════
// LOREBOOK MODEL — pure helpers for lorebook entries: blank entry, normalising entries
// from other tools, and rebuilding the entries object from any shape of import.
// ═══════════════════════════════════════════════════════

// Rebuild an entries object so every key == en.uid, handling arrays, odd keys
// and collisions. Entry keys are NOT always 0,1,2: other tools export string or
// UUID keys, arrays, negative or duplicate uids. Numbers keep their slot where
// they can; everything else gets the next free one, in file order, so no entry
// is ever silently dropped. Only entries that are not objects at all (null,
// numbers, strings) are skipped. rebuildEntries.lastReport says what happened.
function rebuildEntries(raw) {
  const pairs = Array.isArray(raw)
    ? raw.map((en, i) => [String(i), en])
    : Object.entries(raw && typeof raw === 'object' ? raw : {});

  const report = { renumbered: 0, skipped: 0 };
  const result = {};
  const used = new Set();
  const pending = [];

  const isSlot = n => Number.isInteger(n) && n >= 0 && n <= 1e9;
  pairs.forEach(([origKey, en]) => {
    if (!en || typeof en !== 'object' || Array.isArray(en)) { report.skipped++; return; }
    normalizeEntry(en);
    // The object key is the authoritative uid (en.uid inside is often wrong,
    // e.g. all zero in some exports), as long as it is a clean number
    const key = /^\d+$/.test(String(origKey).trim()) ? parseInt(origKey, 10) : NaN;
    if (isSlot(key) && !used.has(key)) {
      used.add(key); en.uid = key; result[key] = en;
    } else {
      pending.push(en);
    }
  });

  let next = 0;
  pending.forEach(en => {
    while (used.has(next)) next++;
    used.add(next); en.uid = next; result[next] = en; report.renumbered++;
  });

  rebuildEntries.lastReport = report;
  return result;
}

// Tell the user when an import had to be adjusted, never silently
function reportRebuild(r) {
  if (!r) return;
  if (r.skipped) toast(r.skipped === 1 ? "1 item in the file wasn't a lorebook entry and was skipped." : `${r.skipped} items in the file weren't lorebook entries and were skipped.`, 'warn');
  if (r.renumbered) toast(`${r.renumbered} entr${r.renumbered === 1 ? 'y' : 'ies'} had unusual ids and were renumbered.`, 'info');
}

function normalizeEntry(en) {
  // Core array fields — some lorebooks omit these or use null
  // Keywords: some tools write a comma separated string instead of an array
  const asList = v => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(x => x.trim()).filter(Boolean) : []);
  if (!Array.isArray(en.key)) en.key = asList(en.key !== undefined ? en.key : en.keys);
  if (!Array.isArray(en.keysecondary)) en.keysecondary = asList(en.keysecondary !== undefined ? en.keysecondary : en.keyssecondary);
  // uid must be a number
  if (en.uid === undefined || en.uid === null) en.uid = 0;
  en.uid = parseInt(en.uid) || 0;
  // Ensure numeric defaults
  if (en.order === undefined || en.order === null) en.order = en.uid;
  if (en.position === undefined) en.position = 0;
  if (en.depth === undefined || en.depth === null) en.depth = 4;
  if (en.probability === undefined) en.probability = 100;
  if (en.useProbability === undefined) en.useProbability = true;
  if (en.sticky === undefined) en.sticky = 0;
  if (en.cooldown === undefined) en.cooldown = 0;
  if (en.delay === undefined) en.delay = 0;
  if (en.groupWeight === undefined) en.groupWeight = 100;
  if (en.selectiveLogic === undefined) en.selectiveLogic = 0;
  if (en.content === undefined || en.content === null) en.content = '';
  if (en.comment === undefined || en.comment === null) en.comment = '';
  // Character filter
  if (!en.characterFilter) en.characterFilter = { isExclude: false, names: [], tags: [] };
  if (!Array.isArray(en.characterFilter.names)) en.characterFilter.names = [];
  if (!Array.isArray(en.characterFilter.tags)) en.characterFilter.tags = [];
  // Triggers
  if (!Array.isArray(en.triggers)) en.triggers = [];
  // Boolean flags
  ['matchPersonaDescription','matchCharacterDescription','matchCharacterPersonality',
   'matchCharacterDepthPrompt','matchScenario','matchCreatorNotes',
   'constant','disable','vectorized','selective','excludeRecursion','preventRecursion',
   'delayUntilRecursion','ignoreBudget'].forEach(k => {
    if (en[k] === undefined) en[k] = false;
  });
}

// ═══════════════════════════════════════════════════════
// ENTRY CREATION
// ═══════════════════════════════════════════════════════
function blankEntry(uid) {
  return {
    uid, key: [], keysecondary: [], comment: 'New Entry', content: '',
    constant: false, vectorized: false, selective: true, selectiveLogic: 0,
    addMemo: true, order: uid, position: 0, disable: false, ignoreBudget: false,
    excludeRecursion: true, preventRecursion: true, delayUntilRecursion: false,
    probability: 100, useProbability: true, depth: 4, outletName: '', group: '',
    groupOverride: false, groupWeight: 100, scanDepth: null, caseSensitive: null,
    matchWholeWords: null, useGroupScoring: null, automationId: '', role: null,
    sticky: 0, cooldown: 0, delay: 0, triggers: [], displayIndex: uid,
    characterFilter: { isExclude: false, names: [], tags: [] },
    matchPersonaDescription: false, matchCharacterDescription: false,
    matchCharacterPersonality: false, matchCharacterDepthPrompt: false,
    matchScenario: false, matchCreatorNotes: false
  };
}
