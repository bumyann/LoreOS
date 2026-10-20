// ═══════════════════════════════════════════════════════
// LOREBOOK I/O — importing, merging and exporting lorebooks: SillyTavern JSON, plain
// text and public markdown, JanitorAI and SaucepanAI.
// ═══════════════════════════════════════════════════════

import { renderEditor, renderList, renderTabs } from './lorebook.js';
import { rebuildEntries, reportRebuild, splitKeywords } from './lorebook_model.js';
import { state } from './state.js';
import { loreActiveLibName, saveToStorage } from './storage.js';
import { askConfirm, closeModal, dlFile, g, openModal, registerMarkup, safeFileName, toast } from './util.js';

// ═══════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════
// Make `lb` the open lorebook. One place resets everything that belonged to the
// old one (tabs, selection, unsaved marks, form state), saves, and redraws, so
// every import path behaves the same.
export function adoptLorebook(lb) {
  state.lorebook = lb;
  const nameEl = g('lorebookName'); if (nameEl) nameEl.value = lb.name || '';
  const uids = Object.keys(lb.entries).map(Number);
  state.nextUid = uids.length ? Math.max(...uids) + 1 : 0;
  state.openTabs = []; state.activeTabId = null; state.selectedEntries = [];
  state.unsaved = new Set(); state.formState = {};
  renderList(); renderTabs(); renderEditor();
  saveToStorage();
}

// Importing replaces the open lorebook. If that one only exists here (not saved
// to the library, where edits are written through), ask first: it would be gone.
export async function confirmReplaceLorebook() {
  const n = Object.keys(state.lorebook.entries || {}).length;
  if (!n || loreActiveLibName()) return true;
  return askConfirm(`This replaces the lorebook you have open (${n} ${n === 1 ? 'entry' : 'entries'}), which isn't saved to your library. Import anyway?`);
}

export function handleImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
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

    // Validated — ask before replacing unsaved work, then it's safe to swap in.
    if (!(await confirmReplaceLorebook())) return;
    adoptLorebook(staged);
    toast('Imported: ' + state.lorebook.name, 'ok');
    reportRebuild(rebuildReport);
  };
  r.readAsText(file);
  e.target.value = '';
}

export function handleMergeImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const incoming = JSON.parse(ev.target.result);
      if (Array.isArray(incoming)) throw new Error('That looks like a JanitorAI lorebook — use Import → JanitorAI.');
      if (!incoming || incoming.entries === undefined) throw new Error("No 'entries' found in this file.");
      state.mergeStaging = incoming;
      if (!state.mergeStaging.name) state.mergeStaging.name = file.name.replace(/\.json$/i, '');
      state.mergeStaging.entries = rebuildEntries(state.mergeStaging.entries);
      const mergeReport = rebuildEntries.lastReport;
      state.mergeSelected = [];
      g('mergeCurrent').textContent = state.lorebook.name || 'Untitled';
      g('mergeFrom').textContent = state.mergeStaging.name;
      renderMergeList();
      openModal('mergeModal');
      reportRebuild(mergeReport);
    } catch(err) { toast('Merge import error: ' + err.message, 'err'); console.error(err); }
  };
  r.readAsText(file);
  e.target.value = '';
}

export function exportJson() {
  state.lorebook.name = g('lorebookName').value.trim() || 'lorebook';
  const fn = safeFileName(state.lorebook.name, 'lorebook') + '.json';
  dlFile(JSON.stringify(state.lorebook, null, 2), fn, 'application/json');
  toast('Exported: ' + fn, 'ok');
}

