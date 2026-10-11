// ═══════════════════════════════════════════════════════
// PROMPT PACKS — the data model (no DOM, no storage: plain functions, easy to test).
//
// A pack is a modular prompt system for frontends that have no preset support
// (JanitorAI, SaucepanAI, ...): pick ONE base prompt, stack optional modules
// under it, and copy the result into the platform's prompt fields.
//
//   pack = {
//     description, intro,                       free text shown on the exported page
//     groups:  [{ id, name, pick: 'one'|'any' }],            modules are grouped, a group is "pick one" or "any"
//     modules: [{ id, groupId, name, text, notes }],
//     sets:    [{ id, name, description, moduleIds, raw }],  ready-made combinations ("Maiden", ...)
//     targets: [{ id, name, fields: [{ id, label, where, all, groupIds }] }],  the platform's prompt boxes: which groups go in each
//     selection: [moduleId],                    the stack currently built
//     docSections: [{ title, markdown }],       written guidance kept verbatim (How To Use, settings tables, ...)
//   }
//
// A target field either takes everything (`all`) or the groups it lists (an empty list means an
// empty box). That is how a platform with several prompt boxes gets its stack split: base +
// intimacy in one, game modules in another. `where` is a reminder of where the box lives on the platform.
// ═══════════════════════════════════════════════════════

let idCounter = 0;
export function pid(prefix = 'x') { return prefix + Date.now().toString(36) + (idCounter++).toString(36) + Math.floor(Math.random() * 1296).toString(36); }

export function blankPack() {
  const base = pid('g'), mods = pid('g');
  return {
    description: '',
    intro: '',
    groups: [{ id: base, name: 'Base prompt', pick: 'one' }, { id: mods, name: 'Modules', pick: 'any' }],
    modules: [{ id: pid('m'), groupId: base, name: 'My base prompt', text: '', notes: '' }],
    sets: [],
    targets: [defaultTarget()],
    selection: [],
    docSections: [],
    preview: { char: '', user: '', replace: false },
  };
}

export function defaultTarget() {
  return { id: pid('t'), name: 'All in one', fields: [{ id: pid('f'), label: 'Prompt', where: '', all: true, groupIds: [] }] };
}

// Make sure a pack read from storage / a file has every field with the right shape
export function normalizePack(p) {
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const out = isObj(p) ? p : {};
  const str = v => (typeof v === 'string' ? v : '');
  out.description = str(out.description);
  out.intro = str(out.intro);
  out.groups = (Array.isArray(out.groups) ? out.groups : []).filter(isObj)
    .map(g => ({ id: str(g.id) || pid('g'), name: str(g.name) || 'Group', pick: g.pick === 'one' ? 'one' : 'any' }));
  const gids = new Set(out.groups.map(g => g.id));
  out.modules = (Array.isArray(out.modules) ? out.modules : []).filter(isObj)
    .map(m => ({ id: str(m.id) || pid('m'), groupId: str(m.groupId), name: str(m.name) || 'Module', text: str(m.text), notes: str(m.notes) }));
  // A module whose group is missing goes into a catch-all group instead of vanishing
  if (out.modules.some(m => !gids.has(m.groupId))) {
    let other = out.groups.find(g => g.name === 'Other');
    if (!other) { other = { id: pid('g'), name: 'Other', pick: 'any' }; out.groups.push(other); }
    out.modules.forEach(m => { if (!gids.has(m.groupId)) m.groupId = other.id; });
  }
  const mids = new Set(out.modules.map(m => m.id));
  out.sets = (Array.isArray(out.sets) ? out.sets : []).filter(isObj)
    .map(s => ({ id: str(s.id) || pid('s'), name: str(s.name) || 'Set', description: str(s.description), raw: str(s.raw),
      moduleIds: (Array.isArray(s.moduleIds) ? s.moduleIds : []).filter(i => mids.has(i)) }));
  out.targets = (Array.isArray(out.targets) ? out.targets : []).filter(isObj).map(t => ({
    id: str(t.id) || pid('t'), name: str(t.name) || 'Target',
    fields: (Array.isArray(t.fields) ? t.fields : []).filter(isObj).map(f => {
      const groupIds = (Array.isArray(f.groupIds) ? f.groupIds : []).filter(i => gids.has(i) || out.groups.some(g => g.id === i));
      // Boxes saved before `all` existed treated an empty list as "everything"
      const all = typeof f.all === 'boolean' ? f.all : groupIds.length === 0;
      return { id: str(f.id) || pid('f'), label: str(f.label) || 'Prompt', where: str(f.where), all, groupIds };
    }),
  })).filter(t => t.fields.length);
  if (!out.targets.length) out.targets = [defaultTarget()];
  out.selection = (Array.isArray(out.selection) ? out.selection : []).filter(i => mids.has(i));
  out.docSections = (Array.isArray(out.docSections) ? out.docSections : []).filter(isObj)
    .map(d => ({ title: str(d.title), markdown: str(d.markdown) }));
  // Preview settings (names to fill in when copying) and which target is showing
  const pv = isObj(out.preview) ? out.preview : {};
  out.preview = { char: str(pv.char), user: str(pv.user), replace: !!pv.replace };
  out.activeTarget = out.targets.some(t => t.id === out.activeTarget) ? out.activeTarget : out.targets[0].id;
  return out;
}

