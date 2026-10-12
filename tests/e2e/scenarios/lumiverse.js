(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const lumiRx={version:1,type:'lumiverse_regex_scripts',scripts:[{name:'Box',find_regex:'\\[\\[X:([^\\]]+)\\]\\]',replace_string:'<b>$1</b>',actions:[],flags:'gi',placement:['ai_output'],scope:'global',scope_id:null,target:['display'],min_depth:null,max_depth:null,trim_strings:[],run_on_edit:true,substitute_macros:'raw',disabled:false,sort_order:0,description:'d',metadata:{},folder:'F',script_id:'',owner_extension_identifier:null},
  {name:'P',find_regex:'a',replace_string:'b',flags:'g',placement:['user_input','ai_output'],target:['prompt'],substitute_macros:'none',disabled:true}]};
 // regex import
 const id=importRegexText(JSON.stringify(lumiRx),'lumi.json'); await w(300);
 const sc=state.regexLibrary[id].set.scripts;
 chk('two scripts', sc.length===2);
 chk('pattern + flags joined', sc[0].findRegex==='/\\[\\[X:([^\\]]+)\\]\\]/gi', sc[0].findRegex);
 chk('placement + target mapped', sc[0].placement.join()==='2' && sc[0].markdownOnly && !sc[0].promptOnly && sc[0].substituteRegex===1 && sc[1].promptOnly && sc[1].placement.join()==='1,2' && sc[1].disabled);
 chk('it runs', runScript(sc[0],'x [[X:hi]] y').output==='x <b>hi</b> y');
 chk('looks like regex for drop', looksLikeRegexJson(lumiRx));
 const back=JSON.parse(lumiRegexFileJson(sc));
 chk('regex export is lumiverse shaped', back.type==='lumiverse_regex_scripts' && back.scripts[0].find_regex===lumiRx.scripts[0].find_regex && back.scripts[0].flags==='gi' && back.scripts[0].folder==='F' && back.scripts[0].script_id==='' && back.scripts[1].target.join()==='prompt', back.scripts[0]);
 // loom preset
 const loom={name:'Loom T',description:'x',schemaVersion:1,blocks:[
  {id:'b1',name:'Main',content:'Hello {{char}} {{calc 1}}',role:'system',enabled:true,position:'pre_history',depth:0,marker:null,isLocked:false,color:null,injectionTrigger:[],group:null,categoryMode:null,characterTagTrigger:[],variables:{a:1}},
  {id:'b2',name:'History',content:'',role:'system',enabled:true,position:'pre_history',depth:0,marker:'chat_history'},
  {id:'b3',name:'After',content:'post',role:'user_append',enabled:false,position:'post_history',depth:0,marker:null},
  {id:'b4',name:'Deep',content:'deep',role:'system',enabled:true,position:'in_history',depth:2,marker:null}],
  samplerOverrides:{enabled:true,maxTokens:777,contextSize:9000,temperature:0.5,topP:0.9,minP:null,streaming:true},
  promptBehavior:{newChatPrompt:'[go]',impersonationPrompt:'imp'}, completionSettings:{assistantPrefill:'pre',squashSystemMessages:true,namesBehavior:2},
  promptVariables:{v1:{x:1}}, extensions:{regex_scripts:lumiRx.scripts}};
 chk('detected as loom', looksLikeLoomPreset(loom) && !looksLikeLoomPreset({prompts:[],temperature:1}));
 const before=Object.keys(state.presetLibrary).length;
 handlePresetImport({target:{files:[new File([JSON.stringify(loom)],'loom.json')],value:''}}); await w(700);
 const ids=Object.keys(state.presetLibrary); chk('preset imported', ids.length===before+1);
 const pe=state.presetLibrary[ids[ids.length-1]].preset;
 chk('samplers mapped', pe.temperature===0.5 && pe.top_p===0.9 && pe.openai_max_tokens===777 && pe.openai_max_context===9000 && pe.stream_openai===true && pe.new_chat_prompt==='[go]' && pe.assistant_prefill==='pre' && pe.names_behavior===2 && pe.squash_system_messages===true, pe.temperature);
 chk('post history block sits after the chat history marker', pe.prompts.map(p=>p.name).join()==='Main,History,After,Deep', pe.prompts.map(p=>p.name));
 chk('marker + roles + depth', pe.prompts[1].marker===true && pe.prompts[1].identifier==='chatHistory' && pe.prompts[2].role==='user' && pe.prompts[2].enabled===false && pe.prompts[3].injection_position===1 && pe.prompts[3].injection_depth===2);
 chk('prompt order built', pe.prompt_order[0].order.length===4 && pe.prompt_order[0].order[2].enabled===false);
 chk('regex scripts came as SillyTavern scripts', pe.extensions.regex_scripts.length===2 && pe.extensions.regex_scripts[0].findRegex.startsWith('/'));
 const lm=presetToLoom(JSON.parse(JSON.stringify(pe)));
 chk('loom export round trip', lm.blocks.length===4 && lm.blocks[0].variables.a===1 && lm.blocks[2].role==='user_append' && lm.blocks[2].position==='post_history' && lm.blocks[3].position==='in_history' && lm.blocks[3].depth===2 && lm.blocks[1].marker==='chat_history' && lm.promptVariables.v1.x===1 && lm.samplerOverrides.maxTokens===777 && lm.extensions.regex_scripts[0].find_regex===lumiRx.scripts[0].find_regex, lm.blocks[2]);
 // the preset editor still opens it
 openPreset(ids[ids.length-1]); await w(400);
 chk('editor lists all four prompts', document.querySelectorAll('[data-prompt-id]').length===4, document.querySelectorAll('[data-prompt-id]').length);
 // drop classifier
 chk('drop: loom preset', (await classifyDrop(new File([JSON.stringify(loom)],'p.json'))).input==='filePresetInput');
 chk('drop: lumiverse regex', (await classifyDrop(new File([JSON.stringify(lumiRx)],'r.json'))).input==='fileRegexInput');
 // charx with module regexes
 const c=document.createElement('canvas'); c.width=c.height=4; c.getContext('2d').fillRect(0,0,4,4);
 const png=new Uint8Array(await new Promise(r=>c.toBlob(b=>b.arrayBuffer().then(r))));
 const z=new JSZip(); z.file('card.json',JSON.stringify({spec:'chara_card_v3',spec_version:'3.0',data:{name:'Ragi',description:'d',first_mes:'hi',extensions:{}}}));
 z.file('assets/icon/image/main.png',png); z.file('assets/other/image/gallery_image-1.bin',png);
 z.file('lumiverse_modules.json',JSON.stringify({version:1,regex_scripts:[{...lumiRx.scripts[0],metadata:{source:'charx_bundle'}}]}));
 const buf=await z.generateAsync({type:'arraybuffer'});
 handleCharxImport({target:{files:[new File([buf],'r.charx')],value:''}}); await w(900);
 const ch=charLibrary[activeCharId];
 chk('module regexes became card regex scripts', ch.card.data.extensions.regex_scripts.length===1 && ch.card.data.extensions.regex_scripts[0].scriptName==='Box' && ch.card.data.extensions.regex_scripts[0].findRegex.startsWith('/'), ch.card.data.extensions);
 chk('gallery file kept', ch.charxFiles.length===1);
 const oc=URL.createObjectURL; let blob; URL.createObjectURL=b=>{blob=b;return oc(b)};
 exportCharCharx(activeCharId); await w(900);
 const back2=await JSZip.loadAsync(blob); const lm2=JSON.parse(await back2.file('lumiverse_modules.json').async('string'));
 chk('charx export writes regex modules and keeps gallery', lm2.regex_scripts.length===1 && lm2.regex_scripts[0].find_regex===lumiRx.scripts[0].find_regex && !!back2.file('assets/other/image/gallery_image-1.bin'));
 // an edit in LoreOS travels
 ch.card.data.extensions.regex_scripts[0].replaceString='EDITED'; exportCharCharx(activeCharId); await w(900);
 const lm3=JSON.parse(await (await JSZip.loadAsync(blob)).file('lumiverse_modules.json').async('string')); chk('edited regex exported', lm3.regex_scripts[0].replace_string==='EDITED');
 // janitor greetings file
 const md=janitorGreetingsMd({name:'Ragi',alternate_greetings:[{title:'Rain',message:'It rains.'},'Second'] });
 chk('greetings md lists them from 2', /## 2\. Rain/.test(md) && /It rains\./.test(md) && /## 3\. Greeting 3/.test(md) && /Second/.test(md), md);
 chk('no md when no alternates', janitorGreetingsMd({name:'x',alternate_greetings:[]})==='' && janitorGreetingsMd({name:'x',alternate_greetings:[{title:'',message:' '}]})==='');
 // ── regex actions (interactive buttons) ──
 const actRx={version:1,type:'lumiverse_regex_scripts',scripts:[{name:'Scene',find_regex:'<scene>(.+?)</scene>',replace_string:'<button type="button" data-regex-action="pick">$1</button>',actions:[{id:'pick',type:'send',multi_select:false,cost:'1',limit:'3',title:'Choose: $1',subtitle:'Scene',content:'I choose $1.'}],flags:'gi',placement:['ai_output','memory'],scope:'global',scope_id:null,target:['display'],min_depth:null,max_depth:null,trim_strings:[],run_on_edit:true,substitute_macros:'after',disabled:false,sort_order:0,description:'',metadata:{},folder:'',script_id:'s1',owner_extension_identifier:null}]};
 const aid=importRegexText(JSON.stringify(actRx),'act.json'); await w(300);
 const as=state.regexLibrary[aid].set.scripts[0];
 chk('actions kept on the script', as.lumiverse.actions.length===1 && as.lumiverse.actions[0].id==='pick');
 switchMode('regex'); openRegex(aid); await w(500);
 state.regexOpen=as.id; renderRegexEditor(); await w(300);
 const panel=document.querySelector('[data-rx-actions="'+as.id+'"]');
 chk('actions panel shows the action', !!panel && panel.querySelectorAll('.rx-act').length===1 && !panel.querySelector('.rx-err'), panel&&panel.innerHTML.slice(0,120));
 panel.querySelector('textarea').value='I pick $1!'; panel.querySelector('textarea').dispatchEvent(new Event('input',{bubbles:true}));
 chk('editing writes into the action', as.lumiverse.actions[0].content==='I pick $1!');
 document.querySelector('[data-rx-add-action="'+as.id+'"]').click(); await w(300);
 chk('add button action adds action and button', as.lumiverse.actions.length===2 && /data-regex-action="action-2"/.test(as.replaceString), as.lumiverse.actions.length);
 const ab=JSON.parse(lumiRegexFileJson(state.regexLibrary[aid].set.scripts)).scripts[0];
 chk('actions + unknown place + macro mode survive export', ab.actions.length===2 && ab.actions[0].cost==='1' && ab.placement.join()==='ai_output,memory' && ab.substitute_macros==='after' && ab.script_id==='s1', ab);
 // ── Loom preset settings (prompt variables) ──
 const vloom={name:'Vars',schemaVersion:1,blocks:[
  {id:'k1',name:'Lens',content:'{{var::lens}} {{var::words}}',role:'system',enabled:true,position:'pre_history',depth:0,marker:null,variables:[
    {id:'v1',name:'lens',label:'Lens',type:'select',defaultValue:'o1',options:[{id:'o1',label:'A',value:'alpha'},{id:'o2',label:'B',value:'beta'}]},
    {id:'v2',name:'words',label:'Words',type:'slider',defaultValue:200,min:100,max:900,step:50},
    {id:'v3',name:'nsfw',label:'NSFW',type:'switch',defaultValue:1},
    {id:'v4',name:'tags',label:'Tags',type:'multiselect',defaultValue:['t1'],separator:', ',options:[{id:'t1',label:'1',value:'x'},{id:'t2',label:'2',value:'y'}]}]},
  {id:'k2',name:'Off block',content:'z',role:'system',enabled:false,position:'pre_history',depth:0,marker:null,variables:[{id:'v9',name:'hidden',label:'Hidden',type:'text',defaultValue:''}]}],
  promptVariables:{k1:{words:300}}};
 const lr=loomToPreset(vloom); chk('settings counted on import', lr.notes.settings===5, lr.notes.settings);
 handlePresetImport({target:{files:[new File([JSON.stringify(vloom)],'vars.json')],value:''}}); await w(700);
 const pid=state.activePresetId; const vp=state.presetLibrary[pid].preset;
 chk('settings button on a Loom preset', !!document.getElementById('psLoomVarsBtn') && /\(5\)/.test(document.getElementById('psLoomVarsBtn').textContent));
 document.getElementById('psLoomVarsBtn').click(); await w(300);
 const body=document.getElementById('loomVarsBody');
 chk('only variables of switched-on blocks are shown', body.querySelectorAll('[data-lv-var]').length===4 && !body.querySelector('[data-lv-var="hidden"]'), body.querySelectorAll('[data-lv-var]').length);
 chk('saved value beats default', body.querySelector('[data-lv-var="words"] input[type=number]').value==='300');
 const sel=body.querySelector('[data-lv-var="lens"] select'); sel.value='o2'; sel.dispatchEvent(new Event('change',{bubbles:true}));
 const sw=body.querySelector('[data-lv-var="nsfw"] input'); sw.checked=false; sw.dispatchEvent(new Event('change',{bubbles:true}));
 const chip=body.querySelectorAll('[data-lv-var="tags"] input')[1]; chip.checked=true; chip.dispatchEvent(new Event('change',{bubbles:true}));
 const pv=vp.extensions.lumiverse.promptVariables.k1;
 chk('picks are stored on the preset', pv.lens==='o2' && pv.nsfw===0 && pv.tags.join()==='t1,t2' && pv.words===300, pv);
 const lv2=presetToLoom(JSON.parse(JSON.stringify(vp)));
 chk('picks + definitions export back to Loom', lv2.promptVariables.k1.lens==='o2' && lv2.blocks[0].variables.length===4 && lv2.blocks[0].variables[1].max===900, lv2.promptVariables);
 chk('resolve: dropdown, switch, multi-select', resolveVar(vloom.blocks[0].variables[0],'o2')==='beta' && resolveVar(vloom.blocks[0].variables[2],0)==='0' && resolveVar(vloom.blocks[0].variables[3],['t2','t1'])==='x, y');
 document.getElementById('lvAddBtn').click(); await w(300);
 chk('add a setting to a block', vp.prompts.find(p=>p.name==='Lens').lumiverse.rest.variables.length===5 && state.presetLibrary[pid].preset.prompts.length===2);
 document.getElementById('loomVarsReset').click(); await w(200);
 chk('reset clears the picks', !vp.extensions.lumiverse.promptVariables.k1);
 closeModal('loomVarsModal');
 chk('plain preset has no settings button', (()=>{ openPreset(ids[0]); return true; })() );
 return out;
})()
