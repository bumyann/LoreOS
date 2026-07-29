
let tplMode = 'lore';
let tplTargetFieldId = null;
let lastFocusedField = null;

document.addEventListener('focusin', e => {
  if (['TEXTAREA','INPUT'].includes(e.target.tagName) && e.target.id !== 'tplNewName' && e.target.id !== 'tplNewContent') {
    lastFocusedField = e.target;
  }
});

function tplKey(m) { return m === 'lore' ? 'aet_tpl_lore' : m === 'preset' ? 'aet_tpl_preset' : 'aet_tpl_char'; }
function tplGet(m) { try { return JSON.parse(localStorage.getItem(tplKey(m)) || '{}'); } catch(e) { return {}; } }
function tplSet(m, d) { localStorage.setItem(tplKey(m), JSON.stringify(d)); }
function tplNewId() { return 't' + Date.now() + Math.floor(Math.random()*1000); }

// ═══════════════════════════════════════════════════════
// BUILT-IN TEMPLATES
// ═══════════════════════════════════════════════════════
const BUILTIN_TEMPLATES = {
  char: [
    {
      category: 'Basic',
      items: [
        { name: '📝 Standalone Character Card', content: `<character_overview>
\`OVERVIEW\`
Full Name:
Aliases/Nicknames:
Social Media Handle:
Gender & Pronouns:
Sexuality:
Species/Race:
Ethnicity:
Age:
Occupation:
Affiliation:
Residence:
</character_overview>


<appearance>
\`APPEARANCE\`
Hair:
Face:
Body:
Distinguishing Details:
</appearance>


<voice_and_speech>
\`VOICE & SPEECH\`
Tone/Cadence:
Vocabulary Level:
Speech Quirks:
Languages:
</voice_and_speech>


<clothing>
\`CLOTHING\`
Default:
Formal/Special:
Notable Item:
</clothing>


<background>
\`BACKGROUND\`
// full history — origin, formative events, what shaped them into who they are now
// no length limit here; write as much as the character needs

</background>


<personality>
\`PERSONALITY\`
Outwardly:
// more than one line — include what they hide, how they see themselves,
// the belief they carry about the world that colours everything else
Inwardly:
Core Need:
Core Fear:

When annoyed/angry:
When upset/hurt:
When content/happy:
When affectionate:
Love Language:
</personality>


<skills_and_interests>
\`SKILLS & INTERESTS\`
Skills:
Genuine Passions:
Dislikes/Aversions:
</skills_and_interests>


<behaviour_and_habits>
\`BEHAVIOUR & HABITS\`
Daily:
Social:
Under Pressure:
// what they do when stressed, overwhelmed, or pushed
Stress Response:
Recurring Habits:
// things they do that they don't notice
</behaviour_and_habits>


<sexual_behaviour>
\`SEXUAL BEHAVIOUR\`
General Approach:
What Intimacy Means To Them:
// not just preferences — what closeness actually represents emotionally
Turn-Ons:
Kinks/Preferences:
Hard Limits:
</sexual_behaviour>


<relationship_with_user>
\`RELATIONSHIP WITH {{user}}\`
Dynamic:
How They Met: // leave blank if user-defined
Current Status:
How They Feel About {{user}}:
// more than one line — what {{user}} makes them feel that others don't,
// what they'd never say directly, how their behaviour shifts around them
</relationship_with_user>


<voice_sample>
\`VOICE SAMPLE\`
"[line one — their default register]"
"[line two — optional, different mood]"
"[line three — optional]"
</voice_sample>


<notes>
\`NOTES\`
-
-
</notes>` },
        { name: '💬 Example Dialogues', content: `<example_dialogues>
\`EXAMPLE DIALOGUES\`
(FOR REFERENCE ONLY — NOT VERBATIM)


\`GREETING {{user}}\`
// first contact or re-entry into scene — sets baseline voice


\`HAPPY / LIGHT\`
// joy, amusement, something going right — how do they carry
// warmth? are they loud about it or does it leak out quietly?


\`ANGRY\`
// how does anger sound in their mouth — cold, loud, clipped,
// dangerously calm? do they go still or do they take up space?


\`UPSET / HURT\`
// distinct from angry — this is the soft underbelly
// do they go quiet? deflect? push away? overcorrect?


\`AWKWARD / CAUGHT OFF GUARD\`
// when they don't have a script — filler words, physical tells,
// what breaks their composure and how does it show?


\`EMBARRASSED\`
// different from awkward — there's heat here, something exposed
// do they lean into it, laugh it off, or try to bury it fast?


\`LOVING / TENDER\`
// the version of them that only comes out when guard is down
// can be subtle — love doesn't have to be declared to be felt


\`TENSE / GUARDED\`
// when something is wrong but they're not saying it
// subtext-heavy — what they say and what they mean should diverge


\`ADDITIONAL LINES\`
// voice anchors that don't fit a specific state —
// filler phrases, a line that's just very them, a deflection
// they use often, something they say when they're thinking

</example_dialogues>` },
        { name: '👤 Persona Card', content: `<user_persona>
\`PERSONA\`

<identity>
\`IDENTITY\`
Name:
Aliases/Nicknames:              // [OPTIONAL]
Gender & Pronouns:
Age:
Species/Race:                   // [OPTIONAL] leave blank if human default
Occupation/Role:                // [OPTIONAL] relevant if bots would know this
Affiliation:                    // [OPTIONAL] faction, school, group
</identity>


<appearance>
\`APPEARANCE\`
Hair:
Face:
Body:
Distinguishing Details:         // [OPTIONAL] scars, marks, anything notable
Default Clothing Style:         // [OPTIONAL]
</appearance>


<presence_and_bearing>
\`PRESENCE & BEARING\`
// how {{user}} comes across to others at first glance —
// not personality, but the impression they make physically
First Impression:
Energy:
</presence_and_bearing>


<personality>
\`PERSONALITY\`
// keep this light — broad strokes only
Surface:
Under The Surface:              // [OPTIONAL]
Notable Quirks:                 // [OPTIONAL]
</personality>


<voice_and_speech>
\`VOICE & SPEECH\`                // [OPTIONAL]
Tone/Cadence:
Speech Quirks:
</voice_and_speech>


<background>
\`BACKGROUND\`                    // [OPTIONAL]
// brief only — 2-3 sentences max
</background>


<skills_and_abilities>
\`SKILLS & ABILITIES\`            // [OPTIONAL]
Skills:
Abilities/Powers:               // [OPTIONAL]
</skills_and_abilities>


<notes>
\`NOTES\`
-
-
</notes>

</user_persona>` },
      ]
    },
    {
      category: 'Advanced',
      items: [
        { name: '📚 Lorebook-Paired Card', content: `<character_overview>
\`OVERVIEW\`
Full Name:
Aliases/Nicknames:
Social Media Handle:
Gender & Pronouns:
Sexuality:
Species/Race:
Ethnicity:
Age:
Occupation:
Affiliation:
Residence:
</character_overview>


<appearance>
\`APPEARANCE\`
Hair:
Face:
Body:
Distinguishing Details:
</appearance>


<voice_and_speech>
\`VOICE & SPEECH\`
Tone/Cadence:
Vocabulary Level:
Speech Quirks:
Languages:
</voice_and_speech>


<clothing>
\`CLOTHING\`
Default:
Formal/Special:
Notable Item:
</clothing>


<background_summary>
\`BACKGROUND\`
// 2–4 sentences. Public-facing only.

</background_summary>


<personality>
\`PERSONALITY\`
Outwardly:
Inwardly: // one line hint only
Core Need:
Core Fear:

When annoyed/angry:
When upset/hurt:
When content/happy:
When affectionate:
Love Language:
</personality>


<skills_and_interests>
\`SKILLS & INTERESTS\`
Skills:
Genuine Passions:
Dislikes/Aversions:
</skills_and_interests>


<behaviour_and_habits>
\`BEHAVIOUR & HABITS\`
Daily:
Social:
Stress Response:
</behaviour_and_habits>


<sexual_behaviour>
\`SEXUAL BEHAVIOUR\`
General Approach:
Turn-Ons:
Kinks/Preferences:
Hard Limits:
// interior experience → lorebook (Intimacy Layer)
</sexual_behaviour>


<relationship_with_user>
\`RELATIONSHIP WITH {{user}}\`
Dynamic:
How They Met: // leave blank if user-defined
Current Status:
Their Private Feeling About {{user}}: // one line only
</relationship_with_user>


<voice_sample>
\`VOICE SAMPLE\`
"[line one — their default register]"
"[line two — optional, different mood]"
"[line three — optional]"
</voice_sample>


<active_lorebooks>
\`LOREBOOKS\`
World Lorebook:        [ y / n ]
Series Lorebook:       [ y / n ]
Series NPCs Lorebook:  [ y / n ]
Personal Lorebook:     [ y / n ]
</active_lorebooks>


<notes>
\`NOTES\`
-
-
</notes>` },
      ]
    }
  ],
  lore: [
    {
      category: 'Character Lorebook',
      items: [
        { name: '🎤 Voice Anchor', content: `[CHARACTER] speaks [cadence]. They tend to [one verbal habit]. They rarely say [something they avoid]. A typical line: "[example]."` },
        { name: '📖 Backstory', content: `<backstory>
\`BACKSTORY\`

Early environment:

Family & key figures:

Formative period:

What was normal for them that wouldn't be for others:

What was missing:
</backstory>` },
        { name: '💭 Core Memories', content: `<core_memories>
\`CORE MEMORIES\`
// each entry is a specific moment, not a period or summary
// write with sensory detail

Memory — [label]:

Memory — [label]:

Memory — [label]:
</core_memories>` },
        { name: '🧠 Psychological Core', content: `<psychological_core>
\`PSYCHOLOGICAL CORE\`

Self-concept:

Core belief about the world:

Cognitive patterns:

Defence mechanisms:

Blind spots:

What they need that they'd never ask for:

What they fear becoming:
</psychological_core>` },
        { name: '💢 Emotional Mechanics', content: `<emotional_mechanics>
\`EMOTIONAL MECHANICS\`

Emotional baseline:

How quickly they feel things:

What triggers the strongest reactions:

How each emotion moves through them:
- Anger:
- Hurt:
- Fear:
- Love/affection:
- Joy:

How they process emotion:

How they show what they're not saying:
</emotional_mechanics>` },
        { name: '🔄 Behaviour Patterns', content: `<behaviour_patterns>
\`BEHAVIOUR PATTERNS\`

Under pressure:

When something is wrong but they won't say it:

When they're comfortable:

When they're being observed or evaluated:

Recurring habits they don't notice:

How they fill silence:

What they always do when [specific trigger]:
</behaviour_patterns>` },
        { name: '🤝 Relational Patterns', content: `<relational_patterns>
\`RELATIONAL PATTERNS\`

Attachment in practice:

How they get close to people:

What they do when someone gets too close:

What makes them trust someone:

What breaks trust for them:

How they love:

How they hurt people without meaning to:

What they look for in people without realising it:
</relational_patterns>` },
        { name: '👥 Private Relationship', content: `<private_relationship>
\`[NAME] — [RELATIONSHIP TYPE]\`

Who they are:

How [CHARACTER] genuinely feels about them:

History between them:

What's unresolved:

What [NAME] represents to [CHARACTER] unconsciously:

Current state:
</private_relationship>` },
        { name: '🎭 The Mask', content: `<the_mask>
\`THE MASK\`

What they present as:

What's actually happening underneath:

How it shows up in their behaviour:

What would have to happen for it to drop:

What they're most afraid of someone seeing:
</the_mask>` },
        { name: '🔒 Secrets & Hidden Lore', content: `<secrets>
\`SECRETS\`

What they're hiding and from whom:

Why:

What it would cost them if it came out:

How it affects their behaviour without anyone knowing why:

Physical evidence or tells:
</secrets>` },
        { name: '💞 {{user}} Dynamic', content: `<user_dynamic>
\`{{user}} DYNAMIC\`

Pre-established dynamic:

How they met / first impression:

What {{user}} makes them feel that others don't:

What {{user}} triggers in them psychologically:

What they would never say to {{user}} directly:

How their behaviour shifts around {{user}}:

What they want from {{user}} that they haven't named:

Where the unresolved feeling lives:
</user_dynamic>` },
        { name: '🔥 Intimacy', content: `<intimacy>
\`INTIMACY\`

What intimacy means to them emotionally:

How their psychological patterns show up here:

What they need but can't ask for:

What they do when someone gets genuinely close:

What makes them pull back:

What their body does before their mind catches up:

Specific behaviours only visible in intimate contexts:
</intimacy>` },
      ]
    },
    {
      category: 'General Lorebook',
      items: [
        { name: '🌌 Cosmological Entry', content: `<cosmological_entry>
\`LORE TITLE\`


\`WHAT IT IS\`
// 2–4 sentences — what is it, where does it exist, what is its fundamental nature?


\`SENSORY REALITY\`
// what it looks, sounds, feels like to exist within or near it
// skip if purely abstract


\`MECHANICS & RULES\`
-
-


\`WHO OR WHAT INHABITS IT\` // [OPTIONAL]


\`INTERACTION WITH MORTALS\`


\`RELATIONSHIP TO OTHER PLANES/CONCEPTS\` // [OPTIONAL]


\`NOTES\`

</cosmological_entry>` },
        { name: '🧬 Species Entry', content: `<species_entry>
\`LORE TITLE\`


\`WHAT THEY ARE\`
// 2–3 sentences — mortal or immortal? origin? what makes them distinct at a glance?


\`APPEARANCE\` // [OPTIONAL — skip if varies too widely]


\`BIOLOGY & LIFECYCLE\`


\`REPRODUCTION\` // [OPTIONAL]


\`ABILITIES & POWERS\`
// include limits and costs
-
-


\`MORTALITY & DEATH\`


\`SOCIAL BEHAVIOR & CULTURE\` // [OPTIONAL]


\`HOW THEY FIT IN THE WORLD\`


\`NOTES\`

</species_entry>` },
        { name: '🕍 Belief System Entry', content: `<belief_entry>
\`LORE TITLE\`


\`OVERVIEW\`
// 2–4 sentences — what does this system hold to be true? who/what do they worship?


\`MECHANICS\`
-
-


\`DEITIES & FIGURES\` // [OPTIONAL]
[DEITY/FIGURE]:
[DEITY/FIGURE]:


\`PRACTICES & RITUALS\` // [OPTIONAL]


\`SOCIAL ROLE\`


\`RELATIONSHIP TO OTHER FAITHS\` // [OPTIONAL]


\`NOTES\`

</belief_entry>` },
        { name: '📜 Historical Event Entry', content: `<historical_entry>
\`LORE TITLE\`


\`WHAT HAPPENED\`


\`BEFORE\`


\`DURING\`


\`AFTER\`


\`HOW IT IS REMEMBERED\`
// truth vs. what people believe — myth, denial, reverence, trauma?


\`RELEVANCE TO CHARACTERS\` // [OPTIONAL]


\`NOTES\`

</historical_entry>` },
        { name: '⚔️ Faction / Clan Entry', content: `<faction_entry>
\`LORE TITLE\`


\`OVERVIEW\`


\`HISTORY & ORIGIN\`


\`CURRENT ERA\`


\`INTERNAL STRUCTURE & HIERARCHY\`
-
-


\`CODE & VALUES\`


\`TERRITORY & PRESENCE\` // [OPTIONAL]


\`PUBLIC FACE VS. REALITY\`


\`RELATIONSHIP TO OTHER FACTIONS\` // [OPTIONAL]


\`NOTES\`

</faction_entry>` },
        { name: '🏛️ Institution Entry', content: `<institution_entry>
\`LORE TITLE\`


\`OVERVIEW\`


\`ADMISSION & ENTRY\`


\`STRUCTURE & PROGRAMMES\`


\`POPULATION & HIERARCHY\`


\`STAFF & LEADERSHIP\` // [OPTIONAL]


\`NOTABLE FEATURES\`


\`CULTURE & SOCIAL LIFE\`


\`NOTES\`

</institution_entry>` },
        { name: '📍 Location Entry', content: `<location_entry>
\`LORE TITLE\`


\`WHAT IT IS\`


\`ATMOSPHERE & SENSORY DETAIL\`


\`LAYOUT & FEATURES\`


\`WHO IS HERE\` // [OPTIONAL]


\`RULES & ACCESS\` // [OPTIONAL]


\`SOCIAL FUNCTION\`
// what does this place mean beyond its stated purpose?


\`NOTES\`

</location_entry>` },
        { name: '📊 Social System Entry', content: `<social_system_entry>
\`LORE TITLE\`


\`OVERVIEW\`


\`TIERS / CATEGORIES\`
// one block per tier — duplicate as needed

[TIER NAME]:
- Who belongs:
- What it grants them:
- How others perceive them:

[TIER NAME]:
- Who belongs:
- What it grants them:
- How others perceive them:


\`HOW ONE MOVES WITHIN IT\`


\`UNWRITTEN RULES\`


\`RELATIONSHIP TO POWER\` // [OPTIONAL]


\`HOW CHARACTERS ARE AFFECTED\`


\`NOTES\`

</social_system_entry>` },
      ]
    },
    {
      category: 'NPC Lorebook',
      items: [
        { name: '👤 NPC Profile', content: `<npc_name>
\`IDENTITY\`
Name:
Aliases/Nicknames:
Gender & Pronouns:
Species/Race:
Age:
Occupation/Role:
Affiliation:
Residence/Location:

\`PUBLIC APPEARANCE\`
// 2–3 visually distinctive details someone who's seen them would remember
Hair:
Face:
Body:
Distinguishing Details:

\`REPUTATION & PUBLIC PERCEPTION\`
General Reputation:
What People Assume:
Known For:

\`ROLE IN THE SERIES\`
Role:
Allegiances:
Notable Involvements: // [OPTIONAL]

\`RELATIONSHIPS TO OTHER NAMED CHARACTERS\`
// public-facing only — private feelings → character lorebook
[CHARACTER A]: [nature of connection]
[CHARACTER B]:

\`KNOWN BACKSTORY\`
// 2–4 sentences max, publicly discoverable only

\`SURFACE PERSONALITY\`
// 3–5 observable traits written as behaviour, not adjectives

\`NOTES\`
// cross-bot consistency flags
-
-
</npc_name>` },
        { name: '🔗 Relationship Entry', content: `<relationship_entry>
\`RELATIONSHIP OVERVIEW\`
[BOT NAME] — [NPC NAME]
Dynamic Type: // rivals, estranged, one-sided, complicated allies, something unspoken

\`INTERIOR FEELING\`
// how [BOT] genuinely feels — NOT how they act, NOT the public dynamic
What [BOT] actually feels:
What [BOT] would never admit:
What [NPC] represents to [BOT] unconsciously: // a wound, a reminder, a possibility, a threat

\`BEHAVIORAL SHIFT\`
How [BOT] acts around [NPC]:
What [BOT] does differently around [NPC] vs. others:
A tell that gives them away:

\`SHARED HISTORY\`
How they met:
A defining moment between them:
Something that shifted the dynamic:
What neither has addressed directly:

\`UNRESOLVED TENSION\`
What's unspoken:
What [BOT] wants from [NPC] but won't ask for:
What [NPC] wants from [BOT] that [BOT] either can't or won't give: // [OPTIONAL]

\`HOW THIS RELATIONSHIP HAS CHANGED [BOT]\`
// one or two lines — don't over-explain

</relationship_entry>` },
        { name: '🌊 NPC Depth Entry', content: `<npc_name_depth>
\`[NPC NAME] — BENEATH THE SURFACE\`

Core belief about the world:

Self-concept:

The mask: // what they present vs. what's actually there

What they need but would never ask for:

What would crack them open:

In pursuit/romantic contexts:
// what shifts, what surfaces, what they do when they can't redirect it
</npc_name_depth>` },
      ]
    }
  ]
};

