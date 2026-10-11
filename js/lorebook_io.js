// ═══════════════════════════════════════════════════════
// LOREBOOK I/O — importing, merging and exporting lorebooks: SillyTavern JSON, plain
// text and public markdown, JanitorAI and SaucepanAI.
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════
function handleImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    // Build the whole thing in a scratch object first. Nothing touches
    // the live `lorebook` until we're sure the file is actually valid —
    // a failed import used to destroy whatever you had open.
    let staged, rebuildReport = null;
    try {
      const data = JSON.parse(ev.target.result);

      if (Array.isArray(data)) {
        throw new Error("That looks like a JanitorAI lorebook (a plain list). Use Import → JanitorAI instead.");
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Not a lorebook file.');
      }
      if (data.entries === undefined || data.entries === null) {
        throw new Error("No 'entries' found — this doesn't look like a SillyTavern lorebook.");
      }

      staged = data;
      if (!staged.name) staged.name = file.name.replace(/\.json$/i, '');
      if (typeof staged.entries !== 'object') throw new Error("'entries' should be a list or object of entries.");
      staged.entries = rebuildEntries(staged.entries);
      rebuildReport = rebuildEntries.lastReport;
    } catch(err) {
      toast('Import failed: ' + err.message, 'err');
      console.error(err);
      return; // your open lorebook is untouched
    }

    // Validated — now it's safe to swap in.
    lorebook = staged;
    g('lorebookName').value = lorebook.name;
    nextUid = Object.keys(lorebook.entries).length
      ? Math.max(...Object.keys(lorebook.entries).map(Number)) + 1
      : 0;

    openTabs = []; activeTabId = null; unsaved = new Set(); formState = {};
    renderList(); renderTabs(); renderEditor();
    saveToStorage();
    toast('Imported: ' + lorebook.name, 'ok');
    reportRebuild(rebuildReport);
  };
  r.readAsText(file);
  e.target.value = '';
}

function handleMergeImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const incoming = JSON.parse(ev.target.result);
      if (Array.isArray(incoming)) throw new Error('That looks like a JanitorAI lorebook — use Import → JanitorAI.');
      if (!incoming || incoming.entries === undefined) throw new Error("No 'entries' found in this file.");
      mergeStaging = incoming;
      if (!mergeStaging.name) mergeStaging.name = file.name.replace(/\.json$/i, '');
      mergeStaging.entries = rebuildEntries(mergeStaging.entries);
      const mergeReport = rebuildEntries.lastReport;
      mergeSelected = [];
      g('mergeCurrent').textContent = lorebook.name || 'Untitled';
      g('mergeFrom').textContent = mergeStaging.name;
      renderMergeList();
      openModal('mergeModal');
      reportRebuild(mergeReport);
    } catch(err) { toast('Merge import error: ' + err.message, 'err'); console.error(err); }
  };
  r.readAsText(file);
  e.target.value = '';
}

function exportJson() {
  lorebook.name = g('lorebookName').value.trim() || 'lorebook';
  const fn = safeFileName(lorebook.name, 'lorebook') + '.json';
  dlFile(JSON.stringify(lorebook, null, 2), fn, 'application/json');
  toast('Exported: ' + fn, 'ok');
}

// ═══════════════════════════════════════════════════════
// MERGE
// ═══════════════════════════════════════════════════════
function renderMergeList() {
  const list = g('mergeList');
  list.innerHTML = '';
  Object.values(mergeStaging.entries).sort((a,b)=>a.uid-b.uid).forEach(en => {
    const div = document.createElement('div');
    div.className = 'mi' + (mergeSelected.includes(en.uid) ? ' sel' : '');
    const head = document.createElement('div'); head.className = 'mi-head';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'mi-cb'; cb.checked = mergeSelected.includes(en.uid);
    cb.addEventListener('change', () => {
      const i = mergeSelected.indexOf(en.uid);
      if (i > -1) mergeSelected.splice(i,1); else mergeSelected.push(en.uid);
      renderMergeList();
    });
    const uid = document.createElement('div'); uid.className = 'mi-uid'; uid.textContent = '#' + en.uid;
    const name = document.createElement('div'); name.className = 'mi-name'; name.textContent = en.comment || 'Untitled';
    head.append(cb, uid, name);
    div.append(head);
    if (en.key && en.key.length) {
      const kws = document.createElement('div'); kws.className = 'mi-kws';
      en.key.slice(0,5).forEach(k => { const t=document.createElement('span'); t.className='kw-tag'; t.textContent=k; kws.append(t); });
      if (en.key.length > 5) { const t=document.createElement('span'); t.className='kw-tag'; t.textContent=`+${en.key.length-5}`; kws.append(t); }
      div.append(kws);
    }
    list.append(div);
  });
  g('mergeCountLbl').textContent = `${mergeSelected.length} selected`;
}