// ── Numbers ──
// A rough token count (about 4 characters per token for English). Real counts differ per model.
export function estimateTokens(text) {
  const t = String(text || '');
  return t.trim() ? Math.ceil(t.length / 4) : 0;
}
export const fmtTokens = n => '~' + n.toLocaleString('en-US') + ' tokens';

// Fill in {{char}} and {{user}} (any letter case) when names are given; otherwise leave them for the platform to fill
export function substituteNames(text, { char = '', user = '' } = {}) {
  let out = String(text || '');
  if (char) out = out.replace(/\{\{\s*char\s*\}\}/gi, () => char);
  if (user) out = out.replace(/\{\{\s*user\s*\}\}/gi, () => user);
  return out;
}

// ── Building the stack ──
// Modules in pack order: group order first, then the order inside the group.
export function orderedModules(pack) {
  const out = [];
  pack.groups.forEach(g => pack.modules.filter(m => m.groupId === g.id).forEach(m => out.push(m)));
  return out;
}

// Selection with the "pick one" rule enforced (the first chosen module in such a group wins)
export function cleanSelection(pack, selection) {
  const chosen = new Set(selection);
  const out = [];
  pack.groups.forEach(g => {
    const mine = pack.modules.filter(m => m.groupId === g.id && chosen.has(m.id));
    if (g.pick === 'one') { if (mine.length) out.push(mine[0].id); } else mine.forEach(m => out.push(m.id));
  });
  return out;
}

// Toggle a module in a selection, respecting "pick one" groups
export function toggleModule(pack, selection, moduleId) {
  const m = pack.modules.find(x => x.id === moduleId);
  if (!m) return selection.slice();
  const g = pack.groups.find(x => x.id === m.groupId);
  const has = selection.includes(moduleId);
  let next = selection.filter(i => i !== moduleId);
  if (!has) {
    if (g && g.pick === 'one') next = next.filter(i => { const o = pack.modules.find(x => x.id === i); return !o || o.groupId !== g.id; });
    next.push(moduleId);
  }
  return cleanSelection(pack, next);
}

// The text for each field of a target: [{ label, text, tokens, moduleNames }]
export function buildOutputs(pack, selection, target, names = {}) {
  const sel = new Set(cleanSelection(pack, selection));
  const mods = orderedModules(pack).filter(m => sel.has(m.id));
  const t = target || pack.targets[0] || defaultTarget();
  return t.fields.map(f => {
    const take = f.all ? null : new Set(f.groupIds || []);
    const mine = mods.filter(m => !take || take.has(m.groupId));
    const text = mine.map(m => substituteNames(m.text.replace(/\s+$/, ''), names)).filter(Boolean).join('\n\n');
    return { label: f.label, text, tokens: estimateTokens(text), moduleNames: mine.map(m => m.name) };
  });
}

