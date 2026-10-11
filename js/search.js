// ═══════════════════════════════════════════════════════
// SEARCH & REPLACE across the open lorebook.
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// SEARCH & REPLACE
// ═══════════════════════════════════════════════════════
function buildPattern() {
  const text = g('srFind').value;
  const cs = g('srCase').checked;
  const ww = g('srWhole').checked;
  const rx = g('srRegex').checked;
  if (!text) return null;
  try {
    if (rx) return new RegExp(text, 'g' + (cs ? '' : 'i'));
    let esc = text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if (ww) esc = `\\b${esc}\\b`;
    return new RegExp(esc, 'g' + (cs ? '' : 'i'));
  } catch(e) { toast('Invalid regex: ' + e.message, 'err'); return null; }
}

function doSearch() {
  const pat = buildPattern(); if (!pat) return;
  const scope = g('srScope').value;
  searchResults = [];
  Object.entries(lorebook.entries).forEach(([uid, en]) => {
    const fields = {};
    if (scope === 'content' || scope === 'all') fields.content = en.content || '';
    if (scope === 'keywords' || scope === 'all') { fields.primaryKeywords = (en.key||[]).join(', '); fields.secondaryKeywords = (en.keysecondary||[]).join(', '); }
    if (scope === 'names' || scope === 'all') fields.name = en.comment || '';
    Object.entries(fields).forEach(([field, text]) => {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(text)) !== null) {
        searchResults.push({ uid, entryName: en.comment || '(Untitled)', field, matchText: m[0], startIndex: m.index, fullText: text });
      }
    });
  });
  searchIdx = 0;
  renderSearchResults();
}

function renderSearchResults() {
  const res = g('srResults'); const list = g('srResultsList'); const head = g('srResultsHead');
  res.style.display = 'block';
  head.textContent = searchResults.length === 0 ? 'No matches found' : `Found ${searchResults.length} match${searchResults.length===1?'':'es'}`;
  list.innerHTML = '';
  searchResults.forEach((r, i) => {
    const ctx_s = Math.max(0, r.startIndex - 20);
    const ctx_e = Math.min(r.fullText.length, r.startIndex + r.matchText.length + 20);
    const ctx = (ctx_s > 0 ? '…' : '') + r.fullText.substring(ctx_s, ctx_e) + (ctx_e < r.fullText.length ? '…' : '');
    const div = document.createElement('div'); div.className = 'sr-item';
    div.innerHTML = `<div class="sr-item-t"><strong>${esc(r.entryName)}</strong> (${esc(r.field)})<br><code>${esc(ctx)}</code></div><div class="sr-item-loc">#${r.uid}</div>`;
    div.addEventListener('click', () => { openInTab(parseInt(r.uid)); searchIdx = i; });
    list.append(div);
  });
}

function doReplaceOne() {
  if (!searchResults.length) { toast('Search first.', 'warn'); return; }
  const pat = buildPattern(); if (!pat) return;
  const r = searchResults[searchIdx];
  const en = lorebook.entries[r.uid]; if (!en) return;
  const repTxt = g('srReplace').value;
  const singlePat = new RegExp(pat.source, pat.flags.replace('g',''));
  if (r.field === 'content') en.content = en.content.replace(singlePat, repTxt);
  else if (r.field === 'name') en.comment = en.comment.replace(singlePat, repTxt);
  else if (r.field === 'primaryKeywords') en.key = en.key.map(k => k.replace(singlePat, repTxt));
  else if (r.field === 'secondaryKeywords') en.keysecondary = en.keysecondary.map(k => k.replace(singlePat, repTxt));
  unsaved.add(r.uid);
  searchResults.splice(searchIdx, 1);
  if (searchIdx >= searchResults.length && searchIdx > 0) searchIdx--;
  renderList(); renderTabs(); if (activeTabId === parseInt(r.uid)) renderEditor();
  renderSearchResults();
  toast('Replaced 1 occurrence.', 'ok');
}

async function doReplaceAll() {
  if (!searchResults.length) { toast('Search first.', 'warn'); return; }
  if (!await askConfirm(`Replace all ${searchResults.length} occurrences?`)) return;
  const pat = buildPattern(); if (!pat) return;
  const repTxt = g('srReplace').value;
  const changed = new Set();
  searchResults.forEach(r => {
    const en = lorebook.entries[r.uid]; if (!en) return;
    if (r.field === 'content') { en.content = en.content.replace(pat, repTxt); }
    else if (r.field === 'name') { en.comment = en.comment.replace(pat, repTxt); }
    else if (r.field === 'primaryKeywords') en.key = en.key.map(k => k.replace(pat, repTxt));
    else if (r.field === 'secondaryKeywords') en.keysecondary = en.keysecondary.map(k => k.replace(pat, repTxt));
    changed.add(r.uid);
  });
  changed.forEach(uid => unsaved.add(uid));
  const n = searchResults.length; searchResults = []; searchIdx = 0;
  g('srResults').style.display = 'none';
  renderList(); renderTabs(); renderEditor();
  toast(`Replaced ${n} occurrence${n===1?'':'s'}.`, 'ok');
}
