// ═══════════════════════════════════════════════════════
// CHARACTER I/O — importing and exporting character cards: SillyTavern JSON (V2/V3), PNG with
// the card embedded (V2 `chara` / V3 `ccv3`), .charx, and SaucepanAI.
// ═══════════════════════════════════════════════════════

import { downscaleAvatar } from './avatar.js';
import { lumiToScript, normalizeScript, scriptToLumi } from './regex_model.js';
import { charId, normalizeCharCard, openChar, renderCharSidebar, saveChar } from './character.js';
import { state } from './state.js';
import { saveCharLibrary } from './storage.js';
import { fromCompanion, toCompanion } from './adapters/saucepan.js';
import { dlFile, esc, openModal, registerMarkup, safeFileName, toast } from './util.js';
import { wsShowItem } from './workshop.js';

// ── Import / Export ──

export function handleCharImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'png') {
    const r = new FileReader();
    r.onload = ev => {
      try {
        const buf = new Uint8Array(ev.target.result);
        const cardData = extractCharFromPng(buf);
        if (!cardData) { toast('No character data found in this PNG.', 'err'); return; }
        // Also store the PNG itself as the character image
        const blob = new Blob([ev.target.result], { type: 'image/png' });
        const imgReader = new FileReader();
        imgReader.onload = imgEv => {
          importCharCard(cardData, file.name, imgEv.target.result);
        };
        imgReader.readAsDataURL(blob);
      } catch(err) { toast('PNG import error: ' + err.message, 'err'); console.error(err); }
    };
    r.readAsArrayBuffer(file);
  } else {
    const r = new FileReader();
    r.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        importCharCard(data, file.name);
      } catch(err) { toast('Import error: ' + err.message, 'err'); console.error(err); }
    };
    r.readAsText(file);
  }
  e.target.value = '';
}

export function handleCharCompanionImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      // The mapping lives in js/adapters/saucepan.js (SaucepanAI companion.json <-> a card)
      importCharCard(fromCompanion(JSON.parse(ev.target.result)), file.name);
    } catch(err) { toast('Companion import error: ' + err.message, 'err'); console.error(err); }
  };
  r.readAsText(file);
  e.target.value = '';
}

// A short list of what an export left out or still needs, for the export targets that cannot take every field
registerMarkup(251, `<div id="exportNotesModal" class="modal"><div class="modal-box" style="max-width:520px">
  <div class="modal-head"><h2 id="exportNotesTitle">Export notes</h2><button class="modal-x" data-close="exportNotesModal">×</button></div>
  <div class="modal-body"><ul id="exportNotesList" style="margin:0 0 .6rem 1.1rem;display:flex;flex-direction:column;gap:.45rem;font-size:.82rem"></ul>
  <div style="text-align:right"><button class="btn btn-s btn-sm" data-close="exportNotesModal">Got it</button></div></div></div></div>`);
export function showExportNotes(title, notes) {
  const list = document.getElementById('exportNotesList'); if (!list || !notes.length) return;
  document.getElementById('exportNotesTitle').textContent = title;
  list.innerHTML = notes.map(n => '<li>' + esc(n) + '</li>').join('');
  openModal('exportNotesModal');
}

// SaucepanAI companion.json
export function exportCharCompanion(id) {
  const entry = state.charLibrary[id]; if (!entry) return;
  commitBeforeExport(id);
  const { companion, notes } = toCompanion(entry.card.data);
  const fn = safeFileName(entry.card.data.name, 'character') + '_companion.json';
  dlFile(JSON.stringify(companion, null, 2), fn, 'application/json');
  toast('Exported for SaucepanAI: ' + fn, 'ok');
  showExportNotes('Before you upload to SaucepanAI', notes);
}

