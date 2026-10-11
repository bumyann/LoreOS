(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 o.title=document.title;
 // new item opens a tab while others are open
 createChar(); await w(150); createChar(); await w(150); createPreset(); await w(150);
 o.tabsAfterCreates=wsItems.map(t=>t.type);
 // typed-but-unsaved text survives switching tab
 const firstChar=wsItems.find(t=>t.type==='char'); wsActivate(firstChar.id); await w(150);
 const el=document.getElementById('chName'); el.value='Typed not saved'; el.dispatchEvent(new Event('input',{bubbles:true}));
 const pst=wsItems.find(t=>t.type==='preset'); wsActivate(pst.id); await w(150);
 wsActivate(firstChar.id); await w(150);
 o.fieldSurvivedTabSwitch=document.getElementById('chName').value;
 // tabs persisted for refresh
 o.savedTabs=JSON.parse(localStorage.aet_wsTabs);
 // attached lorebook export shape
 const id=activeCharId; const e=charLibrary[id];
 e.card.data.character_book={name:'x',entries:{0:{uid:0,key:['a'],keysecondary:[],content:'c',comment:'n',order:1,disable:false,constant:false,selective:true,position:0,probability:100,depth:4}}};
 migrateCharacterBook(e.card);
 o.bookEntriesIsArray=Array.isArray(e.card.data.character_book.entries);
 exportCharJson(id); const dd=await dl(); o.exportedBookArray=Array.isArray(JSON.parse(dd.text).data.character_book.entries);
 // history modal: closeModal null error + confirm stacking
 const errs=[]; window.addEventListener('error',e=>errs.push(e.message));
 openItemHistory('char',id); await w(100);
 const hist=document.getElementById('itemHistoryModal'); o.historyOpen=!!hist;
 const zH=+getComputedStyle(hist).zIndex||0;
 const cm=document.getElementById('confirmModal'); const zC= cm? +getComputedStyle(cm).zIndex||0 : null;
 o.zIndex={history:zH,confirm:zC};
 hist.querySelector('[data-close]').click(); await w(100);
 o.errorsOnClose=errs;
 return o;
})()
