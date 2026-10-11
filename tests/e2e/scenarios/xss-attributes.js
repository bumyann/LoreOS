(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 const P='x" autofocus onfocus="window.__hit=(window.__hit||[]).concat(\'ATTR\')" data-x="';
 // lorebook entry text fields + numeric fields from an "imported" entry
 lorebook={name:'t',entries:{0:{uid:0,comment:P,key:[P],keysecondary:[],content:P,group:P,automationId:P,outletName:P,order:P,depth:P,probability:P,sticky:P,delay:P,groupWeight:P,scanDepth:P,position:7}}};
 lorebook.entries=rebuildEntries(lorebook.entries);
 openInTab(0); await w(300);
 // preset string field + slider values
 const pr=blankPreset(); pr.name=P; pr.wi_format=P; pr.temperature=P; pr.openai_max_context=P; pr.seed=P;
 presetLibrary.zz={id:'zz',name:P,preset:pr,savedAt:new Date().toISOString()};
 switchMode('preset'); openPreset('zz'); await w(300);
 // char editor fields + image src
 const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:P,description:P,personality:P,creator:P,character_version:P,tags:[P],alternate_greetings:[P],extensions:{}}};
 charLibrary.yy={id:'yy',name:P,card,imageData:'data:image/png;base64,AAAA" onerror="window.__hit=(window.__hit||[]).concat(\'IMG\')',savedAt:new Date().toISOString()};
 switchMode('char'); openChar('yy'); await w(400);
 // template + journal + notebook title
 store.set('loreos_notebook',JSON.stringify({pages:{nb1:{id:'nb1',title:P,content:'',updatedAt:new Date().toISOString()}},activePageId:'nb1'}));
 navigateTo('notebook'); await w(500);
 o.hit=window.__hit||[];
 return o;
})()
