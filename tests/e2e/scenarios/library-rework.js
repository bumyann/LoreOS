(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 const answer=async(text)=>{ await w(150); document.getElementById('renameModalInput').value=text; document.getElementById('renameOkBtn').click(); await w(150); };
 // ── foundation: stable ids ──
 const mk=(n,d)=>({name:n,lb:{name:n,entries:{1:{uid:1,key:['k'],content:'c'}}},savedAt:new Date(Date.now()-d*86400000).toISOString()});
 store.set('aet_library',JSON.stringify({Alpha:mk('Alpha',1),Beta:mk('Beta',2),Gamma:{...mk('Gamma',3),id:'dup'},Delta:{...mk('Delta',4),id:'dup'}}));
 const changed=ensureLoreIds(); const lib=JSON.parse(store.get('aet_library'));
 const ids=Object.values(lib).map(b=>b.id);
 chk('every lorebook got an id and duplicates were fixed', ids.every(Boolean) && new Set(ids).size===4 && changed===3, [changed,ids]);
 chk('idempotent', ensureLoreIds()===0 && JSON.stringify(Object.values(JSON.parse(store.get('aet_library'))).map(b=>b.id))===JSON.stringify(ids));
 const alphaId=lib.Alpha.id;
 // rename keeps the id
 const rp=libRename('Alpha'); await answer('Alpha Prime'); await rp; await w(200);
 const lib2=JSON.parse(store.get('aet_library'));
 chk('rename keeps id', lib2['Alpha Prime'] && lib2['Alpha Prime'].id===alphaId && !lib2.Alpha);
 chk('loreNameById finds the new name', loreNameById(alphaId)==='Alpha Prime');
 // ── meta layer ──
 { const nm=normalizeMeta({worlds:5,folders:3,items:{a:5,'lore:x':{tags:['A','a',' b ',''],world:'nope',folder:'zz',symbol:'✦\uFE0F',image:'javascript:1'}}}); chk('garbage meta normalises', JSON.stringify(nm.worlds)==='{}' && JSON.stringify(nm.folders)==='{}' && Object.keys(nm.items).join()==='lore:x' && nm.items['lore:x'].tags.join()==='A,b' && nm.items['lore:x'].world===null && nm.items['lore:x'].folder===null && nm.items['lore:x'].symbol==='✦' && nm.items['lore:x'].image===''); }
 let m=metaGet(); const wid=addWorld(m,'Celestalis','#8a9bd2');
 patchItem(m,'lore',alphaId,{world:wid,tags:'wip, fantasy',pinned:true,note:'n'}); metaSet(m);
 m=metaGet(); const r0=recordOf(m,'lore',alphaId);
 chk('record stored', r0.world===wid && r0.tags.join()==='wip,fantasy' && r0.pinned && r0.note==='n');
 patchItem(m,'lore',alphaId,{world:null,tags:[],pinned:false,note:''}); chk('empty record is removed', !m.items['lore:'+alphaId]);
 patchItem(m,'lore',alphaId,{world:wid,tags:['x']}); removeWorld(m,wid); chk('deleting a world unassigns but keeps tags', m.items['lore:'+alphaId].world===null && m.items['lore:'+alphaId].tags[0]==='x');
 // restoring a backup that has no ids: records follow by name
 m=metaGet(); const w3=addWorld(m,'W3'); patchItem(m,'lore',alphaId,{world:w3,name:'Alpha Prime',pinned:false}); metaSet(m);
 const stripped=JSON.parse(store.get('aet_library')); Object.values(stripped).forEach(b=>delete b.id); store.set('aet_library',JSON.stringify(stripped));
 ensureLoreIds(); const rep=repairMeta();
 const newAlpha=JSON.parse(store.get('aet_library'))['Alpha Prime'].id;
 chk('repair re-points the record by name', rep.moved>=1 && recordOf(metaGet(),'lore',newAlpha).world===w3, [rep,newAlpha]);
 chk('orphans are kept unless asked to drop', Object.keys(metaGet().items).length>=1 && repairMeta().dropped===0);
 // sync + storage
 chk('meta syncs with Drive and backups', SYNC_KEYS.includes('aet_meta') && SYNC_KEYS.includes('aet_personaLibrary') && SYNC_MODULES.some(x=>x.key==='meta'));
 // ── persona ──
 const pid=createPersona('Cartographer',{title:'AU',description:'Maps things.',avatar:''}); await w(100);
 chk('persona stored', state.personaLibrary[pid] && state.personaLibrary[pid].persona.description==='Maps things.' && store.get('aet_personaLibrary').includes(pid));
 // ── the view ──
 state.charLibrary.c1={id:'c1',name:'Mira',card:{data:{name:'Mira'}},savedAt:new Date().toISOString()};
 state.presetLibrary.p1={id:'p1',name:'My Preset',preset:{prompts:[]},savedAt:new Date(Date.now()-9*86400000).toISOString()};
 state.promptLibrary.k1={id:'k1',name:'Pack One',pack:{modules:[]},savedAt:new Date(Date.now()-8*86400000).toISOString()};
 state.regexLibrary.r1={id:'r1',name:'Bold',single:true,set:{scripts:[{id:'s'}]},savedAt:new Date(Date.now()-7*86400000).toISOString()};
 setLibraryLayout('list'); navigateTo('library'); await w(500);
 const names=()=>[...document.querySelectorAll('.libx-card .libx-name')].map(e=>e.textContent);
 const total=names().length;
 chk('every kind shows up', ['Mira','My Preset','Pack One','Bold','Cartographer','Alpha Prime','Beta'].every(n=>names().includes(n)) && total===9, names());
 chk('regex script says so', [...document.querySelectorAll('.libx-kind')].some(e=>e.textContent==='Regex script'));
 chk('rail counts', document.querySelector('[data-type="all"]').textContent.includes('9') && document.querySelector('[data-type="persona"]').textContent.includes('1') && document.querySelector('[data-type="prompt"]').textContent.includes('1'));
 // filter by type
 document.querySelector('[data-type="lore"]').click(); await w(150);
 chk('type filter', names().length===4 && names().every(n=>['Alpha Prime','Beta','Gamma','Delta'].includes(n)), names());
 document.querySelector('[data-type="all"]').click(); await w(150);
 // search
 type(document.getElementById('libxSearch'),'pack'); await w(400); chk('search by name', names().join()==='Pack One', names());
 type(document.getElementById('libxSearch'),'zzz'); await w(400); chk('empty result message', /nothing matches/.test(document.getElementById('library-content').textContent));
 type(document.getElementById('libxSearch'),''); await w(400);
 // sort by name
 document.getElementById('libxSort').value='name'; document.getElementById('libxSort').dispatchEvent(new Event('change')); await w(200);
 chk('sort by name', names().join()===[...names()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).join(), names());
 document.getElementById('libxSort').value='recent'; document.getElementById('libxSort').dispatchEvent(new Event('change')); await w(200);
 // details: world, tags, note through the dialog
 const cardOf=n=>[...document.querySelectorAll('.libx-card')].find(c=>c.querySelector('.libx-name').textContent===n);
 cardOf('Mira').querySelector('[data-act="details"]').click(); await w(200);
 chk('details dialog opens', document.getElementById('libxDetailModal').classList.contains('open') && document.getElementById('libxDetailTitle').textContent==='Mira');
 const sel=document.getElementById('libxDetailWorld'); sel.value='__new'; sel.dispatchEvent(new Event('change')); await answer('Amaranthine'); await w(300);
 chk('new world from the dialog is selected', sel.options[sel.selectedIndex].textContent==='Amaranthine', sel.options[sel.selectedIndex].textContent);
 type(document.getElementById('libxDetailTags'),'wip, Main Cast'); type(document.getElementById('libxDetailNote'),'Needs greeting');
 document.getElementById('libxDetailDone').click(); await w(300);
 const mrec=recordOf(metaGet(),'char','c1');
 chk('details saved', mrec.tags.join()==='wip,Main Cast' && mrec.note==='Needs greeting' && !!mrec.world, mrec);
 chk('card shows world, tags and note', cardOf('Mira').textContent.includes('Amaranthine') && cardOf('Mira').textContent.includes('Main Cast') && cardOf('Mira').textContent.includes('Needs greeting'));
 // pin
 cardOf('Beta').querySelector('[data-act="pin"]').click(); await w(300);
 chk('pinned shows in its own section first', /Pinned/.test(document.querySelector('.libx-sec').textContent) && document.querySelector('.libx-grid .libx-name').textContent==='Beta');
 document.querySelector('[data-type="pinned"]').click(); await w(150); chk('pinned filter', names().join()==='Beta', names());
 document.querySelector('[data-type="all"]').click(); await w(150);
 // world filter + tag filter
 document.querySelector('[data-world]').click(); await w(200);
 chk('world filter shows header and its items', document.querySelector('.libx-worldhead') && names().join()==='Mira', names());
 type(document.getElementById('libxWorldNote'),'The court AU'); await w(700);
 chk('world note saved', Object.values(metaGet().worlds)[0].note==='The court AU' || Object.values(metaGet().worlds).some(x=>x.note==='The court AU'));
 document.querySelector('[data-tagf="wip"]').click(); await w(200); chk('tag filter on top of world', names().join()==='Mira');
 document.getElementById('libxClearTag').click(); await w(150);
 // rename + delete the world
 document.getElementById('libxRenameWorld').click(); await answer('Court AU'); await w(300);
 chk('world renamed', /Court AU/.test(document.querySelector('.libx-worldname').textContent));
 document.getElementById('libxDeleteWorld').click(); await w(200); document.getElementById('confirmOkBtn').click(); await w(400);
 chk('deleting a world keeps its items', names().length===9 && recordOf(metaGet(),'char','c1').world===null && recordOf(metaGet(),'char','c1').tags.length===2, [names().length]);
 // persona from the library
 document.querySelector('[data-libnew="persona"]').click(); await w(400);
 chk('new persona opens its dialog', document.getElementById('personaModal').classList.contains('open') && Object.keys(state.personaLibrary).length===2);
 type(document.getElementById('personaName'),'Detective'); type(document.getElementById('personaDesc'),'Hard-boiled.'); await w(700);
 const np=state.personaLibrary[state.activePersonaId];
 chk('persona autosaves', np.name==='Detective' && np.persona.description==='Hard-boiled.' && store.get('aet_personaLibrary').includes('Hard-boiled.'));
 chk('token estimate shows', /12 characters/.test(document.getElementById('personaCount').textContent), document.getElementById('personaCount').textContent);
 document.getElementById('personaDone').click(); await w(300);
 chk('persona appears in the library', names().includes('Detective'));
 // delete persona + undo
 const delId=state.activePersonaId; openPersona(delId); await w(150); document.getElementById('personaDelete').click(); await w(200); document.getElementById('confirmOkBtn').click(); await w(400);
 chk('persona deleted', !state.personaLibrary[delId]);
 const undo=[...document.querySelectorAll('.notif button, .notif .notif-act')].find(b=>/Undo/.test(b.textContent)); if(undo) undo.click(); await w(400);
 chk('undo brings the persona back', !!state.personaLibrary[delId]);
 // persona round trip
 const pj=personaToJson(state.personaLibrary[delId]); const back=parsePersonaJson(pj); chk('persona json round trip', back.name==='Detective' && back.persona.description==='Hard-boiled.');
 let bad=false; try{ parsePersonaJson('{"x":1}'); }catch(e){ bad=true; } chk('rejects non-persona files', bad);
 // opening an item goes to its editor
 cardOf('Mira').click(); await w(700);
 chk('opening a card goes to the editor with it open', state.activeCharId==='c1' || state.mode==='char', [state.mode,state.activeCharId]);
 chk('opened time recorded', !!recordOf(metaGet(),'char','c1').opened);
 return out;
})()
