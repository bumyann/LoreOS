// ═══════════════════════════════════════════════════════
// PRONOUN MACRO TOOL
// ═══════════════════════════════════════════════════════

// ── Pronoun patterns per source ──
// Each entry: { regex, type, macro, ambiguous? }
// Order matters — longer/more specific patterns first
function getPatterns(src) {
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
    { re: /\bhis\b/gi,        macro: 'poss',  ambig: 'poss_p' },
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
function getTokenOutput(tok, tgt, originalText) {
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
function tokenizeForManual(text, src) {
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
      converted: false,
    });
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), type: 'text' });
  return tokens;
}

function renderManualDisplay(tokens) {
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
      if (tok.converted && tok.needsVerbFix) {
        const isSingularTgt = tgt === 'he' || tgt === 'she';
        const isPluralTgt = tgt === 'they';
        const nextTok = tokens[i+1];
        const prevTok = tokens[i-1];
        if (isSingularTgt) {
          if (nextTok?.type === 'text') nextTok.text = nextTok.text.replace(/^\s+(are|were|have|do|don't|haven't|weren't)\b/i, (_, v) => ' ' + (SINGULAR_VERB_FIX[v.toLowerCase()] || v));
          if (prevTok?.type === 'text') prevTok.text = prevTok.text.replace(/(are|were|have|do|don't|haven't|weren't)\s*$/i, (_, v) => (SINGULAR_VERB_FIX[v.toLowerCase()] || v) + ' ');
        }
        // src=he/she → they: fix singular verbs to plural
        if (isPluralTgt) {
          if (nextTok?.type === 'text') nextTok.text = nextTok.text.replace(/^\s+(is|was|has|does|doesn't|hasn't|wasn't)\b/i, (_, v) => ' ' + (THEY_VERB_FIX[v.toLowerCase()] || v));
          if (prevTok?.type === 'text') prevTok.text = prevTok.text.replace(/(is|was|has|does|doesn't|hasn't|wasn't)\s*$/i, (_, v) => (THEY_VERB_FIX[v.toLowerCase()] || v) + ' ');
        }
        // macro mode uses existing singular fix
        if (tgt === 'macro') {
          if (nextTok?.type === 'text') nextTok.text = nextTok.text.replace(/^\s+(are|were|have|do|don't|haven't|weren't)\b/i, (_, v) => ' ' + (SINGULAR_VERB_FIX[v.toLowerCase()] || v));
          if (prevTok?.type === 'text') prevTok.text = prevTok.text.replace(/(are|were|have|do|don't|haven't|weren't)\s*$/i, (_, v) => (SINGULAR_VERB_FIX[v.toLowerCase()] || v) + ' ');
        }
      }
      renderManualDisplay(tokens);
    });
    wrap.appendChild(span);
  });
}

function getManualResult(tokens) {
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

function tokenizeForNouns(text) {
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

function getNounOutput(tok) {
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

function renderNounDisplay(tokens) {
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

function getNounResult(tokens) {
  return tokens.map(tok => {
    if (tok.type === 'text') return tok.text;
    if (!tok.converted) return tok.text;
    return getNounOutput(tok);
  }).join('');
}

// ── Wire up the tool ──
function wirePronounTool() {
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
    if (e.target.tagName === 'TEXTAREA' && mode === 'char') {
      // Exclude textareas inside the pronounTool itself and modals
      if (e.target.closest('#pronounTool') || e.target.closest('.modal')) return;
      PT.targetField = e.target;
      if (PT.open) ptRefreshManual();
    }
  });

  // Also track input[type=text] fields in char mode
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' && mode === 'char') {
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

function ptRefreshManual() {
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