// ═══════════════════════════════════════════════════════
// TEMPLATE LIBRARY MODAL
// ═══════════════════════════════════════════════════════
function openTemplateLibrary(m, fieldId) {
  tplMode = m;
  tplTargetFieldId = fieldId || null;
  g('tplModalTitle').textContent = m === 'lore' ? '// Lorebook Templates' : m === 'preset' ? '// Prompt Library' : '// Character Templates';
  g('tplSaveBtn').onclick = () => tplSaveCurrent(m, fieldId || null);
  renderTemplateList(m);
  openModal('tplModal');
}

function renderTemplateList(m) {
  const list = g('tplList');
  list.innerHTML = '';

  if (m === 'preset') {
    renderPresetAnchors(list);
    const tpls = tplGet(m);
    const items = Object.values(tpls).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
    if (items.length) {
      list.append(makeSectionHeader('// Saved Prompts'));
      renderSavedTemplates(items, m, list);
    }
    return;
  }

  // Built-in collapsible groups
  const builtins = BUILTIN_TEMPLATES[m] || [];
  builtins.forEach(group => {
    const groupEl = makeCollapsibleGroup(group.category, group.items, m);
    list.append(groupEl);
  });

  // User-saved templates
  const tpls = tplGet(m);
  const items = Object.values(tpls).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  if (items.length) {
    list.append(makeSectionHeader('// Saved'));
    renderSavedTemplates(items, m, list);
  } else if (!builtins.length) {
    list.innerHTML = '<div class="lib-empty">// no templates yet — save a field to get started</div>';
  }
}

