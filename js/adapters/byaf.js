// ═══════════════════════════════════════════════════════
// BACKYARD AI adapter — the .byaf archive (a zip with manifest.json, one character and its scenarios) to and from LoreOS card
// data. Pure functions on parsed JSON: the zip itself is opened in character_io.js. Written from Backyard's published spec
// (github.com/backyardai/byaf, MIT, v1) and tested against its JSON Schemas.
//
// How the two map:
//   character.persona            <->  description        (personality is folded in under [Headers] on export)
//   character.displayName/name   <->  name               (the short name rides in extensions.byaf.name)
//   character.loreItems[]        <->  character_book entries (key <-> keys, value <-> content)
//   character.images[0]          <->  the picture        (only the first image is used)
//   scenario.narrative           <->  scenario
//   scenario.firstMessages[0]    <->  first_mes; every further scenario is an alternate greeting (its title kept)
//   scenario.exampleMessages     <->  mes_example (as <START> blocks of {{char}}: lines)
//   scenario.formattingInstructions, model settings, title, model  ->  extensions.byaf.scenarios[], handed back on export
// A saved chat (scenario.messages) is not imported. The spec allows no extra properties anywhere, so nothing LoreOS-only is written.
// ═══════════════════════════════════════════════════════
import { foldSections, slug, str } from './common.js';

export const DEFAULT_SETTINGS = { minP: 0.1, minPEnabled: true, temperature: 0.7, repeatPenalty: 1.1, repeatLastN: 64, topK: 40, topP: 0.9 };
const IMG = /^images\/[^/]+\.(png|jpe?g|webp|gif)$/i;
const CHAR_PATH = /^characters\/([^/]+)\/character\.json$/;
const SCEN_PATH = /^scenarios\/[^/]+\.json$/;
const safeSeg = s => !!s && s !== '.' && s !== '..';

export function isByafManifest(m) {
  return !!m && typeof m === 'object' && m.schemaVersion === 1 && Array.isArray(m.characters) && Array.isArray(m.scenarios);
}

// Which files inside the archive the manifest points at (paths checked, so a hostile archive cannot name ../something)
export function byafPaths(manifest) {
  if (!isByafManifest(manifest)) throw new Error('This is not a Backyard archive (manifest.json is missing or unreadable).');
  const cp = manifest.characters[0], m = CHAR_PATH.exec(String(cp || ''));
  if (!m || !safeSeg(m[1])) throw new Error('The archive names a character file in an unexpected place.');
  const scen = manifest.scenarios.map(String).filter(p => SCEN_PATH.test(p) && !p.split('/').includes('..'));
  return { characterPath: cp, characterId: m[1], scenarioPaths: scen };
}
export const imageArchivePath = (characterId, imagePath) => (IMG.test(String(imagePath || '')) && !String(imagePath).includes('..') ? 'characters/' + characterId + '/' + imagePath : '');

// example messages <-> SillyTavern-style example text
export function examplesToText(list) {
  const msgs = (Array.isArray(list) ? list : []).map(m => str(m && m.text)).filter(t => t.trim());
  return msgs.map(t => '<START>\n{{char}}: ' + t).join('\n\n');
}
export function textToExamples(text, characterID) {
  const t = str(text); if (!t.trim()) return { messages: [], dropped: false };
  const out = []; let dropped = false;
  t.split(/<START>/i).map(b => b.trim()).filter(Boolean).forEach(block => {
    let cur = null;
    block.split(/\r?\n/).forEach(line => {
      const c = /^\{\{char\}\}\s*:\s?(.*)$/i.exec(line), u = /^\{\{user\}\}\s*:/i.exec(line);
      if (c) { cur = { characterID, text: c[1] }; out.push(cur); }
      else if (u) { cur = null; dropped = true; }
      else if (cur) cur.text += '\n' + line;
    });
  });
  if (!out.length) return { messages: [{ characterID, text: t.trim() }], dropped: false, whole: true };
  out.forEach(m => { m.text = m.text.trim(); });
  return { messages: out.filter(m => m.text), dropped };
}

