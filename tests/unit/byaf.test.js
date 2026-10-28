import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromByaf, toByaf, byafPaths, imageArchivePath, textToExamples, examplesToText, isByafManifest } from '../../js/adapters/byaf.js';
import { validate } from './helpers/schema.js';

const schema = n => JSON.parse(readFileSync(new URL('../fixtures/byaf/byaf-' + n + '.schema.json', import.meta.url), 'utf8'));
const S = { manifest: schema('manifest'), character: schema('character'), scenario: schema('scenario') };
const fixed = { now: () => '2026-10-28T12:00:00.000Z' };
const problems = out => [...validate(S.manifest, out.manifest, 'manifest'), ...validate(S.character, out.character, 'character'), ...out.scenarios.flatMap(s => validate(S.scenario, s.data, s.path))];

// the example shapes from Backyard's own spec
const manifest = { schemaVersion: 1, createdAt: '2024-03-21T12:00:00Z', author: { name: 'Example Author', backyardURL: 'https://backyard.ai/hub/user/example' }, characters: ['characters/character1/character.json'], scenarios: ['scenarios/scenario1.json', 'scenarios/scenario2.json'] };
const character = { schemaVersion: 1, id: 'character1', name: 'alice', displayName: 'Alice Smith', isNSFW: false, persona: 'A friendly and curious character.', createdAt: '2024-03-21T12:00:00Z', updatedAt: '2024-03-21T12:00:00Z', loreItems: [{ key: 'background', value: 'Alice grew up in a small town...' }, { key: 'relationships', value: 'Her sister Bea.' }], images: [{ path: 'images/portrait.png', label: 'Default Portrait' }, { path: 'images/expression.jpg', label: 'Happy' }] };
const scen = (extra = {}) => ({ schemaVersion: 1, model: 'llama-3-8b', formattingInstructions: 'Respond in a friendly manner.', temperature: 0.7, topK: 40, topP: 0.9, minP: 0.1, minPEnabled: true, repeatPenalty: 1.1, repeatLastN: 64, narrative: 'A casual chat in a coffee shop.', promptTemplate: 'ChatML', grammar: null, exampleMessages: [{ characterID: 'character1', text: 'Hello! How are you today?' }, { characterID: 'character1', text: 'Line one.\nLine two.' }], canDeleteExampleMessages: true, firstMessages: [{ characterID: 'character1', text: 'Welcome to the coffee shop!' }], messages: [{ type: 'human', createdAt: '2024-03-21T12:00:00Z', updatedAt: '2024-03-21T12:00:00Z', text: 'Hi there!' }], ...extra });
const parsed = { manifest, character, scenarios: [{ path: 'scenarios/scenario1.json', data: scen({ title: 'Coffee' }) }, { path: 'scenarios/scenario2.json', data: scen({ title: 'Rooftop', narrative: 'On a rooftop.', firstMessages: [{ characterID: 'character1', text: 'Nice view, huh?' }] }) }] };

test('the spec\'s own example files pass the real schemas (the checker works)', () => {
  assert.deepEqual(validate(S.manifest, manifest), []); assert.deepEqual(validate(S.character, character), []); assert.deepEqual(validate(S.scenario, scen()), []);
  assert.ok(validate(S.character, { ...character, extra: 1 }).length, 'an extra property is refused');
  assert.ok(validate(S.character, { ...character, images: [{ path: '../x.png', label: 'x' }] }).length, 'a bad image path is refused');
});

test('import: fields land where the mapping says', () => {
  const { card, imagePath, notes } = fromByaf(parsed); const d = card.data;
  assert.equal(d.name, 'Alice Smith'); assert.equal(d.description, 'A friendly and curious character.');
  assert.equal(d.scenario, 'A casual chat in a coffee shop.'); assert.equal(d.first_mes, 'Welcome to the coffee shop!');
  assert.deepEqual(d.alternate_greetings, [{ title: 'Rooftop', message: 'Nice view, huh?' }]);
  assert.equal(d.mes_example, '<START>\n{{char}}: Hello! How are you today?\n\n<START>\n{{char}}: Line one.\nLine two.');
  assert.equal(d.character_book.entries.length, 2); assert.deepEqual(d.character_book.entries[0].keys, ['background']); assert.equal(d.character_book.entries[0].content, 'Alice grew up in a small town...');
  assert.equal(d.creator, 'Example Author'); assert.equal(d.extensions.byaf.name, 'alice');
  assert.equal(imagePath, 'images/portrait.png');
  const all = notes.join(' | '); assert.match(all, /saved chat/); assert.match(all, /1 more picture/); assert.match(all, /own narrative/);
});

test('round trip: import then export is valid Backyard and keeps the content', () => {
  const { card } = fromByaf(parsed);
  const out = toByaf(card.data, { imageExt: 'png', ...fixed });
  assert.deepEqual(problems(out), []);
  assert.equal(out.character.displayName, 'Alice Smith'); assert.equal(out.character.name, 'alice');
  assert.equal(out.character.persona, 'A friendly and curious character.');
  assert.deepEqual(out.character.loreItems, character.loreItems);
  assert.equal(out.scenarios.length, 2);
  assert.equal(out.scenarios[0].data.firstMessages[0].text, 'Welcome to the coffee shop!');
  assert.equal(out.scenarios[1].data.narrative, 'On a rooftop.'); assert.equal(out.scenarios[1].data.title, 'Rooftop');
  assert.equal(out.scenarios[0].data.temperature, 0.7); assert.equal(out.scenarios[0].data.promptTemplate, 'ChatML'); assert.equal(out.scenarios[0].data.model, 'llama-3-8b');
  assert.deepEqual(out.scenarios[0].data.exampleMessages.map(m => m.text), ['Hello! How are you today?', 'Line one.\nLine two.']);
  assert.deepEqual(out.scenarios[0].data.messages, []);   // the saved chat is not carried
  assert.equal(out.character.createdAt, '2024-03-21T12:00:00Z');
});

