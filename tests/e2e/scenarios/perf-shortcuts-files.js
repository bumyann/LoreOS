(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 // ---- keyboard shortcuts while in character mode
 createChar(); await w(200); o.mode=mode;
 const before=Object.keys(lorebook.entries).length;
 document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'n',ctrlKey:true,bubbles:true}));
 await w(200);
 o.ctrlN_in_char_mode={lorebookEntriesBefore:before,after:Object.keys(lorebook.entries).length,modeNow:mode,tabsInWorkshop:wsItems.map(t=>t.type)};
 // ---- big lorebook performance
 switchMode('lore'); await w(100);
 lorebook={name:'big',entries:{}}; for(let i=0;i<2000;i++){ lorebook.entries[i]={...blankEntry(i),comment:'Entry '+i,key:['k'+i,'x'],content:'lorem ipsum '.repeat(40)}; }
 let t=performance.now(); renderList(); o.renderList2000ms=Math.round(performance.now()-t);
 t=performance.now(); openInTab(1500); o.openEntryMs=Math.round(performance.now()-t);
 t=performance.now(); const sb=document.getElementById('sbSearch'); sb.value='Entry 19'; sb.dispatchEvent(new Event('input',{bubbles:true})); o.sidebarSearchMs=Math.round(performance.now()-t);
 t=performance.now(); saveToStorage(); o.saveMs=Math.round(performance.now()-t); o.storedKB=Math.round(store.get('aet_lorebook').length/1024);
 // ---- export filenames
 const caps=[]; const dlStart=__dl.length;
 charLibrary.j={id:'j',name:'日本語 🦊',card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:'日本語 🦊',tags:[],alternate_greetings:[],extensions:{}}},savedAt:new Date().toISOString()};
 activeCharId=null; exportCharJson('j'); exportCharJsonV2('j');
 lorebook.name='a/b:c*?'; g('lorebookName').value='a/b:c*?'; exportJson();
 await w(60); o.filenames=__dl.slice(dlStart).map(d=>d.name);
 // ---- accessibility probes
 const unlabeledButtons=[...document.querySelectorAll('button')].filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.title).length;
 const inputsNoLabel=[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(i=>!i.id||!document.querySelector('label[for="'+i.id+'"]')&&!i.closest('label')&&!i.getAttribute('aria-label')&&!i.placeholder&&!i.title).length;
 o.a11y={htmlLang:document.documentElement.lang,unlabeledButtons,inputsNoLabelOrPlaceholder:inputsNoLabel,ariaRoles:document.querySelectorAll('[role]').length,modalsWithRoleDialog:document.querySelectorAll('.modal[role=dialog]').length,totalModals:document.querySelectorAll('.modal').length};
 return o;
})()