export function importCharCard(data, filename, imageData = null, extra = null) {
  let card;
  // Handle both wrapped (spec_version) and raw V1-style flat cards
  if (data.spec && data.data) {
    card = data;
  } else if (data.name !== undefined) {
    // Flat V1-style card — wrap it
    card = {
      spec: 'chara_card_v2', spec_version: '2.0',
      data: {
        name: data.name || '', description: data.description || '',
        personality: data.personality || '', scenario: data.scenario || '',
        first_mes: data.first_mes || '', mes_example: data.mes_example || '',
        creator_notes: data.creator_notes || '', system_prompt: data.system_prompt || '',
        post_history_instructions: data.post_history_instructions || '',
        alternate_greetings: (data.alternate_greetings || []).map(g => typeof g === 'object' ? g : { title: '', message: g }), tags: data.tags || [],
        creator: data.creator || '', character_version: data.character_version || '',
        extensions: data.extensions || {}, character_book: data.character_book || null
      }
    };
  } else {
    toast('Unrecognized character card format.', 'err');
    return;
  }
  normalizeCharCard(card);

  // Normalize alternate_greetings to {title, message} objects for internal use
  // (titles used by SaucepanAI export; ST keeps alternate_greetings as plain strings on export)
  card.data.alternate_greetings = (card.data.alternate_greetings || []).map(g =>
    typeof g === 'object' ? { title: g.title || '', message: g.message || g.content || '' } : { title: '', message: g || '' }
  );

  card.id = charId();
  state.charLibrary[card.id] = { id: card.id, name: card.data.name, card, imageData, savedAt: new Date().toISOString() };
  // Everything else a .charx carried (sprites, alternate avatars, modules...) rides along untouched
  if (extra && extra.charxFiles && extra.charxFiles.length) state.charLibrary[card.id].charxFiles = extra.charxFiles;
  if (extra && extra.lumiModules) state.charLibrary[card.id].lumiModules = extra.lumiModules;

  // Resize the avatar before it ever reaches storage, then save.
  Promise.resolve(downscaleAvatar(imageData)).then(small => {
    const before = (imageData || '').length;
    const after  = (small || '').length;
    if (small !== imageData) state.charLibrary[card.id].imageData = small;
    saveCharLibrary();
    renderCharSidebar();
    if (!wsShowItem('char', card.id)) openChar(card.id);
    const saving = before && after < before
      ? ` (avatar ${Math.round(before/1024)}KB → ${Math.round(after/1024)}KB)` : '';
    toast('Imported: ' + card.data.name + saving, 'ok');
  });
}

// Commit whatever is currently typed in the editor into the stored card.
// Every export path must call this first, or it ships stale data.
export function commitBeforeExport(id) {
  if (id && state.activeCharId === id) {
    saveChar({ silent: true });
  }
}

export function exportCharJson(id) {
  const entry = state.charLibrary[id]; if (!entry) return;
  commitBeforeExport(id);
  const fn = safeFileName(entry.card.data.name, 'character') + '.json';
  dlFile(JSON.stringify(toV3Card(entry.card), null, 2), fn, 'application/json');
  toast('Exported: ' + fn, 'ok');
}

// Build a clean chara_card_v2-shaped card from internal card data.
// Flattens alternate_greetings from internal {title,message} objects back to
// plain strings (V2 spec requires string[]) and drops LoreOS-internal fields
// (top-level `id`, greeting titles, etc.) that aren't part of the V2 spec.
// JanitorAI reads a card's `description` as the public bio and only `personality`
// as the character definition. For a Janitor export the definition therefore
// moves into `personality` (joined with any personality text) and the bio gets
// the creator notes, if there are any.
export function toJanitorData(d) {
  const def = [d.description, d.personality].map(x => (x || '').trim()).filter(Boolean).join('\n\n');
  return { ...d, description: d.creator_notes || '', personality: def };
}

