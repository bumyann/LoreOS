// Run with:  node --test      (finds every *.test.js; no install needed)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromCompanion, isCompanion } from '../../js/adapters/saucepan.js';

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

test('a file that is not a companion is refused', () => {
  assert.throws(() => fromCompanion({ foo: 1 }), /Unrecognized/);
});

test('import: unicode, emoji and Windows line endings survive', () => {
  const src = { ...sample, card: '名前: ユウジ 💙\r\nline two', starting_scenarios: [{ title: '✨', message: 'こんにちは\r\n🙂', portrait_id: null }] };
  const { data: d } = fromCompanion(src);
  assert.equal(d.description, src.card);
  assert.equal(d.first_mes, 'こんにちは\r\n🙂');
  assert.equal(d.extensions.saucepan.first_title, '✨');
});