// ═══════════════════════════════════════════════════════
// MERGE
// ═══════════════════════════════════════════════════════
export function renderMergeList() {
  const list = g('mergeList');
  list.innerHTML = '';
  if (!state.mergeStaging) return; // dialog opened with no file chosen yet
  Object.values(state.mergeStaging.entries).sort((a,b)=>a.uid-b.uid).forEach(en => {
    const div = document.createElement('div');
    div.className = 'mi' + (state.mergeSelected.includes(en.uid) ? ' sel' : '');
    const head = document.createElement('div'); head.className = 'mi-head';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'mi-cb'; cb.checked = state.mergeSelected.includes(en.uid);
    cb.addEventListener('change', () => {
      const i = state.mergeSelected.indexOf(en.uid);
      if (i > -1) state.mergeSelected.splice(i,1); else state.mergeSelected.push(en.uid);
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
  g('mergeCountLbl').textContent = `${state.mergeSelected.length} selected`;
}

export function executeMerge() {
  if (!state.mergeSelected.length) { toast('Select at least one entry.', 'warn'); return; }
  let maxUid = Math.max(-1, ...Object.values(state.lorebook.entries).map(e=>e.uid));
  let added = 0;
  state.mergeSelected.forEach(oldUid => {
    const src = state.mergeStaging.entries[oldUid]; if (!src) return;
    const ne = JSON.parse(JSON.stringify(src));
    const nu = maxUid + 1 + added;
    ne.uid = nu; ne.order = nu; ne.displayIndex = nu;
    state.lorebook.entries[nu] = ne; added++;
  });
  state.nextUid = maxUid + 1 + added;
  renderList(); closeModal('mergeModal'); saveToStorage();
  toast(`Merged ${added} entries.`, 'ok');
  state.mergeStaging = null; state.mergeSelected = [];
}

// ═══════════════════════════════════════════════════════
// EXPORT TEXT
// ═══════════════════════════════════════════════════════
// Strip XML/HTML tags and code blocks from content for clean text exports
export function stripMarkup(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')        // fenced code blocks
    .replace(/`[^`\n]+`/g, '')             // inline code
    .replace(/<[^>]+>/g, '')               // xml/html tags
    .replace(/\n{3,}/g, '\n\n')            // collapse excess blank lines
    .trim();
}

export function doExportTxt() {
  const opts = {
    titles: g('etTitles').checked, content: g('etContent').checked,
    primary: g('etPrimary').checked, secondary: g('etSecondary').checked,
    constants: g('etConstants').checked, comments: g('etComments').checked,
    order: g('etOrder').checked
  };
  const fn = g('etFilename').value || state.lorebook.name || 'lorebook';
  const name = g('lorebookName').value || 'Lorebook';
  const logicMap = {0:'AND ANY',1:'NOT ALL',2:'NOT ANY',3:'AND ALL'};
  let md = `# ${name}\n\n`;
  Object.values(state.lorebook.entries).sort((a,b)=>(a.order ?? 999)-(b.order ?? 999)).forEach((en,i) => {
    let h = opts.titles ? `## ${i+1}. ${en.comment || 'Untitled Entry'}` : `## ${i+1}.`;
    if (opts.constants) {
      const ind = [en.constant?'◆':'', en.vectorized?'◈':'', (en.selective&&en.keysecondary?.length)?'●':''].filter(Boolean);
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
export function openPublicExport() {
  g('epFilename').value = (g('lorebookName').value || 'lorebook') + '-public';
  g('epPreview').style.display = 'none';
  openModal('expPubModal');
}

export function genPublicMd() {
  const inclDis = g('epDisabled').checked;
  const inclKw = g('epKeywords').checked;
  const inclStatus = g('epStatus').checked;
  const name = g('lorebookName').value || 'Lorebook';
  let md = `# ${name}\n\n`;
  Object.values(state.lorebook.entries).sort((a,b)=>a.uid-b.uid)
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

export function previewPublic() {
  const md = genPublicMd();
  const prev = g('epPreview');
  prev.textContent = md.substring(0, 1500) + (md.length > 1500 ? '\n…[truncated]' : '');
  prev.style.display = 'block';
}

export function doExportPublic() {
  const md = genPublicMd();
  const fn = g('epFilename').value || state.lorebook.name || 'lorebook';
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

// The same shapes parseJanitorEntries accepts, checked without touching anything
export function looksLikeJanitor(raw) {
  if (raw && raw.data) raw = raw.data;
  return Array.isArray(raw) || !!(raw && Array.isArray(raw.entries));
}

export function parseJanitorEntries(raw, sourceName) {
  // Accept: flat array, { entries: [...] }, or { data: { entries: [...] } }
  if (raw && raw.data) raw = raw.data;
  const entries = Array.isArray(raw) ? raw
    : (raw && Array.isArray(raw.entries)) ? raw.entries
    : null;
  if (!entries) return null;

  const lb = { name: (raw && raw.name) || sourceName || 'janitor-import', entries: {} };

  entries.forEach((je, i) => {
    const uid = i;
    // JanitorAI key is already an array — keep as array to match ST internal format
    const keyArr = Array.isArray(je.key) ? je.key : (je.key ? splitKeywords(je.key) : []);
    const keysecArr = Array.isArray(je.keysecondary) ? je.keysecondary : (je.keysecondary ? splitKeywords(je.keysecondary) : []);

    // Preserve JanitorAI-specific fields in extensions so round-trip works
    const janitorExt = {};
    ['activationMode','activationScript','minMessages','keyMatchPriority',
     'priority','inclusionGroupRaw','keywordsRaw','keysRaw','keywordRaw',
     'category','prioritizeInclusion','name'].forEach(f => {
      if (je[f] !== undefined) janitorExt[f] = je[f];
    });

    lb.entries[uid] = {
      uid,
      key:           keyArr,       // array — matches ST internal format
      keysecondary:  keysecArr,    // array — matches ST internal format
      comment:       je.comment || je.name || '',
      content:       je.content || '',
      constant:      je.constant || false,
      selective:     keysecArr.length > 0,
      selectiveLogic: je.selectiveLogic ?? 0,
      disable:       je.enabled === false, // JanitorAI's `enabled` is SillyTavern's inverse `disable`
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
  });

  lb.name = (raw && raw.name) || sourceName || '';
  lb.entries = rebuildEntries(lb.entries);
  adoptLorebook(lb);
  return entries.length;
}

export function handleJanitorImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      if (looksLikeJanitor(raw) && !(await confirmReplaceLorebook())) return;
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

export function openJanitorPasteModal() {
  openModal('janitorPasteModal');
  const ta = g('janitorPasteTA');
  if (ta) { ta.value = ''; ta.focus(); }
}

export async function handleJanitorPaste() {
  const ta = g('janitorPasteTA');
  if (!ta || !ta.value.trim()) { toast('Nothing pasted.', 'warn'); return; }
  try {
    const raw = JSON.parse(ta.value.trim());
    if (looksLikeJanitor(raw) && !(await confirmReplaceLorebook())) return;
    const count = parseJanitorEntries(raw, 'pasted-lorebook');
    if (count === null) { toast('Unrecognised JanitorAI format — expected a JSON array or object with entries.', 'err'); return; }
    closeModal('janitorPasteModal');
    toast(`Imported ${count} entries from pasted JanitorAI lorebook.`, 'ok');
  } catch(err) {
    toast('Invalid JSON: ' + err.message, 'err');
  }
}

export function exportJanitorJson() {
  const name = g('lorebookName')?.value?.trim() || state.lorebook.name || 'lorebook';
  // Export as flat array matching real JanitorAI format
  const entries = Object.values(state.lorebook.entries)
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
        enabled:            !e.disable,
        extensions:         Object.fromEntries(
                              Object.entries(e.extensions || {}).filter(([k]) => k !== 'janitor')
                            ),
        groupWeight:        e.groupWeight ?? 100,
        id:                 e.uid,
        inclusionGroupRaw:  janitorExt.inclusionGroupRaw  ?? '',
        insertion_order:    e.order ?? (i * 100),
        // key as array
        key:                Array.isArray(e.key) ? e.key : (e.key ? splitKeywords(e.key) : []),
        keyMatchPriority:   janitorExt.keyMatchPriority   ?? false,
        keysecondary:       Array.isArray(e.keysecondary) ? e.keysecondary : (e.keysecondary ? splitKeywords(e.keysecondary) : []),
        keysecondaryRaw:    Array.isArray(e.keysecondary) ? e.keysecondary.join(', ') : (e.keysecondary || ''),
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

export function handleSaucepanImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      if (raw && Array.isArray(raw.content) && !(await confirmReplaceLorebook())) return;
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

export function parseSaucepanData(raw, sourceName) {
  if (!raw || !Array.isArray(raw.content)) return null;

  const lbName = raw.name || sourceName || 'saucepan-import';
  const lb = { name: lbName, entries: {}, saucepanMeta: {
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

  raw.content.forEach((ch, i) => {
    lb.entries[i] = {
      uid:           i,
      key:           [],          // no keywords in saucepan
      keysecondary:  [],
      comment:       ch.title || `Entry ${i + 1}`,
      content:       ch.text  || '',
      constant:      false,
      selective:     false,
      selectiveLogic: 0,
      disable:       false,
      order:         i * 100,
      position:      0,
      depth:         4,
      probability:   100,
      useProbability: false,
      role:          null,
      extensions:    { saucepan: { originalId: ch.id || '' } },
    };
  });

  lb.entries = rebuildEntries(lb.entries);
  adoptLorebook(lb);
  return raw.content.length;
}

export function exportSaucepanJson() {
  const name = g('lorebookName')?.value?.trim() || state.lorebook.name || 'lorebook';
  const meta = state.lorebook.saucepanMeta || {};

  // Helper: generate a simple UUID-like string
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  const content = Object.values(state.lorebook.entries)
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

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(0, `<!-- Hidden file inputs -->
<input type="file" id="fileInput" accept=".json" style="display:none">`);

registerMarkup(10, `<input type="file" id="fileMergeInput" accept=".json" style="display:none">`);

registerMarkup(20, `<input type="file" id="fileSaucepanInput" accept=".json" style="display:none">`);

registerMarkup(90, `<!-- MERGE MODAL -->
<div id="mergeModal" class="modal">
  <div class="modal-box lg">
    <div class="modal-head"><h2>Merge Entries</h2><button class="modal-x" data-close="mergeModal">×</button></div>
    <div class="modal-body">
      <div class="merge-info">
        <p><strong>Current:</strong> <span id="mergeCurrent"></span></p>
        <p><strong>From:</strong> <span id="mergeFrom"></span></p>
        <p class="merge-note">Select entries to import. UIDs renumber automatically.</p>
      </div>
      <div class="merge-top">
        <button class="btn btn-s btn-sm" id="mergeSelAll">Select All</button>
        <button class="btn btn-s btn-sm" id="mergeDeselAll">Deselect All</button>
        <span class="merge-count-lbl" id="mergeCountLbl">0 selected</span>
      </div>
      <div id="mergeList" class="merge-list"></div>
      <div class="merge-bot">
        <button class="btn btn-s" data-close="mergeModal">Cancel</button>
        <button class="btn btn-ok" id="mergeConfirm">Merge Selected</button>
      </div>
    </div>
  </div>
</div>`);

registerMarkup(100, `<!-- EXPORT TEXT MODAL -->
<div id="expTxtModal" class="modal">
  <div class="modal-box">
    <div class="modal-head"><h2>Export as Text</h2><button class="modal-x" data-close="expTxtModal">×</button></div>
    <div class="modal-body">
      <div class="exp-opts">
        <h3>Include in export</h3>
        <label class="cb-row"><input type="checkbox" id="etTitles" checked><span class="flabel-sm">Entry Titles</span></label>
        <label class="cb-row"><input type="checkbox" id="etContent" checked><span class="flabel-sm">Entry Content</span></label>
        <label class="cb-row"><input type="checkbox" id="etPrimary" checked><span class="flabel-sm">Primary Keywords</span></label>
        <label class="cb-row"><input type="checkbox" id="etSecondary" checked><span class="flabel-sm">Secondary Keywords &amp; Logic</span></label>
        <label class="cb-row"><input type="checkbox" id="etConstants" checked><span class="flabel-sm">Constant/Extension Indicators</span></label>
        <label class="cb-row"><input type="checkbox" id="etComments"><span class="flabel-sm">Comments/Notes</span></label>
        <label class="cb-row"><input type="checkbox" id="etOrder"><span class="flabel-sm">Order Numbers</span></label>
        <div class="fg" style="margin-top:.5rem"><label class="flabel-sm">Filename</label><input type="text" id="etFilename" class="finput" placeholder="lorebook-backup"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-p" id="etExport">Export .txt</button>
        <button class="btn btn-s" data-close="expTxtModal">Cancel</button>
      </div>
    </div>
  </div>
</div>`);

registerMarkup(110, `<!-- EXPORT PUBLIC MODAL -->
<div id="expPubModal" class="modal">
  <div class="modal-box lg">
    <div class="modal-head"><h2>Export for Public Pages</h2><button class="modal-x" data-close="expPubModal">×</button></div>
    <div class="modal-body">
      <div class="exp-opts">
        <h3>Markdown options</h3>
        <label class="cb-row"><input type="checkbox" id="epDisabled"><span class="flabel-sm">Include disabled entries</span></label>
        <label class="cb-row"><input type="checkbox" id="epKeywords"><span class="flabel-sm">Include keyword tags</span></label>
        <label class="cb-row"><input type="checkbox" id="epStatus" checked><span class="flabel-sm">Show status badges</span></label>
        <div class="fg" style="margin-top:.5rem"><label class="flabel-sm">Filename (.md)</label><input type="text" id="epFilename" class="finput" placeholder="lorebook-public"></div>
      </div>
      <div id="epPreview" class="pub-prev" style="display:none"></div>
      <div class="modal-foot">
        <button class="btn btn-s" id="epPreviewBtn">Preview</button>
        <button class="btn btn-p" id="epExport">Download .md</button>
        <button class="btn btn-s" data-close="expPubModal">Cancel</button>
      </div>
    </div>
  </div>
</div>`);

registerMarkup(310, `<!-- JANITORAI PASTE MODAL -->
<div id="janitorPasteModal" class="modal">
  <div class="modal-box" style="max-width:600px">
    <div class="modal-head"><h2>Import JanitorAI Lorebook</h2><button class="modal-x" data-close="janitorPasteModal">×</button></div>
    <div class="modal-body">
      <div style="font-family:var(--fx);font-size:.72rem;color:var(--txm);letter-spacing:.4px;line-height:1.7;margin-bottom:.75rem">
        JanitorAI doesn't have an export button. To get your lorebook data:<br>
        1. Open the character card on JanitorAI<br>
        2. View the raw card source / inspect the lorebook JSON<br>
        3. Copy the full JSON array and paste it below.
      </div>
      <div class="fg">
        <label class="flabel">Paste JSON here</label>
        <textarea id="janitorPasteTA" class="ftextarea" style="min-height:220px;font-family:var(--fp);font-size:.82rem" placeholder="[ { &quot;comment&quot;: &quot;Entry name&quot;, &quot;key&quot;: [...], &quot;content&quot;: &quot;...&quot; }, ... ]"></textarea>
      </div>
      <input type="file" id="fileJanitorInput" accept=".json" style="display:none">
      <div class="modal-foot" style="margin-top:.75rem">
        <button class="btn btn-s" id="janitorPickFileBtn" title="Import a JanitorAI lorebook .json file (for example one exported from LoreOS) instead of pasting">Open a file instead</button>
        <button class="btn btn-s" data-close="janitorPasteModal">Cancel</button>
        <button class="btn btn-p" id="janitorPasteConfirmBtn">Import</button>
      </div>
    </div>
  </div>
</div>`);