// A parsed archive -> a V2 card in LoreOS's shape, plus what was left behind
export function fromByaf({ manifest, character, scenarios }) {
  const ch = character || {}, notes = [];
  const scs = (Array.isArray(scenarios) ? scenarios : []).map(s => (s && s.data) || s || {});
  const first = scs[0] || {};
  const byaf = { id: str(ch.id), name: str(ch.name), isNSFW: !!ch.isNSFW, createdAt: str(ch.createdAt), updatedAt: str(ch.updatedAt) };
  if (manifest && manifest.author && typeof manifest.author === 'object') byaf.author = manifest.author;
  byaf.scenarios = scs.map(s => {
    const o = { formattingInstructions: str(s.formattingInstructions), narrative: str(s.narrative), promptTemplate: s.promptTemplate === undefined ? null : s.promptTemplate, grammar: s.grammar === undefined ? null : s.grammar, canDeleteExampleMessages: s.canDeleteExampleMessages !== false };
    ['minP', 'minPEnabled', 'temperature', 'repeatPenalty', 'repeatLastN', 'topK', 'topP'].forEach(k => { if (s[k] !== undefined) o[k] = s[k]; });
    if (str(s.title)) o.title = s.title; if (str(s.model)) o.model = s.model; if (str(s.backgroundImage)) o.backgroundImage = s.backgroundImage;
    return o;
  });
  const entries = (Array.isArray(ch.loreItems) ? ch.loreItems : []).map((it, i) => ({
    id: i, keys: [str(it && it.key)].filter(Boolean), secondary_keys: [], comment: str(it && it.key), content: str(it && it.value),
    constant: false, selective: false, insertion_order: i, enabled: true, position: 'before_char', extensions: {},
  }));
  const msg = s => str(s && s.firstMessages && s.firstMessages[0] && s.firstMessages[0].text);
  const alts = scs.slice(1).map(s => ({ title: str(s.title), message: msg(s) })).filter(g => g.message.trim() || g.title);
  if (scs.slice(1).some(s => str(s.narrative) && str(s.narrative) !== str(first.narrative))) notes.push('Some scenarios have their own narrative text. They came in as alternate greetings; the narrative is kept and goes back out on export.');
  if (scs.some(s => Array.isArray(s.messages) && s.messages.length)) notes.push('The saved chat in the archive was not imported.');
  if (Array.isArray(ch.images) && ch.images.length > 1) notes.push((ch.images.length - 1) + ' more picture(s) in the archive were not imported (the first is the avatar).');
  const examples = examplesToText(first.exampleMessages);
  return {
    card: {
      spec: 'chara_card_v2', spec_version: '2.0',
      data: {
        name: str(ch.displayName) || str(ch.name) || 'Unnamed',
        description: str(ch.persona), personality: '', scenario: str(first.narrative),
        first_mes: msg(first), mes_example: examples,
        system_prompt: '', post_history_instructions: '', creator_notes: '', creator: str(manifest && manifest.author && manifest.author.name),
        character_version: '', tags: [], alternate_greetings: alts,
        extensions: { byaf }, character_book: entries.length ? { name: str(ch.displayName) || str(ch.name), description: '', entries, extensions: {} } : null,
      },
    },
    imagePath: Array.isArray(ch.images) && ch.images[0] ? str(ch.images[0].path) : '',
    notes,
  };
}

const uniqueKey = (key, used) => { let k = key, n = 2; while (used.has(k)) k = key + ' (' + n++ + ')'; used.add(k); return k; };