// JanitorAI only reads the first message from an imported card, so the other greetings come as a
// markdown file next to it, ready to paste in.
export function janitorGreetingsMd(d) {
  const list = (d.alternate_greetings || []).map(g => (typeof g === 'object' && g ? { title: g.title || '', message: g.message || '' } : { title: '', message: g || '' })).filter(g => g.message.trim());
  if (!list.length) return '';
  return '# ' + (d.name || 'Character') + ': alternate greetings\n\n'
    + 'JanitorAI only imports the first message from a card. Paste these in by hand.\n\n'
    + list.map((g, i) => '---\n\n## ' + (i + 2) + '. ' + (g.title || 'Greeting ' + (i + 2)) + '\n\n' + g.message.trim() + '\n').join('\n');
}
export function downloadJanitorGreetings(d) {
  const md = janitorGreetingsMd(d); if (!md) return;
  // a moment after the card, so browsers treat it as a second download rather than a duplicate
  setTimeout(() => { dlFile(md, safeFileName(d.name, 'character') + '_janitor_greetings.md', 'text/markdown'); toast('Also saved the ' + (d.alternate_greetings || []).length + ' alternate greeting(s) as a .md to paste into JanitorAI.', 'info'); }, 500);
}

export function toV2Card(d) {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name:                     d.name || '',
      description:              d.description || '',
      personality:              d.personality || '',
      scenario:                 d.scenario || '',
      first_mes:                d.first_mes || '',
      mes_example:              d.mes_example || '',
      creator_notes:            d.creator_notes || '',
      system_prompt:            d.system_prompt || '',
      post_history_instructions:d.post_history_instructions || '',
      alternate_greetings:      (d.alternate_greetings || []).map(g => typeof g === 'object' ? (g.message || '') : (g || '')),
      tags:                     d.tags || [],
      creator:                  d.creator || '',
      character_version:        d.character_version || '',
      extensions:               d.extensions || {},
      ...(d.character_book ? { character_book: d.character_book } : {})
    }
  };
}

// Build a spec-clean chara_card_v3 from the internal card. The editor keeps one
// canonical card (stored as V3-shaped); every export derives its target format
// from it. Drops LoreOS-internal fields (top-level `id`, greeting titles) and
// guarantees the fields the V3 spec requires, which blank/imported cards lack.
export function toV3Card(card) {
  const d = (card && card.data) || {};
  const flat = a => (Array.isArray(a) ? a : []).map(g => typeof g === 'object' && g ? (g.message || '') : (g || ''));
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      ...d,
      name: d.name || '',
      alternate_greetings: flat(d.alternate_greetings),
      group_only_greetings: flat(d.group_only_greetings),
      tags: Array.isArray(d.tags) ? d.tags : [],
      extensions: d.extensions || {},
    }
  };
}

// Export as V2 JSON (chara_card_v2 / spec_version 2.0)
// Strips V3-only fields (group_only_greetings, assets, character_version) for max compat
export function exportCharJsonV2(id, { janitor = false } = {}) {
  const entry = state.charLibrary[id]; if (!entry) return;
  commitBeforeExport(id);
  const d = entry.card.data;
  const v2card = toV2Card(janitor ? toJanitorData(d) : d);
  const fn = safeFileName(d.name, 'character') + (janitor ? '_janitor' : '_v2') + '.json';
  dlFile(JSON.stringify(v2card, null, 2), fn, 'application/json');
  toast((janitor ? 'Exported for JanitorAI: ' : 'Exported V2: ') + fn, 'ok');
  if (janitor) downloadJanitorGreetings(d);
}

// ═══════════════════════════════════════════════════════
// CHARX IMPORT / EXPORT (Lumiverse format)
// .charx is a zip containing card.json + assets/icon/image/main.png
// Requires JSZip (loaded via CDN)
// ═══════════════════════════════════════════════════════

const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', json: 'application/json', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm' };
const extOf = p => (String(p).split('.').pop() || '').toLowerCase();

// Where an asset URI points inside the archive ("embeded://assets/x.png" is the spec's own spelling)
function assetPath(uri) {
  const m = String(uri || '').match(/^embed(?:e)?d:\/\/(.+)$/i);
  return m ? m[1].replace(/^\/+/, '') : '';
}

