import test from 'node:test';
import assert from 'node:assert/strict';
import { toV2Card, toV3Card, toJanitorData, janitorGreetingsMd } from '../../js/adapters/tavern.js';

const data = {
  name: 'Izzy', description: 'The definition.', personality: '', scenario: 'A school.', first_mes: 'Hello', mes_example: '<START>',
  creator_notes: 'Blurb', tags: ['oc'], alternate_greetings: [{ title: 'Alt', message: 'Second' }, 'Third'],
  extensions: { talkativeness: 0.7 }, character_book: null,
};
const fixed = { now: () => '2026-01-01T00:00:00.000Z', makeId: () => 'c1' };

test('V3: spec-clean, greetings flattened, group greetings present', () => {
  const c = toV3Card({ data });
  assert.equal(c.spec, 'chara_card_v3'); assert.equal(c.spec_version, '3.0');
  assert.deepEqual(c.data.alternate_greetings, ['Second', 'Third']);
  assert.deepEqual(c.data.group_only_greetings, []);
  assert.deepEqual(Object.keys(c).sort(), ['data', 'spec', 'spec_version']);
});

test('V3 with legacy fields: SillyTavern\'s top-level copies, which JanitorAI needs', () => {
  const c = toV3Card({ data }, { legacy: true, ...fixed });
  assert.deepEqual(Object.keys(c).sort(), ['avatar', 'create_date', 'creatorcomment', 'data', 'description', 'fav', 'first_mes', 'id', 'mes_example', 'name', 'personality', 'scenario', 'spec', 'spec_version', 'tags', 'talkativeness']);
  assert.equal(c.description, 'The definition.');
  assert.equal(c.description, c.data.description);
  assert.equal(c.creatorcomment, 'Blurb');
  assert.equal(c.talkativeness, 0.7);
  assert.equal(c.name, 'Izzy');
});

test('V3 with legacy fields: a missing talkativeness defaults to 0.5, empty fields stay strings', () => {
  const c = toV3Card({ data: { name: 'N' } }, { legacy: true, ...fixed });
  assert.equal(c.talkativeness, 0.5);
  assert.equal(c.personality, ''); assert.equal(c.first_mes, '');
});

test('V2: description stays description, greetings are plain strings', () => {
  const c = toV2Card(data);
  assert.equal(c.spec, 'chara_card_v2');
  assert.equal(c.data.description, 'The definition.');
  assert.deepEqual(c.data.alternate_greetings, ['Second', 'Third']);
  assert.ok(!('character_book' in c.data));
});

test('JanitorAI V2 option: the definition moves to personality, creator notes become the Bio', () => {
  const j = toJanitorData({ ...data, personality: 'Calm.' });
  assert.equal(j.description, 'Blurb');
  assert.equal(j.personality, 'The definition.\n\nCalm.');
  assert.equal(toJanitorData({ ...data, creator_notes: '' }).description, '');
});

test('JanitorAI greetings file lists everything after the first message', () => {
  const md = janitorGreetingsMd(data);
  assert.match(md, /Izzy: alternate greetings/); assert.match(md, /## 2\. Alt/); assert.match(md, /## 3\. Greeting 3/);
  assert.equal(janitorGreetingsMd({ name: 'X', alternate_greetings: [] }), '');
});

test('unicode and line endings pass through untouched', () => {
  const c = toV3Card({ data: { name: '名前 💙', description: 'a\r\nb' } }, { legacy: true, ...fixed });
  assert.equal(c.name, '名前 💙'); assert.equal(c.data.description, 'a\r\nb'); assert.equal(c.description, 'a\r\nb');
});