// LoreOS card data -> the files of a .byaf. `imageExt` is the extension of the avatar when there is one.
export function toByaf(d, { imageExt = '', now = () => new Date().toISOString() } = {}) {
  const ext = (d.extensions && d.extensions.byaf) || {}, notes = [];
  const name = str(d.name) || 'Unnamed';
  const id = safeSeg(slug(ext.id || name)) && slug(ext.id || name) ? slug(ext.id || name) : 'character1';
  const stamp = now();
  const used = new Set();
  const lore = (d.character_book && Array.isArray(d.character_book.entries) ? d.character_book.entries : []).map((e, i) => {
    const key = str((Array.isArray(e.keys) ? e.keys.join(', ') : '') || e.comment) || 'entry ' + (i + 1);
    return { key: uniqueKey(key, used), value: str(e.content) };
  });
  const character = {
    schemaVersion: 1, id, name: str(ext.name) || name, displayName: name,
    isNSFW: typeof ext.isNSFW === 'boolean' ? ext.isNSFW : (Array.isArray(d.tags) && d.tags.some(t => String(t).toLowerCase() === 'nsfw')),
    persona: foldSections([['Description', d.description], ['Personality', d.personality]]),
    createdAt: str(ext.createdAt) || stamp, updatedAt: stamp, loreItems: lore,
    images: imageExt && /^(png|jpe?g|webp|gif)$/i.test(imageExt) ? [{ path: 'images/portrait.' + imageExt.toLowerCase(), label: 'Portrait' }] : [],
  };
  const ex = textToExamples(d.mes_example, id);
  const saved = Array.isArray(ext.scenarios) ? ext.scenarios : [];
  const greetings = (Array.isArray(d.alternate_greetings) ? d.alternate_greetings : []).map(g => (g && typeof g === 'object' ? { title: str(g.title), message: str(g.message) } : { title: '', message: str(g) })).filter(g => g.message.trim());
  const list = [{ title: '', message: str(d.first_mes) }, ...greetings];
  const scenarios = list.map((g, i) => {
    const raw = saved[i] || {};
    const s = {
      schemaVersion: 1,
      formattingInstructions: str(raw.formattingInstructions),
      minP: raw.minP ?? DEFAULT_SETTINGS.minP, minPEnabled: raw.minPEnabled ?? DEFAULT_SETTINGS.minPEnabled, temperature: raw.temperature ?? DEFAULT_SETTINGS.temperature,
      repeatPenalty: raw.repeatPenalty ?? DEFAULT_SETTINGS.repeatPenalty, repeatLastN: raw.repeatLastN ?? DEFAULT_SETTINGS.repeatLastN, topK: raw.topK ?? DEFAULT_SETTINGS.topK, topP: raw.topP ?? DEFAULT_SETTINGS.topP,
      exampleMessages: ex.messages, canDeleteExampleMessages: raw.canDeleteExampleMessages !== false,
      firstMessages: g.message.trim() ? [{ characterID: id, text: g.message }] : [],
      narrative: i === 0 ? str(d.scenario) : (raw.narrative !== undefined ? str(raw.narrative) : str(d.scenario)),
      promptTemplate: raw.promptTemplate === undefined ? null : raw.promptTemplate, grammar: raw.grammar === undefined ? null : raw.grammar,
      messages: [],
    };
    const title = str(g.title) || str(raw.title); if (title) s.title = title;
    if (str(raw.model)) s.model = raw.model; if (str(raw.backgroundImage)) s.backgroundImage = raw.backgroundImage;
    return s;
  });
  const files = scenarios.map((s, i) => ({ path: 'scenarios/scenario' + (i + 1) + '.json', data: s }));
  const manifest = { schemaVersion: 1, createdAt: stamp, characters: ['characters/' + id + '/character.json'], scenarios: files.map(f => f.path) };
  if (str(d.creator)) manifest.author = { name: d.creator };

  if (str(d.system_prompt).trim()) notes.push('The system prompt was left out (Backyard has formatting instructions instead; they are kept if the card came from Backyard).');
  if (str(d.post_history_instructions).trim()) notes.push('Post-history instructions were left out.');
  if (str(d.creator_notes).trim()) notes.push('Creator notes were left out (a Backyard archive has no field for them).');
  if (Array.isArray(d.tags) && d.tags.length) notes.push('Tags were left out (Backyard archives only carry an NSFW flag).');
  if (lore.length) notes.push('Lorebook entries became simple key/value lore items: secondary keys, order and activation settings were dropped.');
  if (ex.dropped) notes.push('Backyard example messages hold only the character\'s lines, so lines spoken by {{user}} were left out.');
  if (greetings.length) notes.push('Alternate greetings became extra scenarios.');
  if (!imageExt) notes.push('There is no picture on this card, so the archive has none.');
  return { manifest, characterId: id, character, scenarios: files, notes };
}
