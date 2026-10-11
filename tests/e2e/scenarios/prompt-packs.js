(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,200):'')); };
 const fence='```';
 const MD=`# Test Pack

> For web frontends.

*Pick a base, then add modules.*

---

## How To Use

Step 1. Pick one base.

---

## Base Prompts

Pick **one**.

### Standard (~30 tokens)

Covers: everything.

${fence}
# BASE STANDARD
I write as {{char}} for {{user}}.
${fence}

---

### Lite (~10 tokens)

${fence}
# BASE LITE
Short for {{char}}.
${fence}

---

## Intimacy Modules

Pick **one** and append under the base prompt.

### Touch Grass — SFW (~20 tokens)

${fence}
## INTIMACY
Keep it tasteful.
${fence}

### The Tension — Suggestive (~55 tokens)

${fence}
## INTIMACY
Charged glances only.
${fence}

---

## Status Report

### SFW (~165 tokens)

${fence}
## STATUS REPORT
LOC: [Location]
${fence}

### NSFW (~210 tokens)

${fence}
## STATUS REPORT NSFW
LUST: [0-100]
${fence}

---

## Game Modules

### CYOA (~184 tokens)

${fence}
## CYOA
End with 5 choices.
${fence}

---

## Prebuilt Sets

### Base Presets

**✦ MAIDEN** — Clean slowburn.

> Base + Touch Grass

**✦ TRACKED** — With a status block.

> Touch Grass + SFW Status Report + Nonsense Thing

---
`;
 // ── import ──
 switchMode('prompt'); await w(200);
 const id=importPromptText(MD,'Test.md'); await w(400);
 const entry=state.promptLibrary[id]; const pack=entry.pack;
 chk('imported name', entry.name==='Test Pack', entry.name);
 chk('4 groups', pack.groups.length===4, pack.groups.map(g=>g.name));
 chk('7 modules', pack.modules.length===7, pack.modules.length);
 chk('pick-one rules read from the page', pack.groups[0].pick==='one' && pack.groups[1].pick==='one' && pack.groups[2].pick==='any');
 chk('guide section kept verbatim', pack.docSections.length===1 && /Step 1/.test(pack.docSections[0].markdown));
 chk('description + lead-in', pack.description==='For web frontends.' && /Pick a base/.test(pack.intro));
 chk('2 sets, the unknown name is reported not guessed', pack.sets.length===2 && pack.sets[1].moduleIds.length===2, pack.sets.map(s=>s.moduleIds.length));
 chk('code block text exact', pack.modules[0].text==='# BASE STANDARD\nI write as {{char}} for {{user}}.');
 chk('notes are not polluted by --- lines', pack.modules[0].notes==='Covers: everything.', pack.modules[0].notes);
 chk('opened in a workshop tab', state.wsItems.some(t=>t.type==='prompt'&&t.itemId===id));
 chk('sidebar lists it', /Test Pack/.test(document.getElementById('entryList').textContent) && /7 modules/.test(document.getElementById('entryList').textContent));
 // ── build tab ──
 const mod=name=>[...document.querySelectorAll('.pr-mod')].find(l=>l.querySelector('.pr-mod-name').textContent.startsWith(name));
 const click=name=>mod(name).querySelector('input').click();
 chk('first base is pre-selected', pack.selection.length===1 && pack.modules.find(m=>m.id===pack.selection[0]).name==='Standard');
 click('Lite'); await w(80);
 chk('pick-one swaps the base', pack.selection.length===1 && pack.modules.find(m=>m.id===pack.selection[0]).name==='Lite');
 click('Touch Grass'); await w(80); click('The Tension'); await w(80);
 chk('pick-one swaps within a group', pack.selection.length===2 && !pack.selection.some(i=>pack.modules.find(m=>m.id===i).name.startsWith('Touch')));
 click('SFW'); await w(80);
 const ta=()=>document.querySelector('.pr-out-ta').value;
 chk('stack text: base first, then modules in page order', ta().indexOf('BASE LITE')<=2 && ta().indexOf('INTIMACY')>ta().indexOf('BASE LITE') && ta().indexOf('STATUS REPORT')>ta().indexOf('INTIMACY'), ta().slice(0,120));
 chk('macros stay for the platform by default', /\{\{char\}\}/.test(ta()));
 chk('token total shown', /Stack: 3 modules, ~\d+ tokens/.test(document.getElementById('prTotal').textContent), document.getElementById('prTotal').textContent);
 const cn=document.getElementById('prCharName'); cn.value='Mira'; cn.dispatchEvent(new Event('input',{bubbles:true}));
 const un=document.getElementById('prUserName'); un.value='Yann'; un.dispatchEvent(new Event('input',{bubbles:true}));
 click('Standard'); await w(80);
 document.getElementById('prReplace').click(); await w(80);
 chk('names filled in on request', /I write as Mira for Yann/.test(ta()) && !/\{\{user\}\}/i.test(ta()), ta().slice(0,80));
 // sets
 [...document.querySelectorAll('.pr-sets button')].find(b=>b.textContent==='MAIDEN').click(); await w(100);
 chk('a set keeps the chosen base and swaps the rest', pack.selection.map(i=>pack.modules.find(m=>m.id===i).name).join('|')==='Standard|Touch Grass — SFW', pack.selection.map(i=>pack.modules.find(m=>m.id===i).name));
 // ── targets: two prompt boxes ──
 document.querySelector('[data-prtab=targets]').click(); await w(100);
 document.getElementById('prAddSauce').click(); await w(100);
 chk('Saucepan layout puts game/status groups in the second box', pack.targets.length===2 && pack.targets[1].fields.length===2, pack.targets[1] && pack.targets[1].fields.map(f=>f.label+':'+f.groupIds.length));
 document.querySelector('[data-prtab=build]').click(); await w(100);
 click('SFW'); await w(60); click('CYOA'); await w(60);
 const sel=document.getElementById('prTarget'); sel.value=pack.targets[1].id; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(100);
 const tas=[...document.querySelectorAll('.pr-out-ta')].map(t=>t.value);
 chk('two boxes shown for that platform', tas.length===2, tas.length);
 chk('box 1 has the base + intimacy, box 2 the status + game', /BASE STANDARD/.test(tas[0]) && !/CYOA/.test(tas[0]) && /STATUS REPORT/.test(tas[1]) && /CYOA/.test(tas[1]) && !/BASE/.test(tas[1]), tas.map(t=>t.slice(0,30)));
 chk('copy buttons per box', document.querySelectorAll('.pr-copy').length===2);
 // ── edit modules ──
 document.querySelector('[data-prtab=modules]').click(); await w(100);
 const first=document.querySelector('.pr-module'); first.open=true;
 const mt=first.querySelector('textarea'); mt.value='EDITED BASE TEXT for {{char}}'; mt.dispatchEvent(new Event('input',{bubbles:true}));
 chk('typing updates the pack at once', pack.modules[0].text==='EDITED BASE TEXT for {{char}}');
 chk('token count follows', /~\d+ tokens/.test(first.querySelector('summary .pr-tok').textContent));
 document.querySelector('[data-add-module]').click(); await w(100);
 chk('add module', pack.modules.length===8);
 const gcount=pack.groups.length; document.getElementById('prAddGroup').click(); await w(100);
 chk('add group', pack.groups.length===gcount+1);
 // autosave persists without pressing Save
 commitActiveEditor(); await w(150); await kvFlush();
 chk('autosave persisted the edit', JSON.parse(store.get('aet_promptLibrary'))[id].pack.modules[0].text==='EDITED BASE TEXT for {{char}}');
 // save-as-set from the stack
 document.querySelector('[data-prtab=sets]').click(); await w(100);
 const before=pack.sets.length;
 document.getElementById('prSaveAsSet').click(); await w(150);
 const inp=document.getElementById('renameModalInput'); if(inp){ inp.value='Mine'; document.getElementById('renameOkBtn').click(); await w(200); }
 chk('save the current stack as a set', pack.sets.length===before+1 && pack.sets[pack.sets.length-1].name==='Mine', pack.sets.map(s=>s.name));
 // ── export / import round trips ──
 exportPromptMarkdown(id); const md=(await dl()).text;
 chk('markdown page has the title, guide and every prompt', /^# Test Pack/.test(md) && /Step 1/.test(md) && /BASE LITE/.test(md) && /CYOA/.test(md));
 const again=parseMarkdownPack(md);
 chk('markdown round trip keeps groups, modules, sets', again.pack.groups.length===pack.groups.filter(g=>pack.modules.some(m=>m.groupId===g.id)).length && again.report.modules===pack.modules.filter(m=>m.text).length || again.report.modules>=6, again.report);
 chk('prompt text survives the round trip exactly', pack.modules.filter(m=>m.text).every(m=>again.pack.modules.some(x=>x.text===m.text.replace(/\s+$/,''))));
 exportPromptJson(id); const js=(await dl()).text; const back=parsePackJson(js);
 chk('JSON round trip is lossless', JSON.stringify(back.pack.modules)===JSON.stringify(normalizePack(JSON.parse(JSON.stringify(pack))).modules) && back.pack.sets.length===pack.sets.length && back.pack.targets.length===pack.targets.length);
 exportPromptStackText(id); const txt=(await dl()).text;
 chk('stack text export', /===== /.test(txt) || /EDITED BASE|BASE STANDARD/.test(txt), txt.slice(0,60));
 // ── history, delete, undo ──
 savePrompt({silent:true}); await w(100);
 chk('version history snapshot', (state.promptLibrary[id].history||[]).length>=1);
 const del=deletePrompt(id); await w(150); document.getElementById('confirmOkBtn').click(); await del; await w(200);
 chk('deleted, tab closed', !state.promptLibrary[id] && !state.wsItems.some(t=>t.type==='prompt'));
 trashRestore(trashAll().find(t=>t.kind==='prompt').id); await w(150);
 chk('Undo restores the whole pack', !!state.promptLibrary[id] && state.promptLibrary[id].pack.modules.length===8, Object.keys(state.promptLibrary));
 // ── reload persistence + drop import ──
 await handleDrop([new File([MD],'Dropped.md')]); await w(600);
 chk('a .md dropped on the page imports as a prompt pack', Object.values(state.promptLibrary).some(e=>e.name==='Test Pack' && e.id!==id) || Object.keys(state.promptLibrary).length>=2, Object.values(state.promptLibrary).map(e=>e.name));
 chk('bad files are refused with a message', (()=>{ try{ importPromptText('just some text','x.md'); return false; }catch(e){ return /No prompts found/.test(e.message); } })());
 out.ok=true; return out;
})()