function executeMerge() {
  if (!mergeSelected.length) { toast('Select at least one entry.', 'warn'); return; }
  let maxUid = Math.max(-1, ...Object.values(lorebook.entries).map(e=>e.uid));
  let added = 0;
  mergeSelected.forEach(oldUid => {
    const src = mergeStaging.entries[oldUid]; if (!src) return;
    const ne = JSON.parse(JSON.stringify(src));
    const nu = maxUid + 1 + added;
    ne.uid = nu; ne.order = nu; ne.displayIndex = nu;
    lorebook.entries[nu] = ne; added++;
  });
  nextUid = maxUid + 1 + added;
  renderList(); closeModal('mergeModal'); saveToStorage();
  toast(`Merged ${added} entries.`, 'ok');
  mergeStaging = null; mergeSelected = [];
}

// ═══════════════════════════════════════════════════════
// EXPORT TEXT
// ═══════════════════════════════════════════════════════
// Strip XML/HTML tags and code blocks from content for clean text exports
function stripMarkup(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')        // fenced code blocks
    .replace(/`[^`\n]+`/g, '')             // inline code
    .replace(/<[^>]+>/g, '')               // xml/html tags
    .replace(/\n{3,}/g, '\n\n')            // collapse excess blank lines
    .trim();
}

function doExportTxt() {
  const opts = {
    titles: g('etTitles').checked, content: g('etContent').checked,
    primary: g('etPrimary').checked, secondary: g('etSecondary').checked,
    constants: g('etConstants').checked, comments: g('etComments').checked,
    order: g('etOrder').checked
  };
  const fn = g('etFilename').value || lorebook.name || 'lorebook';
  const name = g('lorebookName').value || 'Lorebook';
  const logicMap = {0:'AND ANY',1:'NOT ALL',2:'NOT ANY',3:'AND ALL'};
  let md = `# ${name}\n\n`;
  Object.values(lorebook.entries).sort((a,b)=>(a.order||999)-(b.order||999)).forEach((en,i) => {
    let h = `## ${i+1}. ${en.comment || 'Untitled Entry'}`;
    if (opts.constants) {
      const ind = [en.constant?'🔵':'', en.vectorized?'🔗':'', (en.selective&&en.keysecondary?.length)?'🟢':''].filter(Boolean);
      if (ind.length) h += ' ' + ind.join(' ');
    }
    if (opts.order) h += ` (Order: ${en.order})`;
    md += h + '\n\n';
    if (opts.primary && en.key?.length) md += `**Primary Keys:** ${en.key.join(', ')}\n\n`;
    if (opts.secondary && en.keysecondary?.length) md += `**Logic:** ${logicMap[en.selectiveLogic]||'AND ANY'}\n**Secondary Keys:** ${en.keysecondary.join(', ')}\n\n`;
    if (opts.content && en.content) md += `${stripMarkup(en.content)}\n\n`;
    if (opts.comments && en.comment && en.comment !== 'Untitled Entry') md += `**Notes:** ${en.comment}\n\n`;
    md += '---\n\n';
  });
  md += `*Exported from LoreOS — ${new Date().toLocaleDateString()}*\n`;
  dlFile(md, fn + '.txt', 'text/plain');
  closeModal('expTxtModal');
  toast('Exported text.', 'ok');
}

// ═══════════════════════════════════════════════════════
// EXPORT PUBLIC
// ═══════════════════════════════════════════════════════
function openPublicExport() {
  g('epFilename').value = (g('lorebookName').value || 'lorebook') + '-public';
  g('epPreview').style.display = 'none';
  openModal('expPubModal');
}