function makeSectionHeader(text) {
  const el = document.createElement('div');
  el.style.cssText = 'font-family:var(--fx);font-size:.72rem;color:var(--p);letter-spacing:1px;padding:.35rem 0 .3rem;border-bottom:1px solid var(--bd);margin:.3rem 0 .2rem';
  el.textContent = text;
  return el;
}

function makeCollapsibleGroup(categoryName, items, m) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'border:1px solid var(--bd);border-radius:4px;overflow:hidden;margin-bottom:.3rem';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.4rem .65rem;background:var(--bg3);cursor:pointer;user-select:none';
  header.innerHTML = `
    <span style="font-family:var(--fx);font-size:.75rem;color:var(--txd);letter-spacing:.5px">${categoryName}</span>
    <span class="tpl-chevron" style="font-size:.65rem;color:var(--txm);transition:transform .15s">▼</span>
  `;

  const body = document.createElement('div');
  body.style.cssText = 'display:none;flex-direction:column;gap:.25rem;padding:.3rem .4rem';

  items.forEach(tpl => {
    const item = makeBuiltinItem(tpl, m);
    body.append(item);
  });

  header.addEventListener('click', () => {
    const isOpen = body.style.display === 'flex';
    body.style.display = isOpen ? 'none' : 'flex';
    header.querySelector('.tpl-chevron').style.transform = isOpen ? '' : 'rotate(180deg)';
  });

  wrapper.append(header, body);
  return wrapper;
}