// Read a .charx: the card, its main picture, and every other file kept as it was.
export async function readCharx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const cardFile = zip.file('card.json');
  if (!cardFile) throw new Error('.charx is missing card.json');
  const cardData = JSON.parse(await cardFile.async('string'));
  const d = cardData.data || (cardData.data = {});

  // Main picture: the card's own icon asset, else the usual path, else any image under assets/icon
  let iconPath = '';
  (Array.isArray(d.assets) ? d.assets : []).forEach(a => {
    if (!iconPath && a && a.type === 'icon' && assetPath(a.uri) && zip.file(assetPath(a.uri))) iconPath = assetPath(a.uri);
  });
  if (!iconPath && zip.file('assets/icon/image/main.png')) iconPath = 'assets/icon/image/main.png';
  if (!iconPath) { const f = Object.keys(zip.files).find(n => /^assets\/icon\/.+\.(png|jpe?g|webp|gif)$/i.test(n)); if (f) iconPath = f; }
  let imageData = null;
  if (iconPath) {
    const b64 = await zip.file(iconPath).async('base64');
    imageData = 'data:' + (MIME_BY_EXT[extOf(iconPath)] || 'image/png') + ';base64,' + b64;
  }

  let lumiModules = null;
  const lumiFile = zip.file('lumiverse_modules.json');
  if (lumiFile) { try { lumiModules = JSON.parse(await lumiFile.async('string')); } catch (e) { lumiModules = null; } }

  // Every other file, byte for byte (the main picture is kept as the avatar instead)
  const charxFiles = [];
  for (const name of Object.keys(zip.files)) {
    const f = zip.files[name];
    if (f.dir || name === 'card.json' || name === 'lumiverse_modules.json' || name === iconPath) continue;
    charxFiles.push({ path: name, data: await f.async('base64') });
  }
  return { cardData, imageData, lumiModules, charxFiles, iconPath };
}

// What a .charx carried, in words
export function describeCharx(r) {
  const bits = [];
  const n = (re) => r.charxFiles.filter(f => re.test(f.path)).length;
  const emo = n(/emotion|expression|sprite/i), other = r.charxFiles.length - emo;
  if (emo) bits.push(emo + ' expression sprite' + (emo === 1 ? '' : 's'));
  if (other > 0) bits.push(other + ' other file' + (other === 1 ? '' : 's'));
  const book = r.cardData.data && r.cardData.data.character_book;
  if (book && (book.entries || []).length) bits.push('a lorebook (' + book.entries.length + ' entries)');
  const rx = (r.cardData.data && r.cardData.data.extensions && r.cardData.data.extensions.regex_scripts) || (r.lumiModules && r.lumiModules.regex_scripts);
  if (Array.isArray(rx) && rx.length) bits.push(rx.length + ' regex script' + (rx.length === 1 ? '' : 's'));
  if (r.lumiModules) bits.push('Lumiverse modules');
  return bits;
}

export function handleCharxImport(e) {
  const file = e.target.files[0]; if (!file) return;
  if (typeof JSZip === 'undefined') {
    toast('JSZip not loaded — check your connection.', 'err'); return;
  }
  const r = new FileReader();
  r.onload = ev => {
    readCharx(ev.target.result).then(res => {
      const { cardData, imageData, lumiModules, charxFiles } = res;
      // Character-bound regexes from a Lumiverse file become the card's own regex scripts (same place SillyTavern keeps them)
      if (lumiModules && Array.isArray(lumiModules.regex_scripts) && lumiModules.regex_scripts.length) {
        if (!cardData.data) cardData.data = {};
        if (!cardData.data.extensions) cardData.data.extensions = {};
        const have = Array.isArray(cardData.data.extensions.regex_scripts) ? cardData.data.extensions.regex_scripts : [];
        const key = x => (x.scriptName || x.name || '') + '\u0000' + (x.findRegex || x.find_regex || '');
        const seen = new Set(have.map(key));
        const fresh = lumiModules.regex_scripts.filter(x => x && typeof x === 'object').map(x => lumiToScript(x)).filter(x => !seen.has(key(x)));
        cardData.data.extensions.regex_scripts = [...have, ...fresh];
      }
      // Alternate fields stay readable in the card too
      if (lumiModules && lumiModules.alternate_fields) {
        if (!cardData.data) cardData.data = {};
        if (!cardData.data.extensions) cardData.data.extensions = {};
        cardData.data.extensions._lumiverse = { alternate_fields: lumiModules.alternate_fields };
      }
      importCharCard(cardData, file.name, imageData, { charxFiles, lumiModules });
      const bits = describeCharx(res);
      toast('Imported .charx: ' + (cardData.data && cardData.data.name || file.name) + (bits.length ? ' (with ' + bits.join(', ') + ')' : ''), 'ok');
    }).catch(err => toast('.charx import error: ' + err.message, 'err'));
  };
  r.readAsArrayBuffer(file);
  e.target.value = '';
}

