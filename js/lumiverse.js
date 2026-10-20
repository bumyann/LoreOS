// ═══════════════════════════════════════════════════════
// LUMIVERSE PRESETS ("Loom" presets) <-> the SillyTavern-style preset LoreOS edits.
// Pure: no DOM, no storage.
//
// A Lumiverse preset is { name, blocks: [...], samplerOverrides, promptBehavior, completionSettings,
// advancedSettings, promptVariables, extensions: { regex_scripts }, ... }. Each block is
// { id, name, content, role, enabled, position: pre_history|in_history|post_history, depth, marker,
//   isLocked, color, injectionTrigger, group, categoryMode, characterTagTrigger }.
//
// Importing keeps everything it cannot express in the preset editor under
// preset.extensions.lumiverse (and per prompt under prompt.lumiverse), so exporting back to
// Lumiverse loses nothing.
// ═══════════════════════════════════════════════════════
import { lumiToScript, scriptToLumi, isLumiScript } from './regex_model.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function looksLikeLoomPreset(d) {
  return isObj(d) && Array.isArray(d.blocks) && ('samplerOverrides' in d || 'promptBehavior' in d || 'schemaVersion' in d || 'completionSettings' in d);
}

// Lumiverse marker name <-> SillyTavern marker identifier
const MARKERS = {
  char_description: ['charDescription', 'Char Description'],
  char_personality: ['charPersonality', 'Char Personality'],
  scenario: ['scenario', 'Scenario'],
  persona_description: ['personaDescription', 'Persona Description'],
  world_info_before: ['worldInfoBefore', 'World Info (before)'],
  world_info_after: ['worldInfoAfter', 'World Info (after)'],
  dialogue_examples: ['dialogueExamples', 'Chat Examples'],
  chat_history: ['chatHistory', 'Chat History'],
};
const MARKER_REV = Object.fromEntries(Object.entries(MARKERS).map(([k, v]) => [v[0], k]));

// sampler / behaviour fields: [Lumiverse group, Lumiverse key, SillyTavern key]
const FIELD_MAP = [
  ['samplerOverrides', 'maxTokens', 'openai_max_tokens'], ['samplerOverrides', 'contextSize', 'openai_max_context'],
  ['samplerOverrides', 'temperature', 'temperature'], ['samplerOverrides', 'topP', 'top_p'],
  ['samplerOverrides', 'minP', 'min_p'], ['samplerOverrides', 'topK', 'top_k'],
  ['samplerOverrides', 'frequencyPenalty', 'frequency_penalty'], ['samplerOverrides', 'presencePenalty', 'presence_penalty'],
  ['samplerOverrides', 'repetitionPenalty', 'repetition_penalty'], ['samplerOverrides', 'streaming', 'stream_openai'],
  ['promptBehavior', 'continueNudge', 'continue_nudge_prompt'], ['promptBehavior', 'emptySendNudge', 'send_if_empty_nudge'],
  ['promptBehavior', 'impersonationPrompt', 'impersonation_prompt'], ['promptBehavior', 'groupNudge', 'group_nudge_prompt'],
  ['promptBehavior', 'newChatPrompt', 'new_chat_prompt'], ['promptBehavior', 'newGroupChatPrompt', 'new_group_chat_prompt'],
  ['promptBehavior', 'sendIfEmpty', 'send_if_empty'],
  ['completionSettings', 'assistantPrefill', 'assistant_prefill'], ['completionSettings', 'assistantImpersonation', 'assistant_impersonation'],
  ['completionSettings', 'continuePrefill', 'continue_prefill'], ['completionSettings', 'continuePostfix', 'continue_postfix'],
  ['completionSettings', 'namesBehavior', 'names_behavior'], ['completionSettings', 'squashSystemMessages', 'squash_system_messages'],
  ['completionSettings', 'useSystemPrompt', 'use_sysprompt'], ['completionSettings', 'enableWebSearch', 'enable_web_search'],
  ['completionSettings', 'sendInlineMedia', 'media_inlining'], ['completionSettings', 'enableFunctionCalling', 'function_calling'],
  ['advancedSettings', 'seed', 'seed'],
];

