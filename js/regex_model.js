// ═══════════════════════════════════════════════════════
// REGEX SCRIPTS — the data model and the matching engine (no DOM, no storage).
//
// The script shape is SillyTavern's regex extension format, so a script exported
// from here imports there and the other way round:
//   { id, scriptName, findRegex: "/pattern/flags", replaceString, trimStrings: [],
//     placement: [1,2,3,5,6], disabled, markdownOnly, promptOnly, runOnEdit,
//     substituteRegex: 0|1|2, minDepth, maxDepth }
//
// A set is what LoreOS keeps in the library: { scripts: [...], test: {...} }.
//
// The matching below follows SillyTavern's behaviour as closely as can be done without
// SillyTavern itself, so treat the tester as a very good guide, not a guarantee.
// ═══════════════════════════════════════════════════════
import { substituteNames } from './prompt_model.js';

// Where a script runs (SillyTavern's numbers)
export const PLACEMENTS = [
  { id: 1, label: 'User input' },
  { id: 2, label: 'AI output' },
  { id: 3, label: 'Slash commands' },
  { id: 5, label: 'World info' },
  { id: 6, label: 'Reasoning' },
];
export const SUBSTITUTE_MODES = [
  { id: 0, label: "Don't substitute macros in the pattern" },
  { id: 1, label: 'Substitute macros as they are' },
  { id: 2, label: 'Substitute macros, escaped for regex' },
];
// Which text the tester shows. A script with neither flag changes the saved message itself,
// so it applies everywhere; "display only" changes what you see; "prompt only" what the model gets.
export const VIEWS = [
  { id: 'display', label: 'What I see in chat' },
  { id: 'prompt', label: 'What the model receives' },
  { id: 'saved', label: 'The saved message' },
];

export function newId() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* insecure context */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}

export function blankScript() {
  return {
    id: newId(), scriptName: 'New script', findRegex: '', replaceString: '', trimStrings: [],
    placement: [2], disabled: false, markdownOnly: false, promptOnly: false, runOnEdit: true,
    substituteRegex: 0, minDepth: null, maxDepth: null,
  };
}

export function blankSet() {
  const s = blankScript();
  return { scripts: [s], test: defaultTest() };
}

export function defaultTest() {
  return { sample: '', placement: 2, view: 'display', char: '', user: '' };
}

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const str = v => (typeof v === 'string' ? v : '');
const numOrNull = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));

// Accepts anything that looks like a script (including older exports) and returns a complete one
export function normalizeScript(s) {
  const o = isObj(s) ? s : {};
  const placement = (Array.isArray(o.placement) ? o.placement : [])
    .map(Number).filter(n => PLACEMENTS.some(p => p.id === n));
  return {
    ...o, // keep fields from newer SillyTavern versions untouched
    id: str(o.id) || newId(),
    scriptName: str(o.scriptName) || 'Unnamed script',
    findRegex: str(o.findRegex),
    replaceString: str(o.replaceString),
    trimStrings: (Array.isArray(o.trimStrings) ? o.trimStrings : []).filter(x => typeof x === 'string'),
    placement: [...new Set(placement)],
    disabled: !!o.disabled,
    markdownOnly: !!o.markdownOnly,
    promptOnly: !!o.promptOnly,
    runOnEdit: o.runOnEdit === undefined ? true : !!o.runOnEdit,
    substituteRegex: [0, 1, 2].includes(Number(o.substituteRegex)) ? Number(o.substituteRegex) : 0,
    minDepth: numOrNull(o.minDepth),
    maxDepth: numOrNull(o.maxDepth),
  };
}

export function normalizeSet(p) {
  const o = isObj(p) ? p : {};
  const t = isObj(o.test) ? o.test : {};
  const scripts = (Array.isArray(o.scripts) ? o.scripts : []).filter(isObj).map(normalizeScript);
  return {
    scripts,
    test: {
      sample: str(t.sample),
      placement: PLACEMENTS.some(x => x.id === Number(t.placement)) ? Number(t.placement) : 2,
      view: VIEWS.some(v => v.id === t.view) ? t.view : 'display',
      char: str(t.char), user: str(t.user),
    },
  };
}

// ── Reading "/pattern/flags" ──
export function parseFind(text) {
  const t = String(text || '');
  if (!t.trim()) throw new Error('Type a pattern to search for.');
  const m = t.match(/^\/([\s\S]*)\/([a-z]*)$/);
  if (m) {
    try { return new RegExp(m[1], m[2]); } catch (e) { throw new Error(e.message.replace(/^Invalid regular expression: /, '')); }
  }
  // No slashes: SillyTavern treats the whole text as the pattern
  try { return new RegExp(t); } catch (e) { throw new Error(e.message.replace(/^Invalid regular expression: /, '')); }
}

const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The regex for a script, with {{char}} / {{user}} filled in when the script asks for it
export function buildRegex(script, names = {}) {
  let text = script.findRegex;
  if (script.substituteRegex === 1) text = substituteNames(text, names);
  else if (script.substituteRegex === 2) text = substituteNames(text, { char: names.char ? escapeRegex(names.char) : '', user: names.user ? escapeRegex(names.user) : '' });
  return parseFind(text);
}

