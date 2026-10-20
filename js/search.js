// ═══════════════════════════════════════════════════════
// SEARCH & REPLACE across the open lorebook.
// ═══════════════════════════════════════════════════════

import { openInTab, renderEditor, renderList, renderTabs } from './lorebook.js';
import { state } from './state.js';
import { loreSnapshotSoon, saveToStorage } from './storage.js';
import { askConfirm, esc, g, registerMarkup, toast } from './util.js';
import { commitActiveEditor } from './workshop.js';

// ═══════════════════════════════════════════════════════
// SEARCH & REPLACE
// ═══════════════════════════════════════════════════════
export function buildPattern() {
  const text = g('srFind').value;
  const cs = g('srCase').checked;
  const ww = g('srWhole').checked;
  const rx = g('srRegex').checked;
  if (!text) return null;
  const flags = 'g' + (cs ? '' : 'i');
  try {
    if (rx) return new RegExp(text, flags);
    const lit = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!ww) return new RegExp(lit, flags);
    // Whole words: \b only understands A-Z, so a Japanese or accented word never
    // matched. Look at the neighbouring characters instead (any letter or digit).
    try { return new RegExp(`(?<![\\p{L}\\p{N}_])${lit}(?![\\p{L}\\p{N}_])`, flags + 'u'); }
    catch (e) { return new RegExp(`\\b${lit}\\b`, flags); } // very old browsers
  } catch(e) { toast('Invalid regex: ' + e.message, 'err'); return null; }
}

// The text fields searched for each entry, per the "Search in" choice
function searchFields(en, scope) {
  const fields = {};
  if (scope === 'content' || scope === 'all') fields.content = en.content || '';
  if (scope === 'keywords' || scope === 'all') { fields.primaryKeywords = (en.key||[]).join(', '); fields.secondaryKeywords = (en.keysecondary||[]).join(', '); }
  if (scope === 'names' || scope === 'all') fields.name = en.comment || '';
  return fields;
}

// Search runs on what's actually in the entries, so anything typed into an open
// entry is saved first (otherwise results would describe text that is gone, or
// miss what's on screen)
export function doSearch() {
  const pat = buildPattern(); if (!pat) return;
  commitActiveEditor();
  const scope = g('srScope').value;
  state.searchResults = [];
  Object.entries(state.lorebook.entries).forEach(([uid, en]) => {
    Object.entries(searchFields(en, scope)).forEach(([field, text]) => {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(text)) !== null) {
        state.searchResults.push({ uid, entryName: en.comment || '(Untitled)', field, matchText: m[0], startIndex: m.index, fullText: text });
        if (m[0] === '') pat.lastIndex++; // an empty match must not loop forever
      }
    });
  });
  state.searchIdx = 0;
  renderSearchResults();
}

export function renderSearchResults() {
  const res = g('srResults'); const list = g('srResultsList'); const head = g('srResultsHead');
  res.style.display = 'block';
  head.textContent = state.searchResults.length === 0 ? 'No matches found' : `Found ${state.searchResults.length} match${state.searchResults.length===1?'':'es'}`;
  list.innerHTML = '';
  state.searchResults.forEach((r, i) => {
    const ctx_s = Math.max(0, r.startIndex - 20);
    const ctx_e = Math.min(r.fullText.length, r.startIndex + r.matchText.length + 20);
    const ctx = (ctx_s > 0 ? '…' : '') + r.fullText.substring(ctx_s, ctx_e) + (ctx_e < r.fullText.length ? '…' : '');
    const div = document.createElement('div'); div.className = 'sr-item';
    div.innerHTML = `<div class="sr-item-t"><strong>${esc(r.entryName)}</strong> (${esc(r.field)})<br><code>${esc(ctx)}</code></div><div class="sr-item-loc">#${r.uid}</div>`;
    div.addEventListener('click', () => { openInTab(parseInt(r.uid)); state.searchIdx = i; });
    list.append(div);
  });
}

// Replace the n-th match (0-based) of `pat` in `text`
function replaceNth(text, pat, rep, n) {
  let i = -1;
  return text.replace(pat, (...a) => {
    i++;
    if (i !== n) return a[0];
    // expand $1, $&, $<name> the way String.replace would for this single match
    const groups = typeof a[a.length - 1] === 'object' ? a[a.length - 1] : null;
    const caps = a.slice(1, a.length - (groups ? 3 : 2));
    return rep.replace(/\$(\$|&|\d{1,2}|<[^>]+>)/g, (m, t) => t === '$' ? '$' : t === '&' ? a[0] : t[0] === '<' ? ((groups && groups[t.slice(1, -1)]) || '') : (caps[parseInt(t, 10) - 1] ?? m));
  });
}

// A change made straight to an entry's data: the entry's open form (if any) is
// now out of date, so drop it, then save. Without this the form would show the
// old text and autosave would write it back over the replacement.
function afterDirectEdit(uids) {
  uids.forEach(uid => { state.unsaved.delete(uid); delete state.formState[uid]; });
  saveToStorage();
  loreSnapshotSoon();
  renderList(); renderTabs(); renderEditor();
}