function genPublicMd() {
  const inclDis = g('epDisabled').checked;
  const inclKw = g('epKeywords').checked;
  const inclStatus = g('epStatus').checked;
  const name = g('lorebookName').value || 'Lorebook';
  let md = `# ${name}\n\n`;
  Object.values(lorebook.entries).sort((a,b)=>a.uid-b.uid)
    .filter(en => inclDis || !en.disable)
    .forEach(en => {
      let badge = '';
      if (inclStatus) badge = en.constant ? ' [CONSTANT]' : en.disable ? ' [DISABLED]' : '';
      md += `## ${en.comment || 'Untitled'}${badge}\n\n`;
      if (inclKw && en.key?.length) md += `**Keywords:** ${en.key.join(', ')}\n\n`;
      if (en.content) md += `${stripMarkup(en.content)}\n\n`;
      md += `---\n\n`;
    });
  md += `*${name} — exported from LoreOS*\n`;
  return md;
}

function previewPublic() {
  const md = genPublicMd();
  const prev = g('epPreview');
  prev.textContent = md.substring(0, 1500) + (md.length > 1500 ? '\n…[truncated]' : '');
  prev.style.display = 'block';
}

function doExportPublic() {
  const md = genPublicMd();
  const fn = g('epFilename').value || lorebook.name || 'lorebook';
  dlFile(md, fn + '.md', 'text/plain');
  closeModal('expPubModal');
  toast('Exported for public pages.', 'ok');
}
// ═══════════════════════════════════════════════════════
// MOBILE

// ═══════════════════════════════════════════════════════
// JANITORAI LOREBOOK IMPORT / EXPORT
//
// Real JanitorAI format (from raw character card source):
//   - flat array of entry objects (no wrapper)
//   - `key` is already an array (primary keywords)
//   - `keysecondary` is an array
//   - `insertion_order` (not `order`) for ordering
//   - `comment` is the display name
//   - JanitorAI-specific fields: activationMode, activationScript,
//     minMessages, keyMatchPriority, priority, inclusionGroupRaw,
//     keywordsRaw, keysRaw, keywordRaw — preserved in extensions
//
// Since JanitorAI has no export button, import supports both
// file upload and paste-from-clipboard via a modal.
// ═══════════════════════════════════════════════════════

function parseJanitorEntries(raw, sourceName) {
  // Accept: flat array, { entries: [...] }, or { data: { entries: [...] } }
  if (raw && raw.data) raw = raw.data;
  const entries = Array.isArray(raw) ? raw
    : (raw && Array.isArray(raw.entries)) ? raw.entries
    : null;
  if (!entries) return null;

  lorebook = { name: (raw && raw.name) || sourceName || 'janitor-import', entries: {} };
  nextUid = 0;

  entries.forEach((je, i) => {
    const uid = i;
    // JanitorAI key is already an array — keep as array to match ST internal format
    const keyArr = Array.isArray(je.key) ? je.key : (je.key ? String(je.key).split(',').map(k=>k.trim()).filter(Boolean) : []);
    const keysecArr = Array.isArray(je.keysecondary) ? je.keysecondary : (je.keysecondary ? String(je.keysecondary).split(',').map(k=>k.trim()).filter(Boolean) : []);

    // Preserve JanitorAI-specific fields in extensions so round-trip works
    const janitorExt = {};
    ['activationMode','activationScript','minMessages','keyMatchPriority',
     'priority','inclusionGroupRaw','keywordsRaw','keysRaw','keywordRaw',
     'category','prioritizeInclusion','name'].forEach(f => {
      if (je[f] !== undefined) janitorExt[f] = je[f];
    });

    lorebook.entries[uid] = {
      uid,
      key:           keyArr,       // array — matches ST internal format
      keysecondary:  keysecArr,    // array — matches ST internal format
      comment:       je.comment || je.name || '',
      content:       je.content || '',
      constant:      je.constant || false,
      selective:     keysecArr.length > 0,
      selectiveLogic: je.selectiveLogic ?? 0,
      enabled:       je.enabled !== false,
      order:         je.insertion_order ?? (i * 100),
      position:      je.position ?? 0,
      depth:         je.depth ?? 4,
      probability:   je.probability ?? 100,
      useProbability: (je.probability !== undefined && je.probability !== 100),
      matchWholeWords: je.matchWholeWords ?? false,
      caseSensitive:  je.case_sensitive ?? false,
      groupWeight:   je.groupWeight ?? 100,
      role:          je.role ?? null,
      extensions:    Object.assign({}, je.extensions || {}, { janitor: janitorExt }),
    };
    nextUid = Math.max(nextUid, uid + 1);
  });

  const lbName = (raw && raw.name) || sourceName || '';
  const nameEl = g('lorebookName');
  if (nameEl && lbName) nameEl.value = lbName;
  lorebook.name = lbName;

  openTabs = []; activeTabId = null; selectedEntries = [];
  renderList(); renderTabs(); renderEditor();
  return entries.length;
}

function handleJanitorImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      const count = parseJanitorEntries(raw, file.name.replace(/\.json$/i, ''));
      if (count === null) { toast('Unrecognised JanitorAI format.', 'err'); return; }
      toast(`Imported ${count} entries from JanitorAI lorebook.`, 'ok');
    } catch(err) {
      toast('Failed to parse JSON: ' + err.message, 'err');
    }
  };
  r.readAsText(file);
  e.target.value = '';
}

function openJanitorPasteModal() {
  openModal('janitorPasteModal');
  const ta = g('janitorPasteTA');
  if (ta) { ta.value = ''; ta.focus(); }
}

function handleJanitorPaste() {
  const ta = g('janitorPasteTA');
  if (!ta || !ta.value.trim()) { toast('Nothing pasted.', 'warn'); return; }
  try {
    const raw = JSON.parse(ta.value.trim());
    const count = parseJanitorEntries(raw, 'pasted-lorebook');
    if (count === null) { toast('Unrecognised JanitorAI format — expected a JSON array or object with entries.', 'err'); return; }
    closeModal('janitorPasteModal');
    toast(`Imported ${count} entries from pasted JanitorAI lorebook.`, 'ok');
  } catch(err) {
    toast('Invalid JSON: ' + err.message, 'err');
  }
}

function exportJanitorJson() {
  const name = g('lorebookName')?.value?.trim() || lorebook.name || 'lorebook';
  // Export as flat array matching real JanitorAI format
  const entries = Object.values(lorebook.entries)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e, i) => {
      // Restore any saved JanitorAI-specific fields
      const janitorExt = e.extensions?.janitor || {};
      return {
        activationMode:     janitorExt.activationMode     ?? 'standard',
        activationScript:   janitorExt.activationScript   ?? '',
        case_sensitive:     e.caseSensitive               ?? false,
        category:           janitorExt.category           ?? 'other',
        comment:            e.comment || '',
        constant:           e.constant || false,
        content:            e.content || '',
        enabled:            e.enabled !== false,
        extensions:         Object.fromEntries(
                              Object.entries(e.extensions || {}).filter(([k]) => k !== 'janitor')
                            ),
        groupWeight:        e.groupWeight ?? 100,
        id:                 e.uid,
        inclusionGroupRaw:  janitorExt.inclusionGroupRaw  ?? '',
        insertion_order:    e.order ?? (i * 100),
        // key as array
        key:                Array.isArray(e.key) ? e.key : (e.key ? e.key.split(',').map(k=>k.trim()).filter(Boolean) : []),
        keyMatchPriority:   janitorExt.keyMatchPriority   ?? false,
        keysecondary:       Array.isArray(e.keysecondary) ? e.keysecondary : (e.keysecondary ? e.keysecondary.split(',').map(k=>k.trim()).filter(Boolean) : []),
        keysecondaryRaw:    e.keysecondary || '',
        keysRaw:            Array.isArray(e.key) ? e.key.join(', ') : (e.key || ''),
        matchWholeWords:    e.matchWholeWords ?? false,
        minMessages:        janitorExt.minMessages        ?? 0,
        name:               janitorExt.name               ?? '',
        prioritizeInclusion: janitorExt.prioritizeInclusion ?? false,
        priority:           janitorExt.priority           ?? (i + 1),
        probability:        e.probability ?? 100,
        selectiveLogic:     e.selectiveLogic              ?? 0,
        keywordsRaw:        Array.isArray(e.key) ? e.key.join(', ') : (e.key || ''),
      };
    });
  const fn = safeFileName(name, 'lorebook') + '_janitor.json';
  // Export as flat array — the native JanitorAI format
  dlFile(JSON.stringify(entries, null, 2), fn, 'application/json');
  toast('Exported as JanitorAI lorebook (flat array format).', 'ok');
}


