(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const ok=async p=>{ await w(120); document.getElementById('confirmOkBtn').click(); await p; await w(200); };
 // character
 charLibrary.t1={id:'t1',name:'Trashy',card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:'Trashy',description:'keep me'}},imageData:null,savedAt:new Date().toISOString()};
 switchMode('char'); openChar('t1'); await w(200);
 await ok(deleteChar('t1'));
 chk('char gone', !charLibrary.t1);
 chk('toast has Undo', !!document.querySelector('#notifs .notif-act'));
 chk('char in trash', trashAll().some(t=>t.kind==='char'&&t.label==='Trashy'));
 document.querySelector('#notifs .notif-act').click(); await w(200);
 chk('Undo restores the character', !!charLibrary.t1 && charLibrary.t1.card.data.description==='keep me', Object.keys(charLibrary));
 chk('trash emptied by restore', !trashAll().some(t=>t.kind==='char'));
 // preset
 const pr=blankPreset(); pr.name='TrashPre'; presetLibrary.tp={id:'tp',name:'TrashPre',preset:pr,savedAt:new Date().toISOString()};
 switchMode('preset'); openPreset('tp'); await w(200);
 await ok(deletePreset('tp')); chk('preset gone', !presetLibrary.tp);
 trashRestore(trashAll().find(t=>t.kind==='preset').id); chk('preset restored', !!presetLibrary.tp);
 // lorebook entry
 switchMode('lore'); lorebook={name:'tb',entries:rebuildEntries({0:{uid:0,comment:'one',key:['a'],content:'1'},1:{uid:1,comment:'two',key:['b'],content:'2'}})}; renderList();
 await ok(deleteSidebar(0)); chk('entry deleted', !lorebook.entries[0] && Object.keys(lorebook.entries).length===1);
 trashRestore(trashAll().find(t=>t.kind==='entry').id);
 chk('entry restored with a free number', Object.values(lorebook.entries).some(e=>e.comment==='one') && Object.keys(lorebook.entries).length===2, Object.values(lorebook.entries).map(e=>e.uid+':'+e.comment));
 // clear all
 await ok(clearEditor()); chk('cleared', Object.keys(lorebook.entries).length===0);
 trashRestore(trashAll().find(t=>t.kind==='entries').id);
 chk('clear all is undoable', Object.keys(lorebook.entries).length===2, Object.keys(lorebook.entries));
 // library lorebook
 libSet({LibBook:{name:'LibBook',entries:{0:{uid:0,comment:'x',key:[],content:'y'}}}});
 await ok(libDelete('LibBook')); chk('lib lorebook deleted', !libGet().LibBook);
 trashRestore(trashAll().find(t=>t.kind==='lorelib').id); chk('lib lorebook restored', !!libGet().LibBook);
 // journal page
 store.set('loreos_notebook',JSON.stringify({activePageId:'jp',pages:{jp:{id:'jp',title:'Dear diary',content:'<p>hi</p>',updatedAt:'2026-01-01'}}}));
 navigateTo('notebook'); await w(500);
 document.getElementById('nbDeleteBtn').click(); await w(150); document.getElementById('confirmOkBtn').click(); await w(300);
 chk('journal page deleted', !nbGet().pages.jp);
 trashRestore(trashAll().find(t=>t.kind==='journal').id); chk('journal page restored', !!nbGet().pages.jp && nbGet().pages.jp.title==='Dear diary');
 // settings panel lists and restores
 store.remove('aet_trash'); charLibrary.t2={id:'t2',name:'Panel',card:{data:{name:'Panel'}},savedAt:'x'}; switchMode('char');
 await ok(deleteChar('t2')); openSettings(); await w(300);
 const row=document.querySelector('#stgStorageBody [data-trash-restore]'); chk('panel lists deleted item', !!row);
 if(row){ row.click(); await w(200); chk('panel Restore works', !!charLibrary.t2); }
 // size cap: many big items never grow past the cap
 for(let i=0;i<30;i++) trashPush('char','big'+i,{id:'b'+i,name:'big',card:{data:{description:'x'.repeat(200000)}}},{undo:false});
 chk('trash is capped', trashAll().length<=20 && JSON.stringify(trashAll()).length<=1600000, trashAll().length);
 out.ok=true; return out;
})()