export function exportCharCharx(id) {
  const entry = state.charLibrary[id]; if (!entry) return;
  if (typeof JSZip === 'undefined') {
    toast('JSZip not loaded — check your connection.', 'err'); return;
  }

  // Make sure card is saved first
  commitBeforeExport(id);

  const zip = new JSZip();
  const v3 = toV3Card(entry.card);
  if (entry.imageData) {
    // The main picture always goes to assets/icon/image/main.png, so the card's icon entry must say so
    const rest = (Array.isArray(v3.data.assets) ? v3.data.assets : []).filter(a => !(a && a.type === 'icon'));
    v3.data.assets = [{ type: 'icon', uri: 'embeded://assets/icon/image/main.png', name: 'main', ext: 'png' }, ...rest];
  }
  zip.file('card.json', JSON.stringify(v3, null, 2));

  const name = safeFileName(entry.card.data.name, 'character');

  // Everything the file came with goes back in, untouched
  (entry.charxFiles || []).forEach(f => zip.file(f.path, f.data, { base64: true }));
  const lumiAltFields = entry.card.data?.extensions?._lumiverse?.alternate_fields;
  const hasLumiVariants = lumiAltFields && Object.values(lumiAltFields).some(arr => arr && arr.length > 0);
  const cardRegex = entry.card.data?.extensions?.regex_scripts;
  const hasCardRegex = Array.isArray(cardRegex) && cardRegex.length > 0;
  if (entry.lumiModules || hasLumiVariants || hasCardRegex) {
    const lumiModules = { version: 1, ...(entry.lumiModules || {}) };
    if (hasLumiVariants) lumiModules.alternate_fields = lumiAltFields;
    // The card's regex scripts travel in both places: the card (SillyTavern) and the modules file (Lumiverse)
    if (hasCardRegex) lumiModules.regex_scripts = cardRegex.map((x, i) => { const o = scriptToLumi(normalizeScript(x), i); o.metadata = { source: 'charx_bundle', ...(o.metadata || {}) }; return o; });
    zip.file('lumiverse_modules.json', JSON.stringify(lumiModules, null, 2));
  }

  const finish = () => {
    zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name + '.charx';
      document.body.append(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Exported .charx: ' + name + (entry.charxFiles && entry.charxFiles.length ? ' (with ' + entry.charxFiles.length + ' extra files)' : ''), 'ok');
    }).catch(err => toast('.charx export error: ' + err.message, 'err'));
  };

  if (entry.imageData) {
    // Stored avatars are often WebP (see AVATAR SIZING), but .charx wants a
    // real PNG at main.png, so convert unless it already is one.
    dataUrlToPngArrayBuffer(entry.imageData).then(ab => {
      // Strip leftover text metadata (generation prompts, LoRA/checkpoint names
      // from the source image): .charx keeps card data in card.json
      zip.folder('assets/icon/image').file('main.png', stripExistingCharaChunks(new Uint8Array(ab)));
      finish();
    }).catch(err => toast('.charx image error: ' + err.message, 'err'));
  } else {
    // No image stored — export without image
    finish();
  }
}

