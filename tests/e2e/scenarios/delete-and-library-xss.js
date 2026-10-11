(async()=>{
 const out={};
 window.confirm=()=>true;
 // 1. char with alt greetings imported, then another char opened, export first
 importCharCard({spec:'chara_card_v2',spec_version:'2.0',data:{name:'<img src=x onerror="window.__xss=1">',description:'d',first_mes:'hi',alternate_greetings:['a','b'],tags:['t'],character_book:null}}, 'x.json');
 await new Promise(r=>setTimeout(r,400));
 const id1=activeCharId;
 out.altBeforeOpen=JSON.stringify(charLibrary[id1].card.data.alternate_greetings);
 out.cardHasInternalId = 'id' in charLibrary[id1].card;
 createChar(); await new Promise(r=>setTimeout(r,200));
 exportCharJson(id1); const d1=await dl(); out.exportAlt = JSON.parse(d1.text).data.alternate_greetings; out.exportHasId = 'id' in JSON.parse(d1.text);
 exportCharJsonV2(id1); const d2=await dl(); out.v2Alt=JSON.parse(d2.text).data.alternate_greetings;
 // 2. delete char -> ws tab
 const tabsBefore=wsItems.length; await (async()=>{ const p=deleteChar(id1); await new Promise(r=>setTimeout(r,100)); const ok=document.querySelector('#confirmOkBtn, #confirmModal .btn-ok, #confirmModal button.btn-err'); out.confirmBtn=ok?ok.id||ok.className:null; if(ok) ok.click(); await p; })();
 out.tabsAfterDelete={before:tabsBefore,after:wsItems.length,stale:wsItems.filter(t=>t.type==='char'&&!charLibrary[t.itemId]).length};
 // 3. XSS executed?
 renderWsPickerList('char');
 out.xssFiredInPicker = window.__xss===1;
 // lib list xss
 lorebook={name:'<img src=x onerror="window.__xss2=1">',entries:{}}; 
 const lib={}; lib[lorebook.name]={name:lorebook.name,lb:lorebook,savedAt:new Date().toISOString()}; localStorage.setItem('aet_library',JSON.stringify(lib));
 renderLibraryList(); await new Promise(r=>setTimeout(r,200)); out.xssLib=window.__xss2===1;
 return out;
})()
