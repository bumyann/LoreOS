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
 return out;
})()
