
// ── Pronoun/noun tool globals — must live here so wireEvents can reference PT ──
export const PT = {
  open: false,
  src: 'they',
  tgt: 'macro',
  targetField: null,
  manualTokens: [],
};
export const MACROS = {
  sub: '{{sub}}', obj: '{{obj}}', poss: '{{poss}}',
  poss_p: '{{poss_p}}', ref: '{{ref}}'
};
export const PRONOUN_FORMS = {
  he:   { sub: 'he',   obj: 'him',  poss: 'his',   poss_p: 'his',   ref: 'himself'   },
  she:  { sub: 'she',  obj: 'her',  poss: 'her',   poss_p: 'hers',  ref: 'herself'   },
  they: { sub: 'they', obj: 'them', poss: 'their', poss_p: 'theirs', ref: 'themselves' },
};
export const CONTRACTION_FORMS = {
  he:   { sub_is: "he's",   sub_ll: "he'll",   sub_d: "he'd",   sub_has: "he's"   },
  she:  { sub_is: "she's",  sub_ll: "she'll",  sub_d: "she'd",  sub_has: "she's"  },
  they: { sub_is: "they're", sub_ll: "they'll", sub_d: "they'd", sub_has: "they've" },
};
export const THEY_VERB_FIX = { is:'are', was:'were', has:'have', does:'do', "doesn't":"don't", "hasn't":"haven't", "wasn't":"weren't" };
export const SINGULAR_VERB_FIX = { are:'is', were:'was', have:'has', do:'does', "don't":"doesn't", "haven't":"hasn't", "weren't":"wasn't" };
export const NOUN_TABLE = [
  ['brother','sister','sibling'],['brothers','sisters','siblings'],
  ['father','mother','parent'],['dad','mom','parent'],
  ['son','daughter','child'],['sons','daughters','children'],
  ['uncle','aunt',null],['uncles','aunts',null],
  ['nephew','niece',null],['nephews','nieces',null],
  ['husband','wife','spouse'],['husbands','wives','spouses'],
  ['boyfriend','girlfriend','partner'],['boyfriends','girlfriends','partners'],
  ['king','queen','ruler'],['kings','queens','rulers'],
  ['prince','princess',null],['princes','princesses',null],
  ['lord','lady',null],['lords','ladies',null],
  ['sir',"ma'am",null],
  ['man','woman','person'],['men','women','people'],
  ['boy','girl',null],['boys','girls',null],
  ['gentleman','lady','person'],['gentlemen','ladies','people'],
  ['male','female',null],
  ['grandfather','grandmother','grandparent'],
  ['grandson','granddaughter','grandchild'],
  ['stepfather','stepmother','stepparent'],
  ['stepson','stepdaughter','stepchild'],
  ['godfather','godmother',null],['godson','goddaughter',null],
  ['widower','widow',null],
  ['actor','actress','actor'],
  ['waiter','waitress','server'],
  ['steward','stewardess','flight attendant'],
  ['landlord','landlady','landlord'],
];
export const NOUN_MAP = {};
// A word can belong to more than one row (e.g. "person" is the neutral of both
// man/woman and gentleman/lady; "parent" of father/mother and dad/mom). The
// first row listed wins, so every word converts to its closest counterpart
// instead of whichever row happened to be registered last.
NOUN_TABLE.forEach(([m, f, n]) => {
  const add = (word, src) => {
    if (!word) return;
    const key = word.toLowerCase();
    if (!NOUN_MAP[key]) NOUN_MAP[key] = { masc: m, fem: f, neutral: n, src };
  };
  add(m, 0); add(f, 1); add(n, 2);
});
export let PT_nounTgt = 'masc';
export let PT_nounTokens = [];
// ═══════════════════════════════════════════════════════
// PRONOUN MACRO TOOL
// ═══════════════════════════════════════════════════════

import { state } from './state.js';
import { copyToClipboard, g, toast } from './util.js';