// ── Sets ──
export function applySet(pack, setId) {
  const s = pack.sets.find(x => x.id === setId);
  if (!s) return pack.selection.slice();
  // Sets usually leave out the base prompt: keep the one already chosen
  const base = pack.groups.find(g => g.pick === 'one');
  const keep = pack.selection.filter(id => {
    const m = pack.modules.find(x => x.id === id);
    return m && base && m.groupId === base.id && !s.moduleIds.some(i => { const o = pack.modules.find(x => x.id === i); return o && o.groupId === base.id; });
  });
  return cleanSelection(pack, [...keep, ...s.moduleIds]);
}

// ═══════════════════════════════════════════════════════
// MARKDOWN: import a page like the F.A.Y.E. OS prompt page, and export one
//
//   # Pack title
//   > description
//   ## Group name           (a line saying "pick one" makes the group pick-one)
//   ### Module name (~620 tokens)
//   optional notes, then the prompt text in a ``` code block
//   ## Prebuilt Sets        (bold set names, each followed by a > "A + B" line)
//   ## Anything else        kept word for word as a doc section
// ═══════════════════════════════════════════════════════
const stripTokens = s => s.replace(/\s*\(\s*~?\s*[\d,.]+\s*k?\s*tokens?\s*\)\s*$/i, '').trim();
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Split lines into fenced-code aware blocks by heading level
function splitByHeading(lines, level) {
  const re = new RegExp('^#{' + level + '}\\s+(.*)$');
  const blocks = [];
  let cur = { title: null, lines: [] };
  let fence = false;
  lines.forEach(line => {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = !fence && !/^\s*```/.test(line) ? line.match(re) : null;
    if (m) { blocks.push(cur); cur = { title: m[1].trim(), lines: [] }; }
    else cur.lines.push(line);
  });
  blocks.push(cur);
  return blocks;
}

// Pull fenced code blocks out of lines: { text: lines outside code, codes: [string] }
function extractCode(lines) {
  const codes = [], rest = [];
  let fence = false, buf = [];
  lines.forEach(line => {
    if (/^\s*```/.test(line)) {
      if (fence) { codes.push(buf.join('\n')); buf = []; fence = false; } else { fence = true; }
      return;
    }
    if (fence) buf.push(line); else rest.push(line);
  });
  if (fence) codes.push(buf.join('\n')); // unclosed fence at the end of the file
  // Horizontal rules between sections are page layout, not part of a module's notes
  const text = rest.filter(l => !/^\s*---+\s*$/.test(l)).join('\n').trim();
  return { text, codes };
}

const unquote = lines => lines.map(l => l.replace(/^\s*>\s?/, '')).join('\n').trim();