test('export: a plain card becomes a valid archive with defaults', () => {
  const out = toByaf({ name: 'Plain Jane', description: 'Just a description.', first_mes: 'Hello', tags: ['nsfw'] }, { imageExt: 'webp', ...fixed });
  assert.deepEqual(problems(out), []);
  assert.equal(out.characterId, 'plain-jane'); assert.deepEqual(out.manifest.characters, ['characters/plain-jane/character.json']);
  assert.equal(out.character.isNSFW, true);
  assert.deepEqual(out.character.images, [{ path: 'images/portrait.webp', label: 'Portrait' }]);
  assert.equal(out.scenarios[0].data.temperature, 0.7);
  assert.equal(out.scenarios[0].data.firstMessages[0].characterID, 'plain-jane');
});

test('export: a card with no first message and no picture still validates', () => {
  const out = toByaf({ name: 'Bare' }, fixed);
  assert.deepEqual(problems(out), []);
  assert.deepEqual(out.scenarios[0].data.firstMessages, []); assert.deepEqual(out.character.images, []);
  assert.match(out.notes.join(' '), /no picture/);
});

test('export: description and personality are folded under headers; scenario stays the narrative', () => {
  const out = toByaf({ name: 'X', description: 'D', personality: 'P', scenario: 'S' }, fixed);
  assert.equal(out.character.persona, '[Description]\nD\n\n[Personality]\nP'); assert.equal(out.scenarios[0].data.narrative, 'S');
});

test('export: lorebook keys become lore item keys (made unique), and the loss is reported', () => {
  const out = toByaf({ name: 'X', character_book: { entries: [{ keys: ['a', 'b'], content: '1' }, { keys: ['a', 'b'], content: '2' }, { comment: 'only a comment', content: '3' }] }, system_prompt: 'sys', creator_notes: 'n', tags: ['t'] }, fixed);
  assert.deepEqual(out.character.loreItems.map(i => i.key), ['a, b', 'a, b (2)', 'only a comment']);
  const all = out.notes.join(' | '); assert.match(all, /system prompt/); assert.match(all, /Creator notes/); assert.match(all, /Tags/); assert.match(all, /key\/value/);
  assert.deepEqual(problems(out), []);
});

test('example messages: char lines kept, user lines reported, free text kept whole', () => {
  const a = textToExamples('<START>\n{{user}}: hi\n{{char}}: hello\nthere\n<START>\n{{char}}: bye', 'c');
  assert.deepEqual(a.messages.map(m => m.text), ['hello\nthere', 'bye']); assert.equal(a.dropped, true);
  const b = textToExamples('Some free text without markers.', 'c'); assert.equal(b.messages.length, 1); assert.equal(b.messages[0].text, 'Some free text without markers.');
  assert.deepEqual(textToExamples('', 'c').messages, []);
  assert.equal(examplesToText([{ text: 'a' }, { text: ' ' }, { text: 'b' }]), '<START>\n{{char}}: a\n\n<START>\n{{char}}: b');
});

test('paths: only the places the spec names are followed', () => {
  assert.deepEqual(byafPaths(manifest), { characterPath: 'characters/character1/character.json', characterId: 'character1', scenarioPaths: manifest.scenarios });
  assert.throws(() => byafPaths({ ...manifest, characters: ['characters/../character.json'] }), /unexpected place/);
  assert.throws(() => byafPaths({ ...manifest, characters: ['../evil/character.json'] }), /unexpected place/);
  assert.throws(() => byafPaths({ nope: 1 }), /not a Backyard archive/);
  assert.deepEqual(byafPaths({ ...manifest, scenarios: ['scenarios/ok.json', 'scenarios/../x.json', '/etc/passwd'] }).scenarioPaths, ['scenarios/ok.json']);
  assert.equal(imageArchivePath('c1', 'images/a.png'), 'characters/c1/images/a.png');
  assert.equal(imageArchivePath('c1', '../../secret.png'), ''); assert.equal(imageArchivePath('c1', 'images/a.exe'), '');
  assert.equal(isByafManifest(manifest), true); assert.equal(isByafManifest({}), false);
});

test('unicode, emoji and Windows line endings survive', () => {
  const { card } = fromByaf({ manifest, character: { ...character, persona: '名前: ユウジ 💙\r\nline two' }, scenarios: [{ data: scen({ narrative: 'こんにちは\r\n🙂' }) }] });
  const out = toByaf(card.data, fixed);
  assert.equal(out.character.persona, '名前: ユウジ 💙\r\nline two'); assert.equal(out.scenarios[0].data.narrative, 'こんにちは\r\n🙂');
  assert.deepEqual(problems(out), []);
});
