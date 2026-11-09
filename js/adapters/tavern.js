// ═══════════════════════════════════════════════════════
// TAVERN adapter — SillyTavern-style character cards (V2 and V3) built from LoreOS card data, plus the JanitorAI variants.
// Pure functions: no DOM, no storage.
//
// What JanitorAI does with a card (found by importing the same card five ways):
//   - it reads only the PNG `chara` chunk; a card with only a `ccv3` chunk imports nothing
//   - a V2-spec card: `description` becomes the public Bio, and only `personality` is the definition
//   - a V3-spec card WITH the old top-level fields (name, description, personality ... beside `data`, the way
//     SillyTavern writes it): `description` is read as the definition. Without those top-level fields it imports nothing
// So the V3 export carries the top-level fields too, written the way SillyTavern does, which makes one file work in both.
// ═══════════════════════════════════════════════════════

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

// Build a spec-clean chara_card_v3 from the internal card. The editor keeps one canonical card (stored as V3-shaped);
// every export derives its target format from it. Drops LoreOS-internal fields (top-level `id`, greeting titles) and
// guarantees the fields the V3 spec requires, which blank/imported cards lack.
// { legacy: true } also writes SillyTavern's top-level copies of the V1 fields, which JanitorAI needs to read a V3 card.
export function toV3Card(card, { legacy = false, now = () => new Date().toISOString(), makeId = () => 'c' + Date.now() + String(Math.floor(Math.random() * 1e3)).padStart(3, '0') } = {}) {
  const d = (card && card.data) || {};
  const flat = a => (Array.isArray(a) ? a : []).map(g => typeof g === 'object' && g ? (g.message || '') : (g || ''));
  const v3 = {
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
  if (!legacy) return v3;
  const x = v3.data;
  return {
    ...v3,
    avatar: 'none', create_date: now(), creatorcomment: x.creator_notes || '',
    description: x.description || '', fav: false, first_mes: x.first_mes || '', id: makeId(), mes_example: x.mes_example || '',
    name: x.name, personality: x.personality || '', scenario: x.scenario || '', tags: x.tags,
    talkativeness: Number.isFinite(Number(x.extensions && x.extensions.talkativeness)) ? Number(x.extensions.talkativeness) : 0.5,
  };
}