// ── Pronoun patterns per source ──
// Each entry: { regex, type, macro, ambiguous? }
// Order matters — longer/more specific patterns first
export function getPatterns(src) {
  if (src === 'they') return [
    { re: /\bthey're\b/gi,    macro: 'sub',    verb: ' is',  contractVerb: true, contractKey: 'sub_is' },
    { re: /\bthey've\b/gi,    macro: 'sub',    verb: ' has', contractVerb: true, contractKey: 'sub_has' },
    { re: /\bthey'll\b/gi,    macro: 'sub',    verb: "'ll",  contractVerb: true, contractKey: 'sub_ll' },
    { re: /\bthey'd\b/gi,     macro: 'sub',    verb: "'d",   contractVerb: true, contractKey: 'sub_d' },
    { re: /\bthemselves\b/gi, macro: 'ref'   },
    { re: /\btheirs\b/gi,     macro: 'poss_p' },
    { re: /\btheir\b/gi,      macro: 'poss'  },
    { re: /\bthem\b/gi,       macro: 'obj'   },
    { re: /\bthey\b/gi,       macro: 'sub',   needsVerbFix: true },
  ];
  if (src === 'he') return [
    { re: /\bhe's\b/gi,       macro: 'sub',   verb: ' is',  contractVerb: true, contractKey: 'sub_is' },
    { re: /\bhe'd\b/gi,       macro: 'sub',   verb: "'d",   contractVerb: true, contractKey: 'sub_d' },
    { re: /\bhe'll\b/gi,      macro: 'sub',   verb: "'ll",  contractVerb: true, contractKey: 'sub_ll' },
    { re: /\bhimself\b/gi,    macro: 'ref'   },
    { re: /\bhim\b/gi,        macro: 'obj'   },
    { re: /\bhis\b/gi,        macro: 'poss_p', ambig: 'poss' },
    { re: /\bhe\b/gi,         macro: 'sub'   },
  ];
  if (src === 'she') return [
    { re: /\bshe's\b/gi,      macro: 'sub',   verb: ' is',  contractVerb: true, contractKey: 'sub_is' },
    { re: /\bshe'd\b/gi,      macro: 'sub',   verb: "'d",   contractVerb: true, contractKey: 'sub_d' },
    { re: /\bshe'll\b/gi,     macro: 'sub',   verb: "'ll",  contractVerb: true, contractKey: 'sub_ll' },
    { re: /\bherself\b/gi,    macro: 'ref'   },
    { re: /\bhers\b/gi,       macro: 'poss_p' },
    { re: /\bher\b/gi,        macro: 'obj',   ambig: 'poss' },
    { re: /\bshe\b/gi,        macro: 'sub'   },
  ];
  return [];
}

// Get the output text for a token given target mode
export function getTokenOutput(tok, tgt, originalText) {
  if (tgt === 'macro') {
    if (tok.contractVerb) return MACROS[tok.macro] + tok.verb;
    return MACROS[tok.macro];
  }
  // direct pronoun swap
  const forms = PRONOUN_FORMS[tgt];
  const contractions = CONTRACTION_FORMS[tgt];
  if (tok.contractVerb && tok.contractKey && contractions[tok.contractKey]) {
    // preserve original capitalisation
    const out = contractions[tok.contractKey];
    return originalText[0] === originalText[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
  }
  const out = forms[tok.macro] || forms['sub'];
  // preserve original capitalisation
  return originalText[0] === originalText[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
}

// ── Manual mode tokenizer ──
export function tokenizeForManual(text, src) {
  const patterns = getPatterns(src);
  const combined = new RegExp(
    patterns.map(p => p.re.source).join('|'), 'gi'
  );
  const tokens = [];
  let last = 0;
  let m;
  combined.lastIndex = 0;
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index), type: 'text' });
    const raw = m[0];
    const pat = patterns.find(p => new RegExp('^' + p.re.source + '$', 'i').test(raw));
    tokens.push({
      text: raw,
      originalText: raw,
      type: pat?.ambig ? 'ambiguous' : (src === 'he' ? 'pronoun-he' : src === 'she' ? 'pronoun-she' : 'pronoun'),
      macro: pat?.macro || 'sub',
      altMacro: pat?.ambig || null,
      contractVerb: pat?.contractVerb || false,
      contractKey: pat?.contractKey || null,
      verb: pat?.verb || '',
      needsVerbFix: pat?.needsVerbFix || false,
      // he/she as a bare subject: its verb turns plural when converted to they
      singularSub: !!pat && src !== 'they' && pat.macro === 'sub' && !pat.contractVerb,
      converted: false,
    });
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), type: 'text' });
  return tokens;
}

export function renderManualDisplay(tokens) {
  const wrap = g('ptManualDisplay');
  const tgt = PT.tgt || 'macro';
  wrap.innerHTML = '';
  tokens.forEach((tok, i) => {
    if (tok.type === 'text') {
      wrap.appendChild(document.createTextNode(tok.text));
      return;
    }
    const span = document.createElement('span');
    const outputText = getTokenOutput(tok, tgt, tok.originalText);
    span.className = 'pt-token ' + (tok.converted ? 'converted' : tok.type);
    span.textContent = tok.converted ? outputText : tok.text;
    span.title = tok.converted
      ? `converted → ${outputText} (click to undo)`
      : tok.type === 'ambiguous'
        ? `ambiguous — click to convert (cycles poss/poss_p)`
        : `click to convert → ${outputText}`;

    span.addEventListener('click', () => {
      if (tok.converted) {
        tok.converted = false;
      } else if (tok.type === 'ambiguous') {
        tok.converted = !tok.converted;
        if (tok.converted) {
          const nextTok = tokens[i+1];
          const nextText = nextTok?.text?.trimStart() || '';
          tok.macro = /^[a-z]/i.test(nextText) && !/^(is|was|has|does|did|will|would|could|should|to|the|a|an)\b/i.test(nextText)
            ? (tok.altMacro || tok.macro)
            : tok.macro;
        }
      } else {
        tok.converted = true;
      }
      // verb agreement for they/them source (needsVerbFix = "they are/were/have...")
      if (tok.converted && (tok.needsVerbFix || tok.singularSub)) {
        const isSingularTgt = tgt === 'he' || tgt === 'she';
        const isPluralTgt = tgt === 'they';
        const nextTok = tokens[i+1];
        const prevTok = tokens[i-1];
        if (isSingularTgt && tok.needsVerbFix) {
          if (nextTok?.type === 'text') nextTok.text = nextTok.text.replace(/^\s+(are|were|have|do|don't|haven't|weren't)\b/i, (_, v) => ' ' + (SINGULAR_VERB_FIX[v.toLowerCase()] || v));
          if (prevTok?.type === 'text') prevTok.text = prevTok.text.replace(/(are|were|have|do|don't|haven't|weren't)\s*$/i, (_, v) => (SINGULAR_VERB_FIX[v.toLowerCase()] || v) + ' ');
        }
        // src=he/she → they: fix singular verbs to plural
        if (isPluralTgt && tok.singularSub) {
          if (nextTok?.type === 'text') nextTok.text = nextTok.text.replace(/^\s+(is|was|has|does|doesn't|hasn't|wasn't)\b/i, (_, v) => ' ' + (THEY_VERB_FIX[v.toLowerCase()] || v));
          if (prevTok?.type === 'text') prevTok.text = prevTok.text.replace(/(is|was|has|does|doesn't|hasn't|wasn't)\s*$/i, (_, v) => (THEY_VERB_FIX[v.toLowerCase()] || v) + ' ');
        }
        // macro mode uses existing singular fix
        if (tgt === 'macro' && tok.needsVerbFix) {
          if (nextTok?.type === 'text') nextTok.text = nextTok.text.replace(/^\s+(are|were|have|do|don't|haven't|weren't)\b/i, (_, v) => ' ' + (SINGULAR_VERB_FIX[v.toLowerCase()] || v));
          if (prevTok?.type === 'text') prevTok.text = prevTok.text.replace(/(are|were|have|do|don't|haven't|weren't)\s*$/i, (_, v) => (SINGULAR_VERB_FIX[v.toLowerCase()] || v) + ' ');
        }
      }
      renderManualDisplay(tokens);
    });
    wrap.appendChild(span);
  });
}

export function getManualResult(tokens) {
  const tgt = PT.tgt || 'macro';
  return tokens.map(tok => {
    if (tok.type === 'text') return tok.text;
    if (!tok.converted) return tok.text;
    return getTokenOutput(tok, tgt, tok.originalText);
  }).join('');
}

// ══════════════════════════════════════════
// NOUN CONVERTER
// ══════════════════════════════════════════

export function tokenizeForNouns(text) {
  // Build regex from all known nouns
  const words = Object.keys(NOUN_MAP).sort((a,b) => b.length - a.length);
  const combined = new RegExp('\\b(' + words.map(w => w.replace(/'/g, "\\'")).join('|') + ')\\b', 'gi');
  const tokens = [];
  let last = 0;
  let m;
  combined.lastIndex = 0;
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index), type: 'text' });
    const raw = m[0];
    const entry = NOUN_MAP[raw.toLowerCase()];
    tokens.push({ text: raw, originalText: raw, type: 'noun', entry, converted: false });
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), type: 'text' });
  return tokens;
}

export function getNounOutput(tok) {
  const e = tok.entry;
  if (!e) return tok.text;
  let out;
  if (PT_nounTgt === 'masc') out = e.masc;
  else if (PT_nounTgt === 'fem') out = e.fem;
  else out = e.neutral || e.masc; // fallback if no neutral
  if (!out) out = tok.text; // no mapping
  // preserve capitalisation
  return tok.originalText[0] === tok.originalText[0].toUpperCase()
    ? out[0].toUpperCase() + out.slice(1)
    : out;
}

export function renderNounDisplay(tokens) {
  const wrap = g('ptNounDisplay');
  wrap.innerHTML = '';
  tokens.forEach(tok => {
    if (tok.type === 'text') { wrap.appendChild(document.createTextNode(tok.text)); return; }
    const span = document.createElement('span');
    const out = getNounOutput(tok);
    const isUseless = tok.entry && PT_nounTgt === 'neutral' && !tok.entry.neutral;
    span.className = 'pt-token ' + (tok.converted ? 'noun-converted' : (isUseless ? 'ambiguous' : 'noun'));
    span.textContent = tok.converted ? out : tok.text;
    span.title = isUseless
      ? `no neutral form — will stay as "${tok.text}"`
      : tok.converted
        ? `converted → ${out} (click to undo)`
        : `click to convert → ${out}`;
    span.addEventListener('click', () => {
      if (isUseless) return;
      tok.converted = !tok.converted;
      renderNounDisplay(tokens);
    });
    wrap.appendChild(span);
  });
}

export function getNounResult(tokens) {
  return tokens.map(tok => {
    if (tok.type === 'text') return tok.text;
    if (!tok.converted) return tok.text;
    return getNounOutput(tok);
  }).join('');
}

// ── Wire up the tool ──
export function wirePronounTool() {
  const tool = g('pronounTool');

  // Open/close handled by wireEvents (pronounToolBtn.onclick)
  g('ptClose').addEventListener('click', () => { tool.classList.remove('open'); PT.open = false; });

  // Source selector
  tool.querySelectorAll('[data-src]').forEach(btn => {
    btn.addEventListener('click', () => {
      PT.src = btn.dataset.src;
      tool.querySelectorAll('[data-src]').forEach(b => b.classList.toggle('active', b.dataset.src === PT.src));
      if (PT.targetField) ptRefreshManual();
    });
  });

  // Target selector (new)
  tool.querySelectorAll('[data-tgt]').forEach(btn => {
    btn.addEventListener('click', () => {
      PT.tgt = btn.dataset.tgt;
      tool.querySelectorAll('[data-tgt]').forEach(b => b.classList.toggle('active', b.dataset.tgt === PT.tgt));
      // re-render with new target
      if (PT.manualTokens.length) renderManualDisplay(PT.manualTokens);
    });
  });

  // Noun target selector
  tool.querySelectorAll('[data-noun-tgt]').forEach(btn => {
    btn.addEventListener('click', () => {
      PT_nounTgt = btn.dataset.nounTgt;
      tool.querySelectorAll('[data-noun-tgt]').forEach(b => b.classList.toggle('active', b.dataset.nounTgt === PT_nounTgt));
      if (PT_nounTokens.length) renderNounDisplay(PT_nounTokens);
    });
  });

  // Track focused textarea in char mode — catches all textareas anywhere on the page
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'TEXTAREA' && state.mode === 'char') {
      // Exclude textareas inside the pronounTool itself and modals
      if (e.target.closest('#pronounTool') || e.target.closest('.modal')) return;
      PT.targetField = e.target;
      if (PT.open) ptRefreshManual();
    }
  });

  // Also track input[type=text] fields in char mode
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' && state.mode === 'char') {
      if (e.target.closest('#pronounTool') || e.target.closest('.modal')) return;
      PT.targetField = e.target;
      if (PT.open) ptRefreshManual();
    }
  });

  // Pronoun buttons
  g('ptManualRefresh').addEventListener('click', ptRefreshManual);
  g('ptManualApply').addEventListener('click', () => {
    if (!PT.targetField || !PT.manualTokens.length) { toast('Nothing to apply.', 'warn'); return; }
    PT.targetField.value = getManualResult(PT.manualTokens);
    PT.targetField.dispatchEvent(new Event('input', { bubbles: true }));
    toast('Pronouns applied.', 'ok');
  });
  g('ptManualCopy').addEventListener('click', () => {
    if (!PT.manualTokens.length) { toast('Nothing to copy.', 'warn'); return; }
    copyToClipboard(getManualResult(PT.manualTokens))
      .then(ok => toast(ok ? 'Copied!' : 'Copy failed — select text manually.', ok ? 'ok' : 'warn'));
  });

  // Noun buttons
  g('ptNounApply').addEventListener('click', () => {
    if (!PT.targetField || !PT_nounTokens.length) { toast('Nothing to apply.', 'warn'); return; }
    PT.targetField.value = getNounResult(PT_nounTokens);
    PT.targetField.dispatchEvent(new Event('input', { bubbles: true }));
    toast('Nouns applied.', 'ok');
  });
  g('ptNounCopy').addEventListener('click', () => {
    if (!PT_nounTokens.length) { toast('Nothing to copy.', 'warn'); return; }
    copyToClipboard(getNounResult(PT_nounTokens))
      .then(ok => toast(ok ? 'Copied!' : 'Copy failed.', ok ? 'ok' : 'warn'));
  });
}

export function ptRefreshManual() {
  if (!PT.targetField) {
    g('ptManualDisplay').textContent = 'focus a text field first';
    g('ptNounDisplay').textContent = 'focus a text field first';
    return;
  }
  const text = PT.targetField.value;
  PT.manualTokens = tokenizeForManual(text, PT.src);
  renderManualDisplay(PT.manualTokens);
  PT_nounTokens = tokenizeForNouns(text);
  renderNounDisplay(PT_nounTokens);
}
