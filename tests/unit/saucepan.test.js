// Run with:  node --test      (finds every *.test.js; no install needed)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromCompanion, toCompanion, foldDefinition, slugTag, isCompanion, SAUCEPAN_CARD_SOFT_LIMIT } from '../../js/adapters/saucepan.js';

const sample = JSON.parse(readFileSync(new URL('../fixtures/companion-sample.json', import.meta.url), 'utf8'));

test('a companion is recognised', () => {
  assert.equal(isCompanion(sample), true);
  assert.equal(isCompanion({ spec: 'chara_card_v2', data: {} }), false);
  assert.equal(isCompanion([]), false);
});

test('import: fields land where the mapping says', () => {
  const { data: d } = fromCompanion(sample);
  assert.equal(d.name, 'Testy');
  assert.match(d.description, /^CHARACTER OVERVIEW:/);
  assert.equal(d.first_mes, 'The first message.\r\nSecond line.');
  assert.equal(d.alternate_greetings.length, 1);
  assert.deepEqual(d.alternate_greetings[0], { title: 'MALEPOV', message: 'An alternate message.' });
  assert.match(d.creator_notes, /^\*\*Public blurb\*\*/);
  assert.deepEqual(d.tags, ['male', 'any_pov', 'comedy']);
  assert.equal(d.mes_example, '- Greeting {{user}}: "Hi there."');
  const sp = d.extensions.saucepan;
  assert.equal(sp.short_description, 'A made-up test character for the adapter tests.');
  assert.equal(sp.display_name, 'Testy McTest | Day One');
  assert.equal(sp.first_title, 'ANYPOV');
  assert.deepEqual(sp.image, sample.image);
});

test('import: the short description is its own field, not folded into the notes', () => {
  const { data: d } = fromCompanion(sample);
  assert.ok(!d.creator_notes.includes('adapter tests'));
});

test('import: unmapped keys ride along', () => {
  const sp = fromCompanion(sample).data.extensions.saucepan;
  assert.equal(sp.raw.access_level, 'public');
  assert.equal(sp.raw.id, sample.id);
  assert.equal(sp.raw.hidden_fields, 0);
  assert.ok(!('name' in sp.raw) && !('card' in sp.raw));
});

test('round trip: import then export gives the same companion', () => {
  const { companion, notes } = toCompanion(fromCompanion(sample).data);
  for (const k of Object.keys(sample)) assert.deepEqual(companion[k], sample[k], 'field ' + k);
  assert.deepEqual(Object.keys(companion).sort(), Object.keys(sample).sort());
  assert.deepEqual(notes, []);   // tags, picture and short description are all there, nothing to report
});

test('export: a plain card gets the default scaffolding and a fresh id', () => {
  const { companion } = toCompanion({ name: 'Plain', description: 'Just a description.', first_mes: 'Hello', tags: ['Time Travel', '#OC'] });
  assert.match(companion.id, /^[0-9a-f-]{36}$/);
  assert.equal(companion.card, 'Just a description.');
  assert.deepEqual(companion.tags, ['time_travel', 'oc']);
  assert.deepEqual(companion.starting_scenarios, [{ title: '', message: 'Hello', portrait_id: null }]);
  assert.equal(companion.display_name, 'Plain');
  assert.deepEqual(companion.portraits, []);
});

test('export: description, personality and scenario are folded under headers', () => {
  const both = foldDefinition({ description: 'D text', personality: 'P text', scenario: '' });
  assert.equal(both, '[Description]\nD text\n\n[Personality]\nP text');
  assert.equal(foldDefinition({ description: 'Only this' }), 'Only this');
  assert.equal(foldDefinition({ description: '', personality: 'Only personality', scenario: '' }), 'Only personality');
  assert.equal(foldDefinition({ description: 'a', personality: 'b', scenario: 'c' }), '[Description]\na\n\n[Personality]\nb\n\n[Scenario]\nc');
  assert.equal(foldDefinition({}), '');
});

test('export: tells you what Saucepan needs or cannot take', () => {
  const { notes } = toCompanion({ name: 'X', description: 'd', personality: 'p', system_prompt: 'sys', post_history_instructions: 'phi', character_book: { entries: [{}, {}] } });
  const all = notes.join(' | ');
  assert.match(all, /without at least one tag/);
  assert.match(all, /picture from its own library/);
  assert.match(all, /import its V2 or V3 card/);
  assert.match(all, /short description/);
  assert.match(all, /joined into one definition/);
  assert.match(all, /system prompt, post-history instructions, the lorebook \(2 entries/);
});

test('export: a very long definition is reported but never cut', () => {
  const long = 'x'.repeat(SAUCEPAN_CARD_SOFT_LIMIT + 500);
  const { companion, notes } = toCompanion({ name: 'Long', description: long, tags: ['a'] });
  assert.equal(companion.card.length, long.length);
  assert.match(notes.join(' '), /30,000/);
});

test('unicode, emoji and Windows line endings survive both ways', () => {
  const src = { ...sample, card: '名前: ユウジ 💙\r\nline two', starting_scenarios: [{ title: '✨', message: 'こんにちは\r\n🙂', portrait_id: null }] };
  const { companion } = toCompanion(fromCompanion(src).data);
  assert.equal(companion.card, src.card);
  assert.equal(companion.starting_scenarios[0].message, 'こんにちは\r\n🙂');
  assert.equal(companion.starting_scenarios[0].title, '✨');
});

test('slugTag', () => {
  assert.equal(slugTag(' Any POV '), 'any_pov');
  assert.equal(slugTag('#Slow-Burn'), 'slow_burn');
  assert.equal(slugTag('ドラマ'), 'ドラマ');
  assert.equal(slugTag(''), '');
});

test('a file that is not a companion is refused', () => {
  assert.throws(() => fromCompanion({ foo: 1 }), /Unrecognized/);
});