// ═══════════════════════════════════════════════════════
// SAUCEPANAI LOREBOOK IMPORT / EXPORT
//
// SaucepanAI format:
// {
//   id, author_id, name, short_description, image_id,
//   tags, access_level, nsfw, very_nsfw, ...metadata,
//   content: [{ title, text, id }, ...]
// }
// No keyword fields — purely chapter/narrative based.
// Import maps: title→comment, text→content (blank keywords)
// Export maps: comment→title, content→text, generates UUIDs
// ═══════════════════════════════════════════════════════

function handleSaucepanImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      const count = parseSaucepanData(raw, file.name.replace(/\.json$/i, ''));
      if (count === null) { toast('Unrecognised SaucepanAI lorebook format.', 'err'); return; }
      toast(`Imported ${count} entries from SaucepanAI lorebook.`, 'ok');
    } catch(err) {
      toast('Failed to parse JSON: ' + err.message, 'err');
    }
  };
  r.readAsText(file);
  e.target.value = '';
}

function parseSaucepanData(raw, sourceName) {
  if (!raw || !Array.isArray(raw.content)) return null;

  const lbName = raw.name || sourceName || 'saucepan-import';
  lorebook = { name: lbName, entries: {}, saucepanMeta: {
    id:                raw.id               || '',
    author_id:         raw.author_id        || '',
    short_description: raw.short_description|| '',
    image_id:          raw.image_id         || '',
    tags:              raw.tags             || [],
    access_level:      raw.access_level     || 'private',
    nsfw:              raw.nsfw             || false,
    very_nsfw:         raw.very_nsfw        || false,
    fandom_tags:       raw.fandom_tags      || [],
  }};
  nextUid = 0;

  raw.content.forEach((ch, i) => {
    lorebook.entries[i] = {
      uid:           i,
      key:           [],          // no keywords in saucepan
      keysecondary:  [],
      comment:       ch.title || `Entry ${i + 1}`,
      content:       ch.text  || '',
      constant:      false,
      selective:     false,
      selectiveLogic: 0,
      enabled:       true,
      order:         i * 100,
      position:      0,
      depth:         4,
      probability:   100,
      useProbability: false,
      role:          null,
      extensions:    { saucepan: { originalId: ch.id || '' } },
    };
    nextUid = i + 1;
  });

  const nameEl = g('lorebookName');
  if (nameEl) nameEl.value = lbName;
  lorebook.name = lbName;

  openTabs = []; activeTabId = null; selectedEntries = [];
  renderList(); renderTabs(); renderEditor();
  return raw.content.length;
}

function exportSaucepanJson() {
  const name = g('lorebookName')?.value?.trim() || lorebook.name || 'lorebook';
  const meta = lorebook.saucepanMeta || {};

  // Helper: generate a simple UUID-like string
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  const content = Object.values(lorebook.entries)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e, i) => ({
      title: e.comment || `Entry ${i + 1}`,
      text:  e.content || '',
      id:    e.extensions?.saucepan?.originalId || uuid(),
    }));

  const out = {
    id:                  meta.id            || uuid(),
    author_id:           meta.author_id     || '',
    name,
    short_description:   meta.short_description || '',
    content,
    access_level:        meta.access_level  || 'private',
    image_id:            meta.image_id      || '',
    nsfw:                meta.nsfw          || false,
    very_nsfw:           meta.very_nsfw     || false,
    tags:                meta.tags          || [],
    selected_chapter_index: 0,
    collaboration_type:  'private',
    has_been_public:     false,
    posted_at:           meta.posted_at     || new Date().toISOString().replace('T',' ').replace('Z',' +00:00:00'),
    updated_at:          new Date().toISOString().replace('T',' ').replace('Z',' +00:00:00'),
    hide_on_owner_profile: false,
    definition_protection: 'open',
    fandom_tags:         meta.fandom_tags   || [],
  };

  const fn = safeFileName(name, 'lorebook') + '_saucepan.json';
  dlFile(JSON.stringify(out, null, 2), fn, 'application/json');
  toast('Exported as SaucepanAI lorebook.', 'ok');
}
