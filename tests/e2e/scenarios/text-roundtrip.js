(async()=>{
 const o={fail:[]}; const w=ms=>new Promise(r=>setTimeout(r,ms)); const chk=(n,c,d)=>{ if(!c) o.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const T='O\'Brien & "Co" <b>x</b> 日本 😀';
 // lorebook: values with quotes/ampersands/tags round-trip through form and save
 lorebook={name:'t',entries:{0:{uid:0,comment:T,key:[T],keysecondary:[],content:T,group:T,automationId:T,order:5,depth:3,probability:80,sticky:2,delay:1,groupWeight:50,scanDepth:4,position:7,outletName:T}}};
 lorebook.entries=rebuildEntries(lorebook.entries); openInTab(0); await w(300);
 chk('lore comment', document.getElementById('eName-0')?.value===T, document.getElementById('eName-0')?.value);
 chk('lore content', document.getElementById('eContent-0')?.value===T);
 chk('lore group', document.getElementById('eGroup-0')?.value===T, document.getElementById('eGroup-0')?.value);
 chk('lore aid', document.getElementById('eAID-0')?.value===T);
 chk('lore order', document.getElementById('eOrder-0')?.value==='5');
 chk('lore prob', document.getElementById('eProb-0')?.value==='80');
 saveEntry(0); chk('lore saved comment', lorebook.entries[0].comment===T, lorebook.entries[0].comment);
 // preset
 const pr=blankPreset(); pr.name=T; pr.wi_format=T; pr.temperature=0.7; pr.seed=42; pr.openai_max_context=8000;
 presetLibrary.zz={id:'zz',name:T,preset:pr,savedAt:new Date().toISOString()}; switchMode('preset'); openPreset('zz'); await w(300);
 chk('preset name', document.getElementById('psName')?.value===T, document.getElementById('psName')?.value);
 chk('preset wi', document.getElementById('psWiFormat')?.value===T);
 chk('preset seed', document.getElementById('psSeed')?.value==='42'); chk('preset ctx', document.getElementById('psMaxCtx')?.value==='8000');
 chk('preset temp', document.getElementById('psTempNum')?.value==='0.7');
 savePreset({silent:true}); chk('preset saved wi', presetLibrary.zz.preset.wi_format===T, presetLibrary.zz.preset.wi_format); chk('preset saved name', presetLibrary.zz.preset.name===T);
 // character
 const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:T,description:T,personality:T,creator:T,character_version:T,tags:[T.replace(/,/g,'')],alternate_greetings:[T],extensions:{}}};
 charLibrary.yy={id:'yy',name:T,card,imageData:null,savedAt:new Date().toISOString()}; switchMode('char'); openChar('yy'); await w(400);
 chk('char name', document.getElementById('chName')?.value===T, document.getElementById('chName')?.value);
 chk('char desc', document.getElementById('chDesc')?.value===T); chk('char creator', document.getElementById('chCreator')?.value===T);
 saveChar({silent:true}); chk('char saved', charLibrary.yy.card.data.name===T && charLibrary.yy.card.data.description===T && charLibrary.yy.card.data.creator===T, charLibrary.yy.card.data.creator);
 { const g0=charLibrary.yy.card.data.alternate_greetings[0]; chk('char alt', (typeof g0==='object'?g0.message:g0)===T, g0); }
 // library lists render the text literally, not as markup
 openCharLibrary(); await w(100); chk('char lib text', document.querySelector('#libList .lib-name')?.textContent===T, document.querySelector('#libList .lib-name')?.textContent);
 chk('no injected elements', !document.querySelector('#libList b'));
 // search results
 switchMode('lore'); doSearch && 0;
 o.checked=true; return o;
})()