// ── Running one script on a text ──
// Returns { output, count, matches: [{ index, length }] }. Throws for a bad pattern.
export function runScript(script, text, names = {}) {
  const re = buildRegex(script, names);
  const src = String(text || '');
  const trims = (script.trimStrings || []).filter(Boolean);
  const trim = v => { let s = v === undefined ? '' : String(v); trims.forEach(t => { s = s.split(t).join(''); }); return s; };
  const expand = (tpl, m) => {
    // {{char}} / {{user}} in the replacement are filled in like SillyTavern does
    let out = substituteNames(String(tpl || ''), names).replace(/\{\{\s*match\s*\}\}/gi, () => trim(m[0]));
    out = out.replace(/\$(\$|&|<([^>]*)>|\d{1,2})/g, (all, tok, name) => {
      if (tok === '$') return '$';
      if (tok === '&') return trim(m[0]);
      if (name !== undefined) return m.groups && name in m.groups ? trim(m.groups[name]) : all;
      const n = Number(tok);
      return n >= 1 && n < m.length ? trim(m[n]) : all;
    });
    return out;
  };
  const matches = [];
  let out = '', last = 0;
  const flags = re.flags;
  const global = flags.includes('g') || flags.includes('y');
  const rx = global ? re : new RegExp(re.source, re.flags + 'g'); // non-global: only the first hit is replaced
  rx.lastIndex = 0;
  let m;
  while ((m = rx.exec(src)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
    out += src.slice(last, m.index) + expand(script.replaceString, m);
    last = m.index + m[0].length;
    if (m[0].length === 0) rx.lastIndex++; // an empty match must not loop forever
    if (!global) break;
    if (matches.length >= 5000) break; // a pattern like /(?:)/g on a long text
  }
  out += src.slice(last);
  return { output: out, count: matches.length, matches };
}

// ── Running a whole set the way a chat would ──
// Which scripts apply: enabled, placed for this kind of text, and matching the view
export function appliesTo(script, placement, view) {
  if (script.disabled) return false;
  if (!script.placement.includes(Number(placement))) return false;
  if (script.markdownOnly && view !== 'display') return false;
  if (script.promptOnly && view !== 'prompt') return false;
  return true;
}

// [{ id, name, applied, count, error, output }] and the final text
export function runPipeline(scripts, text, { placement = 2, view = 'display', char = '', user = '' } = {}) {
  let cur = String(text || '');
  const steps = scripts.map(s => {
    const base = { id: s.id, name: s.scriptName, applied: false, count: 0, error: '', matches: [] };
    if (!appliesTo(s, placement, view)) return { ...base, skipped: s.disabled ? 'off' : 'not for this text' };
    try {
      const input = cur;
      const r = runScript(s, cur, { char, user });
      cur = r.output;
      return { ...base, applied: true, count: r.count, matches: r.matches, input };
    } catch (e) { return { ...base, applied: true, error: e.message }; }
  });
  return { output: cur, steps };
}

// ── Highlighting matches of one script in a text (HTML-safe) ──
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function highlight(text, matches) {
  const src = String(text || '');
  let html = '', last = 0;
  (matches || []).forEach(m => {
    if (m.index < last) return;
    html += escHtml(src.slice(last, m.index));
    html += m.length ? '<mark>' + escHtml(src.slice(m.index, m.index + m.length)) + '</mark>' : '<mark class="empty"></mark>';
    last = m.index + m.length;
  });
  return html + escHtml(src.slice(last));
}

// ── Import / export ──
export const SET_FORMAT = 'loreos-regex-set';

// Any of: one script, a list of scripts, { regex_scripts: [...] } (as inside a card or preset), a LoreOS set
export function parseRegexJson(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
  const looksLikeScript = o => isObj(o) && ('findRegex' in o || 'scriptName' in o);
  if (isObj(data) && data.format === SET_FORMAT && isObj(data.set)) {
    return { name: str(data.name) || 'Imported regex set', set: normalizeSet(data.set) };
  }
  let list = null, name = '';
  if (Array.isArray(data) && data.length && data.every(looksLikeScript)) list = data;
  else if (looksLikeScript(data)) { list = [data]; name = str(data.scriptName); }
  else if (isObj(data) && isObj(data.extensions) && Array.isArray(data.extensions.regex_scripts)) list = data.extensions.regex_scripts;
  else if (isObj(data) && Array.isArray(data.regex_scripts)) list = data.regex_scripts;
  if (!list || !list.length) throw new Error('No regex scripts found in that file.');
  return { name: name || 'Imported regex scripts', set: normalizeSet({ scripts: list }) };
}

export function looksLikeRegexJson(data) {
  const looks = o => !!o && typeof o === 'object' && !Array.isArray(o) && 'findRegex' in o;
  return looks(data) || (Array.isArray(data) && data.length > 0 && data.every(looks)) || (data && data.format === SET_FORMAT);
}

// What goes into a card or preset (fresh ids so a script can be sent more than once)
export function scriptsForEmbedding(scripts) {
  return scripts.map(s => ({ ...JSON.parse(JSON.stringify(s)), id: newId() }));
}

export function setToJson(name, set) { return JSON.stringify({ format: SET_FORMAT, version: 1, name, set }, null, 2); }
export function scriptToJson(script) { return JSON.stringify(script, null, 2); }
