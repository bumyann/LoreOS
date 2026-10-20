(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 // device has a char with unsaved typing, and a lorebook linked to the library
 createChar(); await w(150);
 const cid=activeCharId;
 document.getElementById('chName').value='LOCAL unsaved edit';
 document.getElementById('chName').dispatchEvent(new Event('input',{bubbles:true}));
 // a backup with a different char library + lorebook library
 const backupChars={ cB:{id:'cB',name:'FROM BACKUP',card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:'FROM BACKUP',tags:[],alternate_greetings:[],extensions:{}}},savedAt:new Date().toISOString()} };
 const bundle={_version:'1',_synced_at:new Date().toISOString(),aet_charLibrary:JSON.stringify(backupChars)};
 // lore: link a lib entry, with a pending snapshot
 createEntry(); const lib={Book:{name:'Book',lb:{name:'Book',entries:{}},savedAt:new Date().toISOString()}};
 store.set('aet_library',JSON.stringify(lib)); loreLinkToLib('Book'); loreSnapshotSoon();
 bundle.aet_library=JSON.stringify({Book:{name:'Book',lb:{name:'Book',entries:{0:{uid:0,comment:'BACKUP ENTRY',key:[],content:''}}},savedAt:new Date().toISOString()}});
 openImportModal(bundle,'t');
 // stop the reload so we can inspect, but let everything else run
 const realSet=window.setTimeout; window.setTimeout=(f,ms,...a)=> (ms===900?0:realSet(f,ms,...a));
 await syncImportConfirm();
 window.setTimeout=realSet;
 // simulate what the browser fires on reload / hide
 window.dispatchEvent(new Event('pagehide'));
 Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));
 await w(2500); // autosave + snapshot timers
 const c=JSON.parse(store.get('aet_charLibrary')), l=JSON.parse(store.get('aet_library'));
 o.charLibKeys=Object.keys(c); o.backupCharSurvived=!!c.cB;
 o.bookEntryNames=Object.values(l.Book.lb.entries||{}).map(e=>e.comment);
 o.backupLoreSurvived=o.bookEntryNames.includes('BACKUP ENTRY');
 return o;
})()