function makeBuiltinItem(tpl, m) {
  const item = document.createElement('div');
  item.className = 'tpl-item';
  item.innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="tpl-name" style="display:flex;align-items:center;gap:.4rem">
        ${tpl.name}
        <span style="font-family:var(--fx);font-size:.56rem;padding:1px 4px;background:var(--sf2);border:1px solid var(--bd);border-radius:2px;color:var(--txm)">built-in</span>
      </div>
      <div class="tpl-preview">${tpl.content.substring(0,60).replace(/\n/g,' ')}…</div>
    </div>
    <div class="tpl-acts">
      <button class="btn btn-p btn-sm tpl-paste">Paste</button>
    </div>`;
  item.querySelector('.tpl-name').addEventListener('click', () => tplPaste(tpl));
  item.querySelector('.tpl-paste').addEventListener('click', () => tplPaste(tpl));
  return item;
}

function renderPresetAnchors(list) {
  list.append(makeSectionHeader('// ST System Anchors'));
  Object.entries(ST_SPECIAL).forEach(([id, info]) => {
    const item = document.createElement('div');
    item.className = 'tpl-item';
    item.style.background = 'var(--bg3)';
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="tpl-name" style="display:flex;align-items:center;gap:.4rem">
          ${info.label}
          <span style="font-family:var(--fx);font-size:.58rem;padding:1px 4px;background:var(--sf2);border:1px solid var(--bd);border-radius:2px;color:var(--p)">${id}</span>
        </div>
        <div class="tpl-preview">${info.desc}</div>
      </div>
      <div class="tpl-acts">
        <button class="btn btn-p btn-sm tpl-anchor-add">+ Add</button>
      </div>`;
    item.querySelector('.tpl-anchor-add').addEventListener('click', () => {
      const entry2 = presetLibrary[activePresetId];
      if (!entry2) { toast('Open a preset first.', 'warn'); return; }
      const newPr = {
        id, identifier: id,
        name: info.label.replace(/[^\w\s\-—]/g,'').trim(),
        content: '', enabled: true, role: 'system',
        system_prompt: id === 'main', marker: true,
        injection_position: 0, injection_depth: 4,
        injection_order: 100, injection_trigger: [], forbid_overrides: false
      };
      if (!entry2.preset.prompts) entry2.preset.prompts = [];
      entry2.preset.prompts.push(newPr);
      syncPromptOrder(entry2.preset);
      renderPromptList(entry2.preset.prompts);
      closeModal('tplModal');
      toast(`Added ${info.label} anchor.`, 'ok');
    });
    list.append(item);
  });
}