export function parseMarkdownPack(md) {
  const report = { modules: 0, groups: 0, sets: 0, docSections: 0, unresolved: [] };
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const pack = blankPack();
  pack.groups = []; pack.modules = [];
  let name = 'Imported prompt pack';

  // h1 title and the lead-in before the first h2
  const h2s = splitByHeading(lines, 2);
  const lead = h2s[0].lines;
  const h1i = lead.findIndex(l => /^#\s+/.test(l));
  if (h1i >= 0) name = lead[h1i].replace(/^#\s+/, '').trim() || name;
  const afterTitle = h1i >= 0 ? lead.slice(h1i + 1) : lead;
  const descLines = [], introLines = [];
  let inDesc = true;
  afterTitle.forEach(l => {
    if (inDesc && (/^\s*>/.test(l) || (!l.trim() && descLines.length === 0))) { if (/^\s*>/.test(l)) descLines.push(l); return; }
    if (inDesc && !l.trim() && descLines.length) { inDesc = false; return; }
    inDesc = false;
    if (/^\s*---+\s*$/.test(l)) return;
    introLines.push(l);
  });
  pack.description = unquote(descLines);
  pack.intro = introLines.join('\n').trim();

  const setsBlocks = [];
  h2s.slice(1).forEach(block => {
    const title = stripTokens(block.title || '');
    // Strip the separator line that usually ends a section
    const body = block.lines.slice();
    while (body.length && (!body[body.length - 1].trim() || /^\s*---+\s*$/.test(body[body.length - 1]))) body.pop();

    if (/pre-?built sets?/i.test(title) || /^sets?$/i.test(title)) { setsBlocks.push(body); return; }

    const h3s = splitByHeading(body, 3);
    const direct = extractCode(h3s[0].lines);
    const subs = h3s.slice(1).map(b => ({ title: stripTokens(b.title), ...extractCode(b.lines) }));
    const moduleSubs = subs.filter(s => s.codes.length);

    if (!moduleSubs.length && !direct.codes.length) {
      // Guidance, tables, recommended settings...: keep it exactly as written
      const raw = ['## ' + (block.title || ''), ...body].join('\n').trim();
      pack.docSections.push({ title, markdown: raw });
      report.docSections++;
      return;
    }

    const gid = pid('g');
    const rule = /pick\s+\**one\**/i.test(direct.text) ? 'one' : 'any';
    pack.groups.push({ id: gid, name: title, pick: rule });
    report.groups++;
    if (direct.codes.length) {
      pack.modules.push({ id: pid('m'), groupId: gid, name: title, text: direct.codes.join('\n\n'), notes: direct.text });
      report.modules++;
    }
    subs.forEach(s => {
      if (s.codes.length) {
        pack.modules.push({ id: pid('m'), groupId: gid, name: s.title, text: s.codes.join('\n\n'), notes: s.text });
        report.modules++;
      }
    });
  });

  // Prebuilt sets: **NAME** — description, then a "> A + B" line
  setsBlocks.forEach(body => {
    for (let i = 0; i < body.length; i++) {
      const m = body[i].match(/^\*\*(.+?)\*\*\s*(?:[—–-]\s*)?(.*)$/);
      if (!m) continue;
      let j = i + 1;
      while (j < body.length && !body[j].trim()) j++;
      const q = [];
      while (j < body.length && /^\s*>/.test(body[j])) { q.push(body[j]); j++; }
      const raw = unquote(q);
      if (!raw) continue;
      const { ids, missing } = resolveStack(pack, raw);
      pack.sets.push({ id: pid('s'), name: m[1].replace(/^[^\p{L}\p{N}]+/u, '').trim() || m[1].trim(), description: m[2].trim(), moduleIds: ids, raw });
      report.sets++;
      missing.forEach(x => report.unresolved.push(x));
      i = j - 1;
    }
  });

  if (pack.groups.length) {
    const first = pack.groups[0];
    // The first group is normally the base prompt: choose the first module of a pick-one first group
    if (first.pick === 'one') { const m0 = pack.modules.find(m => m.groupId === first.id); if (m0) pack.selection = [m0.id]; }
  }
  return { name, pack: normalizePack(pack), report };
}

// "A + B + C" -> module ids. Names are matched loosely: the module name, the part before a dash,
// or "<name> <group>" / "<group> <name>" (so "SFW Status Report" finds SFW in the Status Report group).
export function resolveStack(pack, text) {
  const ids = [], missing = [];
  String(text || '').split('+').map(s => s.trim()).filter(Boolean).forEach(tok => {
    const t = norm(tok);
    if (!t || t === 'base') return; // "Base" means whichever base prompt is chosen
    const groupBase = g => norm(g.name).replace(/\s(modules?|prompts?)$/, '');
    const score = m => {
      const g = pack.groups.find(x => x.id === m.groupId);
      const full = norm(m.name), head = norm(m.name.split(/\s[—–-]\s/)[0]);
      const gb = g ? groupBase(g) : '';
      if (t === full || t === head) return 3;
      if (g && (t === norm(m.name + ' ' + gb) || t === norm(gb + ' ' + m.name) || t === norm(head + ' ' + gb) || t === norm(gb + ' ' + head))) return 3;
      if (full.startsWith(t) || head.startsWith(t)) return 2;
      if (g && t === gb) return 1; // just the group name: its first module
      return 0;
    };
    let best = null, bestScore = 0;
    pack.modules.forEach(m => { const s = score(m); if (s > bestScore) { best = m; bestScore = s; } });
    if (best) { if (!ids.includes(best.id)) ids.push(best.id); } else missing.push(tok);
  });
  return { ids, missing };
}

// ── Export a page in the same shape ──
export function packToMarkdown(name, pack) {
  const out = [];
  out.push('# ' + (name || 'Prompt pack'), '');
  if (pack.description) { out.push(...pack.description.split('\n').map(l => '> ' + l), ''); }
  if (pack.intro) out.push(pack.intro, '');
  out.push('---', '');
  pack.docSections.forEach(d => { out.push(d.markdown.trim(), '', '---', ''); });
  pack.groups.forEach(g => {
    const mods = pack.modules.filter(m => m.groupId === g.id);
    if (!mods.length) return;
    out.push('## ' + g.name, '');
    if (g.pick === 'one') out.push('Pick **one** and append under the base prompt.', '');
    mods.forEach(m => {
      out.push('### ' + m.name + ' (' + fmtTokens(estimateTokens(m.text)).replace('~', '~') + ')', '');
      if (m.notes) out.push(m.notes, '');
      out.push('```', m.text.replace(/\s+$/, ''), '```', '');
    });
    out.push('---', '');
  });
  if (pack.sets.length) {
    out.push('## Prebuilt Sets', '');
    pack.sets.forEach(s => {
      const stack = s.raw || s.moduleIds.map(id => (pack.modules.find(m => m.id === id) || {}).name).filter(Boolean).join(' + ');
      out.push('**' + s.name + '**' + (s.description ? ' — ' + s.description : ''), '', '> ' + stack, '');
    });
    out.push('---', '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ── JSON (LoreOS to LoreOS) ──
export const PACK_FORMAT = 'loreos-prompt-pack';
export function packToJson(name, pack) { return JSON.stringify({ format: PACK_FORMAT, version: 1, name, pack }, null, 2); }
export function parsePackJson(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
  if (!data || data.format !== PACK_FORMAT || !data.pack) throw new Error('That is not a LoreOS prompt pack.');
  return { name: String(data.name || 'Imported prompt pack'), pack: normalizePack(data.pack) };
}

// Suggested layouts for the platforms' prompt boxes. Boxes with nothing obvious to hold stay empty
// until you assign groups to them.
//   SaucepanAI: Provider Pre-Content and Provider Post-Content live in the LLM settings;
//               Advanced Prompt and Formatting Instructions in the advanced chat settings.
//   JanitorAI:  Global Prompt and Prefill (Chat Memory is the usual workaround for game/tracker modules).
export function suggestSplit(pack, platform) {
  const extra = g => /game|status|report|commentary|transmigration|cyoa|fun|tracker/i.test(g.name);
  const isPost = g => /post|reminder|jailbreak|ending/i.test(g.name);
  const isFormat = g => /format/i.test(g.name);
  const isPrefill = g => /prefill/i.test(g.name);
  const taken = new Set();
  const pick = test => pack.groups.filter(g => !taken.has(g.id) && test(g)).map(g => { taken.add(g.id); return g.id; });
  const box = (label, where, groupIds) => ({ id: pid('f'), label, where, all: false, groupIds });
  if (platform === 'janitor') {
    const prefill = pick(isPrefill), memory = pick(extra);
    const core = pack.groups.filter(g => !taken.has(g.id)).map(g => g.id);
    const fields = [box('Global Prompt', '', core)];
    if (memory.length) fields.push(box('Chat Memory', 'workaround for game and tracker modules', memory));
    fields.push(box('Prefill', '', prefill));
    return { id: pid('t'), name: 'JanitorAI', fields };
  }
  const post = pick(isPost), format = pick(isFormat), advanced = pick(extra);
  const pre = pack.groups.filter(g => !taken.has(g.id)).map(g => g.id);
  return { id: pid('t'), name: 'SaucepanAI', fields: [
    box('Provider Pre-Content', 'LLM settings', pre),
    box('Provider Post-Content', 'LLM settings', post),
    box('Advanced Prompt', 'advanced chat settings', advanced),
    box('Formatting Instructions', 'advanced chat settings', format),
  ] };
}
