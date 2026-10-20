(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 chk('Regex tab is a real tab now', !document.querySelector('.mode-tab[data-mode="regex"]').classList.contains('stub'));
 switchMode('regex'); await w(300);
 chk('empty state offers a new set', /regex set/i.test(document.getElementById('editorContent').textContent));
 const id=createRegex('My set'); await w(500);
 const entry=state.regexLibrary[id]; const set=entry.set;
 chk('new set has one script and opens in a workshop tab', set.scripts.length===1 && state.wsItems.some(t=>t.type==='regex'&&t.itemId===id));
 const s0=set.scripts[0];
 // write a script through the real form and test it live
 type(document.getElementById('rxFind-'+s0.id),'/\\*(.+?)\\*/g'); type(document.getElementById('rxRepl-'+s0.id),'<i>$1</i>');
 type(document.getElementById('rxSample'),'She said *hello* and *bye*.');
 await w(900);
 chk('typing updates the script at once', s0.findRegex==='/\\*(.+?)\\*/g' && s0.replaceString==='<i>$1</i>');
 chk('live result', document.getElementById('rxResult').textContent==='She said <i>hello</i> and <i>bye</i>.', document.getElementById('rxResult').textContent);
 chk('per-script badge shows 2 matches', document.querySelector('[data-rx-badge="'+s0.id+'"]').textContent==='2');
 chk('matches are highlighted in the preview', document.querySelectorAll('[data-rx-preview="'+s0.id+'"] mark').length===2);
 // errors stay readable
 type(document.getElementById('rxFind-'+s0.id),'/(/g'); await w(800);
 chk('a broken pattern says why and does not crash the tester', document.querySelector('[data-rx-err="'+s0.id+'"]').textContent.length>3 && /error/.test(document.querySelector('[data-rx-badge="'+s0.id+'"]').textContent), document.querySelector('[data-rx-err="'+s0.id+'"]').textContent);
 type(document.getElementById('rxFind-'+s0.id),'/\\*(.+?)\\*/g'); await w(700);
 // runaway pattern is stopped by the time limit instead of freezing the page
 document.getElementById('rxAddScript').click(); await w(300);
 const s1=set.scripts[1]; type(document.getElementById('rxFind-'+s1.id),'/(a+)+$/'); type(document.getElementById('rxRepl-'+s1.id),'X');
 type(document.getElementById('rxSample'),'*'+'a'.repeat(40)+'!*'); const t0=performance.now(); await w(2600);
 chk('catastrophic backtracking is stopped and explained', /took too long/.test(document.getElementById('rxSteps').textContent) && performance.now()-t0<4000, document.getElementById('rxSteps').textContent.slice(0,80));
 chk('the page stayed responsive (UI still reacts)', !!document.getElementById('rxAddScript'));
 set.scripts=set.scripts.filter(s=>s.id!==s1.id); touch=null; renderRegexEditor(); type(document.getElementById('rxSample'),'She said *hello* and *bye*.'); await w(900);
 // placement + views
 const place=document.getElementById('rxPlace'); place.value='1'; place.dispatchEvent(new Event('change',{bubbles:true})); await w(700);
 chk('a script placed on AI output does nothing to user input text', document.getElementById('rxResult').textContent==='She said *hello* and *bye*.');
 place.value='2'; place.dispatchEvent(new Event('change',{bubbles:true})); await w(500);
 s0.markdownOnly=true; renderRegexEditor(); await w(500);
 const view=document.getElementById('rxView'); view.value='prompt'; view.dispatchEvent(new Event('change',{bubbles:true})); await w(700);
 chk('display-only script is skipped in the prompt view', document.getElementById('rxResult').textContent==='She said *hello* and *bye*.');
 view.value='display'; view.dispatchEvent(new Event('change',{bubbles:true})); await w(700);
 chk('and applied in the display view', /<i>hello<\/i>/.test(document.getElementById('rxResult').textContent));
 s0.markdownOnly=false;
 // toggle off, duplicate, reorder
 document.querySelector('[data-rx-toggle="'+s0.id+'"]').click(); await w(400);
 chk('turning a script off keeps it but stops it running', s0.disabled===true && document.getElementById('rxResult').textContent==='She said *hello* and *bye*.');
 document.querySelector('[data-rx-toggle="'+s0.id+'"]').click(); await w(400);
 // autosave
 commitActiveEditor(); await kvFlush();
 chk('autosave persisted the set', JSON.parse(store.get('aet_regexLibrary'))[id].set.scripts[0].findRegex==='/\\*(.+?)\\*/g');
 // export (SillyTavern shape)
 exportRegexScript(s0.id); const one=JSON.parse((await dl()).text);
 chk('exported script has the SillyTavern fields', one.scriptName && one.findRegex==='/\\*(.+?)\\*/g' && one.replaceString==='<i>$1</i>' && Array.isArray(one.placement) && 'substituteRegex' in one && 'minDepth' in one && 'markdownOnly' in one && 'promptOnly' in one && 'runOnEdit' in one && 'trimStrings' in one && 'disabled' in one && typeof one.id==='string', Object.keys(one));
 // and imports straight back (also as a file dropped on the page)
 const before=Object.keys(state.regexLibrary).length;
 await handleDrop([new File([JSON.stringify(one)],'regex-x.json')]); await w(700);
 chk('a SillyTavern script file dropped on the page becomes a set', Object.keys(state.regexLibrary).length===before+1 && state.mode==='regex', Object.keys(state.regexLibrary).length);
 const imp=Object.values(state.regexLibrary).find(e=>e.id!==id);
 chk('nothing lost on the way back in', imp.set.scripts[0].findRegex===one.findRegex && imp.set.scripts[0].replaceString===one.replaceString);
 // zip of all scripts
 state.activeRegexId=id; exportRegexZip(); await w(800); const z=await dl();
 chk('zip export downloads', /\.zip$/.test(z.name) && z.blob && z.blob.size>50, z && z.name);
 // send to a character, copy in from a preset
 charLibrary.rx1={id:'rx1',name:'Mira',card:{spec:'chara_card_v3',data:{name:'Mira',extensions:{}}},savedAt:new Date().toISOString()};
 presetLibrary.rp={id:'rp',name:'P',preset:{...blankPreset(),extensions:{regex_scripts:[{scriptName:'From preset',findRegex:'/x/g',replaceString:'y',placement:[2]}]}},savedAt:new Date().toISOString()};
 switchMode('regex'); openRegex(id); await w(400);
 sendTo('char:rx1',set); sendTo('char:rx1',set);
 chk('Send adds the scripts to the card once (no doubling)', charLibrary.rx1.card.data.extensions.regex_scripts.length===set.scripts.length, charLibrary.rx1.card.data.extensions.regex_scripts.length);
 chk('sent scripts are complete', charLibrary.rx1.card.data.extensions.regex_scripts[0].findRegex==='/\\*(.+?)\\*/g' && charLibrary.rx1.card.data.extensions.regex_scripts[0].id!==s0.id);
 renderRegexEditor(); await w(300);
 const sel=document.getElementById('rxFromSel'); sel.value='preset:rp'; document.getElementById('rxFromBtn').click(); await w(400);
 chk('Copy in brings the preset scripts into the set', set.scripts.some(s=>s.scriptName==='From preset'));
 // card exports still carry them
 exportCharJsonV2('rx1'); const card=JSON.parse((await dl()).text);
 chk('the card export includes the regex scripts', Array.isArray(card.data.extensions.regex_scripts) && card.data.extensions.regex_scripts.length>=1);
 // history, delete, undo
 savePrompt && 0; saveRegex({silent:true}); await w(100);
 chk('version history snapshot', (state.regexLibrary[id].history||[]).length>=1);
 const del=deleteRegex(id); await w(150); document.getElementById('confirmOkBtn').click(); await del; await w(200);
 chk('deleted, and Undo restores it', !state.regexLibrary[id] && (trashRestore(trashAll().find(t=>t.kind==='regex').id), !!state.regexLibrary[id]));
 chk('home has the entry points', (navigateTo('home'), renderHomeView(), await w(150), !!document.querySelector('#home-content [data-new="regex"]')));
 out.ok=true; return out;
})()