// Macros that SillyTavern knows; anything else in a block is worth a heads-up
const ST_MACROS = new Set(['char', 'user', 'persona', 'description', 'personality', 'scenario', 'mesexamples', 'mesexamplesraw', 'group', 'lastmessage',
  'lastmessageid', 'lastcharmessage', 'lastusermessage', 'input', 'model', 'time', 'date', 'weekday', 'isotime', 'isodate', 'idle_duration', 'random', 'roll',
  'pick', 'getvar', 'setvar', 'addvar', 'incvar', 'decvar', 'getglobalvar', 'setglobalvar', 'addglobalvar', 'incglobalvar', 'decglobalvar', 'trim', 'newline',
  'noop', 'original', 'systemprompt', 'charprompt', 'charjailbreak', 'outlet', 'banned', 'lastswipeid', 'currentswipeid', 'datetimeformat', 'timediff',
  'charversion', 'creatornotes', 'bias', 'maxprompt', 'instructsystem', 'chatstart', 'chatseed', 'reverse', 'if', 'else', 'var']);
function foreignMacros(blocks) {
  const seen = new Map();
  blocks.forEach(b => {
    const re = /\{\{\s*([#\/]?[A-Za-z_][\w.\-]*)/g; let m;
    const txt = String(b.content || '');
    while ((m = re.exec(txt)) !== null) {
      const raw = m[1], base = raw.replace(/^[#\/]/, '').toLowerCase();
      if (ST_MACROS.has(base) || /^\/\//.test(raw)) continue;
      seen.set(base, (seen.get(base) || 0) + 1);
    }
  });
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export function loomToPreset(d) {
  const preset = {};
  const lumi = { ...d };
  ['blocks', 'extensions'].forEach(k => delete lumi[k]);

  // ── blocks -> prompts ──
  const raw = d.blocks.filter(isObj);
  let prompts = raw.map((b, i) => {
    const id = String(b.id || 'loom-' + i);
    const mk = b.marker && MARKERS[b.marker];
    const role = b.role === 'assistant' ? 'assistant' : b.role === 'user' || b.role === 'user_append' ? 'user' : 'system';
    const inHist = b.position === 'in_history';
    const rest = { ...b };
    ['id', 'name', 'content', 'role', 'enabled', 'position', 'depth', 'marker', 'isLocked', 'color', 'injectionTrigger', 'group', 'categoryMode', 'characterTagTrigger'].forEach(k => delete rest[k]);
    const p = {
      id, identifier: mk ? mk[0] : id, name: String(b.name || (mk ? mk[1] : 'Prompt')),
      content: String(b.content || ''),
      enabled: b.enabled !== false, role, system_prompt: !!mk, marker: !!mk,
      injection_position: inHist ? 1 : 0, injection_depth: Number.isFinite(Number(b.depth)) ? Number(b.depth) : 0,
      injection_order: 100, injection_trigger: [], forbid_overrides: false,
      lumiverse: { id, marker: b.marker || null, role: b.role, position: b.position, depth: b.depth, group: b.group || null, isLocked: !!b.isLocked,
        color: b.color || null, categoryMode: b.categoryMode || null, injectionTrigger: b.injectionTrigger || [], characterTagTrigger: b.characterTagTrigger || [], rest },
    };
    return p;
  });
  // SillyTavern has no "after the history" position: those blocks simply come after the chat history marker
  const hist = prompts.findIndex(p => p.lumiverse.marker === 'chat_history');
  if (hist >= 0) {
    const post = prompts.filter(p => p.lumiverse.position === 'post_history');
    const rest = prompts.filter(p => p.lumiverse.position !== 'post_history');
    const at = rest.findIndex(p => p.lumiverse.marker === 'chat_history');
    prompts = [...rest.slice(0, at + 1), ...post, ...rest.slice(at + 1)];
  }
  // identifiers must be unique (two markers of one kind)
  const used = new Set();
  prompts.forEach(p => { let n = p.identifier, k = 2; while (used.has(n)) n = p.identifier + '-' + k++; p.identifier = n; used.add(n); });

  preset.name = String(d.name || 'Lumiverse preset');
  FIELD_MAP.forEach(([grp, key, st]) => {
    const v = isObj(d[grp]) ? d[grp][key] : undefined;
    if (st === 'send_if_empty_nudge' || v === undefined || v === null) return; // no counterpart / not set
    preset[st] = v;
  });
  preset.prompts = prompts;
  preset.prompt_order = [{ id: 0, character_id: 0, order: prompts.map(p => ({ identifier: p.identifier, enabled: p.enabled !== false })) }];
  const rx = (isObj(d.extensions) && Array.isArray(d.extensions.regex_scripts) ? d.extensions.regex_scripts : []).filter(isObj)
    .map(x => (isLumiScript(x) ? lumiToScript(x) : x));
  const ext = isObj(d.extensions) ? { ...d.extensions } : {};
  ext.regex_scripts = rx;
  ext.lumiverse = lumi;
  preset.extensions = ext;
  return { preset, notes: { blocks: prompts.length, regex: rx.length, settings: raw.reduce((n, b) => n + (Array.isArray(b.variables) ? b.variables.length : 0), 0), macros: foreignMacros(raw) } };
}

// A LoreOS preset back to a Lumiverse one (everything that was kept on import goes back as it was)
export function presetToLoom(preset) {
  const ext = isObj(preset.extensions) ? preset.extensions : {};
  const base = isObj(ext.lumiverse) ? JSON.parse(JSON.stringify(ext.lumiverse)) : {};
  const out = {
    ...base,
    name: preset.name || base.name || 'Preset',
    schemaVersion: base.schemaVersion || 1,
    description: base.description || '',
  };
  ['samplerOverrides', 'promptBehavior', 'completionSettings', 'advancedSettings'].forEach(g => { out[g] = isObj(out[g]) ? out[g] : {}; });
  FIELD_MAP.forEach(([grp, key, st]) => {
    if (st === 'send_if_empty_nudge') return;
    if (preset[st] !== undefined) out[grp][key] = preset[st];
  });
  if (out.samplerOverrides.enabled === undefined) out.samplerOverrides.enabled = true;

  const order = ((preset.prompt_order || [])[0] || {}).order || [];
  const byId = {};
  (preset.prompts || []).forEach(p => { byId[p.identifier] = p; });
  const ordered = order.map(o => byId[o.identifier]).filter(Boolean);
  (preset.prompts || []).forEach(p => { if (!ordered.includes(p)) ordered.push(p); });
  out.blocks = ordered.map(p => {
    const l = isObj(p.lumiverse) ? p.lumiverse : {};
    const marker = p.marker ? (MARKER_REV[p.identifier.replace(/-\d+$/, '')] || l.marker || null) : (l.marker || null);
    let position = l.position === 'post_history' && p.injection_position !== 1 ? 'post_history' : 'pre_history';
    if (p.injection_position === 1) position = 'in_history';
    const role = p.role === 'user' && l.role === 'user_append' ? 'user_append' : p.role || 'system';
    return {
      ...(isObj(l.rest) ? l.rest : {}),
      id: l.id || p.id || p.identifier, name: p.name || '', content: p.content || '', role,
      enabled: p.enabled !== false, position, depth: position === 'in_history' ? Number(p.injection_depth) || 0 : (Number.isFinite(Number(l.depth)) ? Number(l.depth) : 0),
      marker, isLocked: !!l.isLocked, color: l.color || null, injectionTrigger: l.injectionTrigger || [], group: l.group || null,
      categoryMode: l.categoryMode || null, characterTagTrigger: l.characterTagTrigger || [],
    };
  });
  out.extensions = { ...Object.fromEntries(Object.entries(ext).filter(([k]) => k !== 'lumiverse' && k !== 'regex_scripts')),
    regex_scripts: (ext.regex_scripts || []).map(scriptToLumi) };
  out.updatedAt = Math.floor(Date.now() / 1000);
  return out;
}