// ── PNG character card embed / extract ──
// Character data is stored in a tEXt chunk keyword "chara" as base64 JSON.

// Converts a base64 data URL to a PNG ArrayBuffer, auto-converting via
// canvas if the source isn't already PNG (e.g. stored as JPEG/WebP).
export function dataUrlToPngArrayBuffer(dataUrl) {
  return new Promise((resolve, reject) => {
    const b64 = dataUrl.split(',')[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const pngSig = [137,80,78,71,13,10,26,10];
    if (pngSig.every((b, i) => bytes[i] === b)) {
      resolve(bytes.buffer);
      return;
    }

    // Not PNG — convert via canvas
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas PNG conversion failed')); return; }
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Could not load stored image for conversion'));
    img.src = dataUrl;
  });
}

export function openCharPngExport(id, forceV2 = true, { janitor = false } = {}) {
  const entry = state.charLibrary[id]; if (!entry) return;
  commitBeforeExport(id);

  const doExport = (arrayBuf) => {
    try {
      const buf = new Uint8Array(arrayBuf);
      // V2: one `chara` chunk. V3: `ccv3` (the V3 card) plus a V2 `chara` chunk
      // so older readers still find something, as SillyTavern does.
      const outBuf = forceV2
        ? embedCharInPng(buf, toV2Card(janitor ? toJanitorData(entry.card.data) : entry.card.data))
        : embedCharInPng(buf, toV2Card(entry.card.data), toV3Card(entry.card));
      const blob = new Blob([outBuf], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFileName(entry.card.data.name, 'character') + (janitor ? '_janitor' : forceV2 ? '_v2' : '_v3') + '.png';
      document.body.append(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast((janitor ? 'JanitorAI' : forceV2 ? 'V2' : 'V3') + ' PNG card exported!', 'ok');
      if (janitor) downloadJanitorGreetings(entry.card.data);
    } catch(err) { toast('PNG export error: ' + err.message, 'err'); console.error(err); }
  };

  if (entry.imageData) {
    dataUrlToPngArrayBuffer(entry.imageData).then(doExport).catch(err => {
      toast('Image conversion error: ' + err.message, 'err');
      console.error(err);
    });
  } else {
    // No stored image — ask user to pick one
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      // Convert to PNG via canvas if not already PNG
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          blob.arrayBuffer().then(doExport);
        }, 'image/png');
      };
      img.src = url;
    };
    input.click();
    toast('No image set — pick one to use as the card base.', 'info');
  }
}

export function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function u32be(n) {
  return new Uint8Array([(n>>>24)&255, (n>>>16)&255, (n>>>8)&255, n&255]);
}

export function strToBytes(s) {
  return new Uint8Array([...s].map(c => c.charCodeAt(0)));
}

// One tEXt chunk: length + "tEXt" + keyword\0base64(json) + crc
export function buildTextChunk(keyword, obj) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  const textBytes = strToBytes(keyword + '\0' + b64);
  const typeBytes = strToBytes('tEXt');
  const chunkBody = new Uint8Array(typeBytes.length + textBytes.length);
  chunkBody.set(typeBytes, 0);
  chunkBody.set(textBytes, typeBytes.length);
  const chunk = new Uint8Array(4 + 4 + textBytes.length + 4);
  chunk.set(u32be(textBytes.length), 0);
  chunk.set(typeBytes, 4);
  chunk.set(textBytes, 8);
  chunk.set(u32be(crc32(chunkBody)), 8 + textBytes.length);
  return chunk;
}