function renderSavedTemplates(items, m, list) {
  items.forEach(tpl => {
    const item = document.createElement('div');
    item.className = 'tpl-item';
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="tpl-name">${tpl.name}</div>
        <div class="tpl-preview">${(tpl.content||'').substring(0,80).replace(/\n/g,' ')}</div>
      </div>
      <div class="tpl-acts">
        <button class="btn btn-p btn-sm tpl-paste">Paste</button>
        <button class="btn btn-err btn-sm tpl-del">✕</button>
      </div>`;
    item.querySelector('.tpl-name').addEventListener('click', () => tplPaste(tpl));
    item.querySelector('.tpl-paste').addEventListener('click', () => tplPaste(tpl));
    item.querySelector('.tpl-del').addEventListener('click', async () => {
      if (!await askConfirm(`Delete "${tpl.name}"?`)) return;
      const d = tplGet(m); delete d[tpl.id]; tplSet(m, d);
      renderTemplateList(m);
    });
    list.append(item);
  });
}

function tplPaste(tpl) {
  const el = tplTargetFieldId ? g(tplTargetFieldId) : lastFocusedField;
  if (!el || !['TEXTAREA','INPUT'].includes(el.tagName)) {
    toast('Focus a field first, then paste.', 'warn'); return;
  }
  el.value = tpl.content;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  closeModal('tplModal');
  toast(`Pasted "${tpl.name}".`, 'ok');
}

async function tplSaveCurrent(m, fieldId) {
  const name = g('tplNewName').value.trim();
  if (!name) { toast('Enter a template name.', 'warn'); return; }
  const directContent = g('tplNewContent')?.value || '';
  let content = directContent.trim();
  if (!content) {
    const el = fieldId ? g(fieldId) : lastFocusedField;
    content = (el && ['TEXTAREA','INPUT'].includes(el.tagName)) ? el.value.trim() : '';
  }
  if (!content) { toast('No content — paste into the box or focus a field.', 'warn'); return; }
  const d = tplGet(m);
  const id = tplNewId();
  d[id] = { id, name, content, savedAt: new Date().toISOString() };
  tplSet(m, d);
  g('tplNewName').value = '';
  if (g('tplNewContent')) g('tplNewContent').value = '';
  renderTemplateList(m);
  toast(`Saved template "${name}".`, 'ok');
}

// ═══════════════════════════════════════════════════════
// ENTRY TYPE PICKER (+ New Entry flow)
// ═══════════════════════════════════════════════════════
function openEntryPicker() {
  const categories = g('pickerCategories');
  categories.innerHTML = '';

  BUILTIN_TEMPLATES.lore.forEach(group => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-s';
    btn.style.cssText = 'justify-content:flex-start;padding:.5rem .75rem;text-align:left';
    btn.textContent = group.category;
    btn.addEventListener('click', () => {
      closeModal('entryPickerModal');
      // Create entry first, then open template library scoped to this category
      const uid = nextUid++;
      lorebook.entries[uid] = blankEntry(uid);
      renderList();
      openInTab(uid);
      // Open template library filtered to this category
      openTemplateLibraryFiltered('lore', group.category, `eContent-${uid}`);
    });
    categories.append(btn);
  });

  openModal('entryPickerModal');
}

function openTemplateLibraryFiltered(m, categoryFilter, fieldId) {
  tplMode = m;
  tplTargetFieldId = fieldId;
  g('tplModalTitle').textContent = `// ${categoryFilter}`;
  g('tplSaveBtn').onclick = () => tplSaveCurrent(m, fieldId);

  const list = g('tplList');
  list.innerHTML = '';

  const builtins = BUILTIN_TEMPLATES[m] || [];
  const group = builtins.find(g => g.category === categoryFilter);
  if (group) {
    group.items.forEach(tpl => {
      list.append(makeBuiltinItem(tpl, m));
    });
  }

  // Also show user saved
  const tpls = tplGet(m);
  const items = Object.values(tpls).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  if (items.length) {
    list.append(makeSectionHeader('// Saved'));
    renderSavedTemplates(items, m, list);
  }

  openModal('tplModal');
}

// ═══════════════════════════════════════════════════════
// WIRE
// ═══════════════════════════════════════════════════════
function wireTplLibrary() {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      const fieldId = lastFocusedField?.id || null;
      openTemplateLibrary(mode === 'char' ? 'char' : 'lore', fieldId);
    }
  });

  // Entry picker button
  g('pickerBlank').addEventListener('click', () => {
    closeModal('entryPickerModal');
    createEntry();
  });
}
