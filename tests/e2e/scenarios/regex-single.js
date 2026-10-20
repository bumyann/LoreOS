(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 switchMode('regex'); await w(300);
 // a preset and a character that carry regex scripts
 const stScripts=[{id:'a',scriptName:'Bold',findRegex:'/\\*\\*(.+?)\\*\\*/g',replaceString:'<b>$1</b>',placement:[2]},{id:'b',scriptName:'Ital',findRegex:'/\\*(.+?)\\*/g',replaceString:'<i>$1</i>',placement:[2]}];
 const pid='ptest1'; state.presetLibrary[pid]={id:pid,name:'MyPreset',preset:{name:'MyPreset',prompts:[],prompt_order:[],extensions:{regex_scripts:JSON.parse(JSON.stringify(stScripts))}},savedAt:''};
 // 1. blank script is not an error in the pipeline
 const bs=blankScript(); const pl=runPipeline([bs],'hello'); chk('blank script is skipped, not an error', pl.steps[0].error==='' && pl.steps[0].skipped==='no pattern yet' && pl.output==='hello', pl.steps[0]);
 chk('isBlankScript', isBlankScript(bs) && !isBlankScript({...bs,findRegex:'/a/'}));
 // 2. a single script on its own
 document.getElementById('regexNewScriptBtn').click(); await w(500);
 const sid=state.activeRegexId; const se=state.regexLibrary[sid];
 chk('new script is a single entry', se.single===true && se.set.scripts.length===1 && se.name==='New script', [se.single,se.name]);
 chk('no set controls on a single', !document.getElementById('rxScripts').textContent.includes('Duplicate') && !document.querySelector('.rx-script button.btn-err') && /Add another script/.test(document.getElementById('rxAddScript').textContent));
 type(document.getElementById('rxName'),'My lone script'); await w(200);
 chk('top name drives the script name', se.set.scripts[0].scriptName==='My lone script' && se.name==='My lone script');
 chk('sidebar says script', /script/.test(document.querySelector('#entryList .ei.open .ei-kws').textContent) && !/set ·/.test(document.querySelector('#entryList .ei.open .ei-kws').textContent));
 type(document.getElementById('rxFind-'+se.set.scripts[0].id),'/cat/g'); type(document.getElementById('rxRepl-'+se.set.scripts[0].id),'dog'); type(document.getElementById('rxSample'),'cat cat'); await w(800);
 chk('single script tests live', document.getElementById('rxResult').textContent==='dog dog', document.getElementById('rxResult').textContent);
 // export one script, ST and Lumiverse, no set involved
 const dlcap=()=>new Promise(r=>{ const oc=URL.createObjectURL; URL.createObjectURL=b=>{ b.text().then(t=>{URL.createObjectURL=oc; r(t);}); return oc(b); }; });
 let p1=dlcap(); exportRegexScript(); const stTxt=await p1; chk('ST export is the bare script', JSON.parse(stTxt).findRegex==='/cat/g' && !JSON.parse(stTxt).scripts);
 p1=dlcap(); exportRegexScriptLumi(); const luTxt=await p1; const lu=JSON.parse(luTxt); chk('Lumiverse export is one script', lu.type==='lumiverse_regex_scripts' && lu.scripts.length===1 && lu.scripts[0].find_regex==='cat' && lu.scripts[0].flags==='g', lu);
 // 3. adding a script makes it a set
 document.getElementById('rxAddScript').click(); await w(400);
 chk('second script turns it into a set', !state.regexLibrary[sid].single && state.regexLibrary[sid].set.scripts.length===2);
 // 4. import: one-script file is a single, many is a set
 const one=importRegexText(JSON.stringify(stScripts[0]),'one.json'); await w(300);
 chk('single-script file imports as a script', state.regexLibrary[one].single===true && state.regexLibrary[one].name==='Bold');
 const many=importRegexText(JSON.stringify(stScripts),'many.json'); await w(300);
 chk('multi-script file imports as a set', !state.regexLibrary[many].single && state.regexLibrary[many].set.scripts.length===2);
 // 5. import from a preset
 document.getElementById('regexImportPresetBtn').click(); await w(300);
 chk('picker opens with the preset and its scripts', document.getElementById('rxPickModal').classList.contains('open') && document.querySelectorAll('#rxPickList input').length===2 && /MyPreset/.test(document.getElementById('rxPickSrc').textContent));
 chk('single button needs exactly one', document.getElementById('rxPickOne').disabled===true);
 const before=Object.keys(state.regexLibrary).length;
 document.getElementById('rxPickNew').click(); await w(500);
 const ne=state.regexLibrary[state.activeRegexId];
 chk('new set from preset has exactly its scripts, no blank one', Object.keys(state.regexLibrary).length===before+1 && ne.set.scripts.length===2 && !ne.set.scripts.some(isBlankScript) && !ne.single, ne.set.scripts.map(s=>s.scriptName));
 // pick one script as a single
 document.getElementById('regexImportPresetBtn').click(); await w(300);
 document.querySelectorAll('#rxPickList input')[1].click(); await w(100);
 chk('single enabled with one ticked', document.getElementById('rxPickOne').disabled===false);
 document.getElementById('rxPickOne').click(); await w(500);
 const se2=state.regexLibrary[state.activeRegexId]; chk('single from preset', se2.single===true && se2.set.scripts.length===1 && se2.set.scripts[0].scriptName==='Bold', se2.set.scripts.map(s=>s.scriptName));
 // 6. a brand new set, then copy scripts in: the blank one goes away
 const ns=createRegex('Fresh'); await w(400);
 chk('new set starts with the blank script', state.regexLibrary[ns].set.scripts.length===1 && isBlankScript(state.regexLibrary[ns].set.scripts[0]));
 const sel=document.getElementById('rxFromSel'); sel.value='preset:'+pid; document.getElementById('rxFromBtn').click(); await w(500);
 chk('copy in drops the blank script', state.regexLibrary[ns].set.scripts.length===2 && !state.regexLibrary[ns].set.scripts.some(isBlankScript), state.regexLibrary[ns].set.scripts.map(s=>s.scriptName));
 type(document.getElementById('rxSample'),'**x**'); await w(700);
 chk('no empty script error in the tester', !/Type a pattern/.test(document.getElementById('rxEditorRoot')?.textContent||document.getElementById('editorContent').textContent));
 // 7. add to the open set from a preset, replacing blank
 const ns2=createRegex('Fresh2'); await w(400);
 document.getElementById('regexImportPresetBtn').click(); await w(300);
 chk('add to open set offered', document.getElementById('rxPickAdd').style.display!=='none');
 document.getElementById('rxPickAdd').click(); await w(500);
 chk('added to the open set without the blank', state.regexLibrary[ns2].set.scripts.length===2 && !state.regexLibrary[ns2].set.scripts.some(isBlankScript));
 // 8. from a character with no scripts
 document.getElementById('regexImportCharBtn').click(); await w(300);
 chk('no character has scripts: no picker', !document.getElementById('rxPickModal').classList.contains('open'));
 // duplicate keeps single
 duplicateRegex(one); await w(300);
 chk('duplicate of a single is a single', Object.values(state.regexLibrary).filter(e=>e.single&&/Copy/.test(e.name)).length===1);
 return out;
})()