// `card` goes in the `chara` chunk; `v3card`, when given, also goes in `ccv3`
export function embedCharInPng(pngBuf, card, v3card) {
  // Validate PNG signature
  const sig = [137,80,78,71,13,10,26,10];
  for (let i = 0; i < 8; i++) if (pngBuf[i] !== sig[i]) throw new Error('Not a valid PNG file');

  const chunks = [buildTextChunk('chara', card)];
  if (v3card) chunks.push(buildTextChunk('ccv3', v3card));
  const newLen = chunks.reduce((n, c) => n + c.length, 0);

  // Find insertion point: right after IHDR chunk (first chunk after the 8-byte signature)
  const ihdrLen = (pngBuf[8]<<24 | pngBuf[9]<<16 | pngBuf[10]<<8 | pngBuf[11]) >>> 0;
  const insertAt = 8 + 4 + 4 + ihdrLen + 4; // sig + len + type + data + crc

  // Remove any existing text chunks first
  const stripped = stripExistingCharaChunks(pngBuf);
  const adjInsertAt = Math.min(insertAt, stripped.length);

  const out = new Uint8Array(stripped.length + newLen);
  out.set(stripped.subarray(0, adjInsertAt), 0);
  let off = adjInsertAt;
  chunks.forEach(c => { out.set(c, off); off += c.length; });
  out.set(stripped.subarray(adjInsertAt), off);
  return out;
}

// Strips ALL text metadata chunks (tEXt/zTXt/iTXt) — not just chara/ccv3.
// Source images (e.g. from ComfyUI/A1111) often carry their own generation
// metadata (prompt, workflow, LoRA/checkpoint names) baked in as tEXt chunks.
// None of that belongs in an exported character card, so we clear it all
// before embedding our own "chara" chunk.
export function stripExistingCharaChunks(buf) {
  const out = [];
  let pos = 8;
  out.push(buf.subarray(0, 8));
  while (pos < buf.length) {
    const len = (buf[pos]<<24 | buf[pos+1]<<16 | buf[pos+2]<<8 | buf[pos+3]) >>> 0;
    const type = String.fromCharCode(buf[pos+4], buf[pos+5], buf[pos+6], buf[pos+7]);
    const chunkTotal = 4 + 4 + len + 4;
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      pos += chunkTotal;
      continue; // skip all text metadata chunks, regardless of keyword
    }
    out.push(buf.subarray(pos, pos + chunkTotal));
    pos += chunkTotal;
  }
  // Concatenate
  let total = 0; out.forEach(p => total += p.length);
  const result = new Uint8Array(total);
  let off = 0;
  out.forEach(p => { result.set(p, off); off += p.length; });
  return result;
}

// Reads every tEXt chunk and returns the card. V3 PNGs carry the V3 card in
// `ccv3` (and often a V2 copy in `chara`); prefer ccv3, fall back to chara.
export function extractCharFromPng(buf) {
  const sig = [137,80,78,71,13,10,26,10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('Not a valid PNG file');
  let pos = 8;
  const found = {};
  while (pos + 8 <= buf.length) {
    const len = (buf[pos]<<24 | buf[pos+1]<<16 | buf[pos+2]<<8 | buf[pos+3]) >>> 0;
    const type = String.fromCharCode(buf[pos+4], buf[pos+5], buf[pos+6], buf[pos+7]);
    if (type === 'tEXt') {
      let kwEnd = pos + 8;
      const chunkEnd = pos + 8 + len;
      while (kwEnd < chunkEnd && buf[kwEnd] !== 0) kwEnd++;
      const keyword = String.fromCharCode(...buf.subarray(pos+8, kwEnd));
      if (keyword === 'chara' || keyword === 'ccv3') {
        // TextDecoder instead of spread into fromCharCode — spread blows
        // the call stack on large PNGs (maximum call stack size exceeded)
        const b64 = new TextDecoder('latin1').decode(buf.subarray(kwEnd+1, chunkEnd));
        try { found[keyword] = JSON.parse(decodeURIComponent(escape(atob(b64)))); }
        catch (e) { if (keyword === 'ccv3' && !found.chara) throw e; }
      }
    }
    if (type === 'IEND') break;
    pos += 4 + 4 + len + 4;
  }
  return found.ccv3 || found.chara || null;
}
