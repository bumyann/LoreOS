// ═══════════════════════════════════════════════════════
// SAUCEPANAI adapter — a SaucepanAI companion.json to and from LoreOS's own card data. Pure functions: no DOM, no storage.
//
// How the two map (checked against a real exported companion.json):
//   card (the definition)      <->  description        (personality and scenario are folded in under [Headers] on export)
//   full_description           <->  creator_notes      (the public profile text)
//   short_description          <->  extensions.saucepan.short_description   (its own field, not merged into notes)
//   example_dialogue           <->  mes_example
//   starting_scenarios[]       <->  first_mes + alternate_greetings[]       ({title, message}; the first title is kept too)
//   tags, fandom_tags          <->  tags, extensions.saucepan.fandom_tags
//   display_name, formatting_instructions, advanced_prompt, image   <->  extensions.saucepan.*
// Everything else in the file (id, access_level, flags, banner crops ...) rides along in extensions.saucepan.raw, so a
// companion imported and exported again comes back whole. Saucepan has no place for a system prompt, post-history
// instructions or a lorebook, so those are reported as left out.
// ═══════════════════════════════════════════════════════

export const SAUCEPAN_CARD_SOFT_LIMIT = 30000;   // Saucepan's own limit for the definition; imports can go past it

const str = v => (typeof v === 'string' ? v : '');
const MAPPED = new Set(['name', 'display_name', 'full_description', 'short_description', 'tags', 'fandom_tags', 'image', 'card', 'persona', 'description',
  'example_dialogue', 'mes_example', 'starting_scenarios', 'formatting_instructions', 'advanced_prompt', 'personality', 'scenario', 'system_prompt',
  'post_history_instructions', 'creator_notes', 'creator', 'character_version', 'extensions', 'character_book']);

// Saucepan tags are lower-case words joined with underscores (any_pov, time_travel)
export const slugTag = t => String(t || '').trim().replace(/^#+/, '').toLowerCase().replace(/[\s-]+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '');

// Description, personality and scenario become one definition. With more than one filled in, each gets a [Header]
export function foldDefinition(d) {
  const parts = [['Description', str(d.description)], ['Personality', str(d.personality)], ['Scenario', str(d.scenario)]].filter(p => p[1].trim());
  if (parts.length <= 1) return parts.length ? parts[0][1] : '';
  return parts.map(([h, t]) => '[' + h + ']\n' + t).join('\n\n');
}

export function isCompanion(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data) && (Array.isArray(data.starting_scenarios) || ('card' in data && 'name' in data) || ('persona' in data && 'name' in data));
}

// companion.json -> a V2 card in LoreOS's shape
export function fromCompanion(data) {
  if (!data || typeof data !== 'object') throw new Error('Not a companion file.');
  if (!data.name && !data.persona && !data.card) throw new Error('Unrecognized companion.json format.');
  const scen = Array.isArray(data.starting_scenarios) ? data.starting_scenarios : [];
  const msg = s => str(s && (s.message || s.text));
  const sp = {};
  if (str(data.display_name)) sp.display_name = data.display_name;
  if (str(data.short_description)) sp.short_description = data.short_description;
  if (Array.isArray(data.fandom_tags) && data.fandom_tags.length) sp.fandom_tags = data.fandom_tags.map(String);
  if (str(data.formatting_instructions)) sp.formatting_instructions = data.formatting_instructions;
  if (str(data.advanced_prompt)) sp.advanced_prompt = data.advanced_prompt;
  if (scen[0] && str(scen[0].title)) sp.first_title = scen[0].title;
  if (data.image && typeof data.image === 'object') sp.image = data.image;
  const raw = {}; Object.keys(data).forEach(k => { if (!MAPPED.has(k)) raw[k] = data[k]; });
  if (Object.keys(raw).length) sp.raw = raw;
  return {
    spec: 'chara_card_v2', spec_version: '2.0',
    data: {
      name: str(data.name) || 'Unnamed',
      description: str(data.card) || str(data.persona) || str(data.description),
      personality: str(data.personality),
      scenario: str(data.scenario),
      first_mes: msg(scen[0]),
      mes_example: str(data.mes_example) || str(data.example_dialogue),
      system_prompt: str(data.system_prompt),
      post_history_instructions: str(data.post_history_instructions),
      creator_notes: str(data.creator_notes) || str(data.full_description),
      creator: str(data.creator),
      character_version: str(data.character_version),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      alternate_greetings: scen.slice(1).map(s => ({ title: str(s && s.title), message: msg(s) })),
      extensions: { ...(data.extensions && typeof data.extensions === 'object' ? data.extensions : {}), ...(Object.keys(sp).length ? { saucepan: sp } : {}) },
      character_book: data.character_book || null,
    },
  };
}