export function doReplaceOne() {
  if (!state.searchResults.length) { toast('Search first.', 'warn'); return; }
  const pat = buildPattern(); if (!pat) return;
  commitActiveEditor();
  const r = state.searchResults[state.searchIdx];
  const en = state.lorebook.entries[r.uid]; if (!en) return;
  const repTxt = g('srReplace').value;
  // which match of this field is it? (results are in order, so count the earlier ones)
  let n = 0;
  for (let i = 0; i < state.searchIdx; i++) if (state.searchResults[i].uid === r.uid && state.searchResults[i].field === r.field) n++;
  if (r.field === 'content') en.content = replaceNth(en.content || '', pat, repTxt, n);
  else if (r.field === 'name') en.comment = replaceNth(en.comment || '', pat, repTxt, n);
  else {
    const prop = r.field === 'primaryKeywords' ? 'key' : 'keysecondary';
    let left = n;
    en[prop] = (en[prop] || []).map(k => {
      const cnt = (k.match(new RegExp(pat.source, pat.flags)) || []).length;
      if (left < 0 || cnt === 0) return k;
      if (left < cnt) { const out = replaceNth(k, pat, repTxt, left); left = -1; return out; }
      left -= cnt; return k;
    });
  }
  afterDirectEdit([r.uid]);
  doSearch(); // positions have shifted: search again so the list is true
  toast('Replaced 1 occurrence.', 'ok');
}

export async function doReplaceAll() {
  if (!state.searchResults.length) { toast('Search first.', 'warn'); return; }
  if (!await askConfirm(`Replace all ${state.searchResults.length} occurrences?`)) return;
  const pat = buildPattern(); if (!pat) return;
  commitActiveEditor();
  const repTxt = g('srReplace').value;
  const scope = g('srScope').value;
  const changed = new Set(); let n = 0;
  Object.entries(state.lorebook.entries).forEach(([uid, en]) => {
    const count = t => { pat.lastIndex = 0; const m = String(t).match(pat); return m ? m.length : 0; };
    const f = searchFields(en, scope);
    if ('content' in f && count(en.content || '')) { n += count(en.content || ''); en.content = (en.content || '').replace(pat, repTxt); changed.add(uid); }
    if ('name' in f && count(en.comment || '')) { n += count(en.comment || ''); en.comment = (en.comment || '').replace(pat, repTxt); changed.add(uid); }
    if ('primaryKeywords' in f && (en.key || []).some(k => count(k))) { (en.key || []).forEach(k => { n += count(k); }); en.key = en.key.map(k => k.replace(pat, repTxt)); changed.add(uid); }
    if ('secondaryKeywords' in f && (en.keysecondary || []).some(k => count(k))) { (en.keysecondary || []).forEach(k => { n += count(k); }); en.keysecondary = en.keysecondary.map(k => k.replace(pat, repTxt)); changed.add(uid); }
  });
  state.searchResults = []; state.searchIdx = 0;
  g('srResults').style.display = 'none';
  afterDirectEdit(changed);
  toast(`Replaced ${n} occurrence${n===1?'':'s'}.`, 'ok');
}

// ═══════════════════════════════════════════════════════
// MARKUP — dialogs and fixed elements this module owns. They are registered
// here and injected into the page by main.js, in page order, before the app is
// wired up.
// ═══════════════════════════════════════════════════════
registerMarkup(80, `<!-- SEARCH & REPLACE MODAL -->
<div id="srModal" class="modal">
  <div class="modal-box lg">
    <div class="modal-head"><h2>Find &amp; Replace</h2><button class="modal-x" data-close="srModal">×</button></div>
    <div class="modal-body">
      <div class="sr-opts">
        <div class="fg"><label class="flabel">Find</label><input type="text" id="srFind" class="finput" placeholder="Search text..." autocomplete="off"></div>
        <div class="fg"><label class="flabel">Replace with</label><input type="text" id="srReplace" class="finput" placeholder="Replacement..." autocomplete="off"></div>
        <div class="fg"><label class="flabel">Search in</label>
          <select id="srScope" class="fselect">
            <option value="content">Content Only</option>
            <option value="keywords">Keywords Only</option>
            <option value="names">Entry Names Only</option>
            <option value="all">All Fields</option>
          </select>
        </div>
        <label class="cb-row"><input type="checkbox" id="srCase"><span class="flabel-sm">Match Case</span></label>
        <label class="cb-row"><input type="checkbox" id="srWhole"><span class="flabel-sm">Whole Words Only</span></label>
        <label class="cb-row"><input type="checkbox" id="srRegex"><span class="flabel-sm">Use Regex</span></label>
      </div>
      <div class="sr-actions">
        <button class="btn btn-p" id="srFindAll">Find All</button>
        <button class="btn btn-s" id="srReplaceOne">Replace Next</button>
        <button class="btn btn-err" id="srReplaceAll">Replace All</button>
      </div>
      <div id="srResults" style="display:none" class="sr-results">
        <div id="srResultsHead" class="sr-rhead"></div>
        <div id="srResultsList" class="sr-list"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-s" data-close="srModal">Close</button></div>
    </div>
  </div>
</div>`);

