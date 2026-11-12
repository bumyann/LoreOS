// ═══════════════════════════════════════════════════════
// SAUCEPANAI adapter (import only) — a SaucepanAI companion.json read into LoreOS card data. Pure: no DOM, no storage.
// There is no export: Saucepan will not restore a companion file without tags and a picture from its own library, and LoreOS cannot
// supply that picture. Saucepan does take V2 and V3 cards, so those are the way in.
//
// How a companion maps (checked against a real exported companion.json):
//   card (the definition)      ->  description
//   full_description           ->  creator_notes (the public profile text)
//   short_description          ->  extensions.saucepan.short_description (its own field, not merged into notes)
//   example_dialogue           ->  mes_example
//   starting_scenarios[]       ->  first_mes + alternate_greetings[]  ({title, message}; the first title is kept too)
//   tags, fandom_tags          ->  tags, extensions.saucepan.fandom_tags
//   display_name, formatting_instructions, advanced_prompt, image   ->  extensions.saucepan.*
// Everything else in the file (id, access_level, flags, banner crops ...) is kept in extensions.saucepan.raw.
// ═══════════════════════════════════════════════════════

const str = v => (typeof v === 'string' ? v : '');
const MAPPED = new Set(['name', 'display_name', 'full_description', 'short_description', 'tags', 'fandom_tags', 'image', 'card', 'persona', 'description',
  'example_dialogue', 'mes_example', 'starting_scenarios', 'formatting_instructions', 'advanced_prompt', 'personality', 'scenario', 'system_prompt',
  'post_history_instructions', 'creator_notes', 'creator', 'character_version', 'extensions', 'character_book']);

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