const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

// LoreOS card data (the `data` part of a card) -> { companion, notes }. `notes` says what Saucepan cannot take or still needs.
export function toCompanion(d) {
  const sp = (d.extensions && d.extensions.saucepan) || {};
  const name = str(d.name) || 'Unnamed';
  const def = foldDefinition(d);
  const greetings = (Array.isArray(d.alternate_greetings) ? d.alternate_greetings : []).map(g => (g && typeof g === 'object' ? { title: str(g.title), message: str(g.message) } : { title: '', message: str(g) })).filter(g => g.message.trim());
  const scenarios = [];
  if (str(d.first_mes).trim()) scenarios.push({ title: str(sp.first_title), message: d.first_mes, portrait_id: null });
  else if (greetings.length) scenarios.push({ title: str(sp.first_title), message: '', portrait_id: null });
  greetings.forEach(g => scenarios.push({ title: g.title, message: g.message, portrait_id: null }));
  const tags = [...new Set((Array.isArray(d.tags) ? d.tags : []).map(slugTag).filter(Boolean))];
  const raw = sp.raw && typeof sp.raw === 'object' ? sp.raw : { temperature_offset_percentage: 0, portraits: [], locked_starting_message: false };
  const companion = {
    ...raw,
    id: str(raw.id) || uuid(),
    name,
    display_name: str(sp.display_name) || name,
    full_description: str(d.creator_notes),
    short_description: str(sp.short_description),
    tags,
    fandom_tags: Array.isArray(sp.fandom_tags) ? sp.fandom_tags : [],
    card: def,
    example_dialogue: str(d.mes_example) || null,
    starting_scenarios: scenarios,
    formatting_instructions: str(sp.formatting_instructions) || null,
    advanced_prompt: str(sp.advanced_prompt) || null,
  };
  if (sp.image) companion.image = sp.image;

  const notes = [];
  if (!tags.length) notes.push('Saucepan will not restore a companion file without at least one tag. Add some in Tags first.');
  if (!sp.image) notes.push('Saucepan will not restore a companion file without a picture from its own library, and LoreOS cannot add one. If this card did not come from Saucepan, import its V2 or V3 card there instead; Saucepan takes those.');
  if (!str(sp.short_description).trim()) notes.push('There is no short description yet. Add one in the SaucepanAI view.');
  if (def.length > SAUCEPAN_CARD_SOFT_LIMIT) notes.push('The definition is ' + def.length.toLocaleString() + ' characters. Saucepan\'s own limit is about 30,000, though imports can go past it.');
  if (parts(d) > 1) notes.push('Description, personality and scenario were joined into one definition, each under a [Header].');
  const left = [];
  if (str(d.system_prompt).trim()) left.push('system prompt');
  if (str(d.post_history_instructions).trim()) left.push('post-history instructions');
  const book = d.character_book;
  if (book && Array.isArray(book.entries) && book.entries.length) left.push('the lorebook (' + book.entries.length + ' entries; Saucepan lorebooks are separate)');
  if (left.length) notes.push('Left out, because Saucepan has no place for them: ' + left.join(', ') + '.');
  return { companion, notes };
}
const parts = d => ['description', 'personality', 'scenario'].filter(k => str(d[k]).trim()).length;
