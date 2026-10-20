(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms)); window.__hit=[];
 const mk=n=>`<img src=x onerror="window.__hit.push('${n}')">`; const AT=n=>`x" onfocus="window.__hit.push('${n}')" autofocus x="`;
 const now=()=>new Date().toISOString();
 // data in every store
 const lbName=mk('lbname');
 lorebook={name:mk('lbtitle'),entries:{0:{uid:0,comment:mk('entrycomment'),key:[mk('key')],keysecondary:[],content:mk('content'),group:AT('group'),order:AT('order')}}}; lorebook.entries=rebuildEntries(lorebook.entries);
 const lib={}; lib[lbName]={name:lbName,lb:JSON.parse(JSON.stringify(lorebook)),savedAt:now(),history:[{ts:now(),label:mk('cplabel'),data:lzPack({name:'x',entries:{}})}]}; store.set('aet_library',JSON.stringify(lib));
 charLibrary.c1={id:'c1',name:mk('charname'),card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:mk('charname'),description:mk('d'),tags:[mk('tag')],alternate_greetings:[mk('alt')],extensions:{},creator:AT('creator')}},imageData:'data:image/png;base64,AA'+'" onerror="window.__hit.push(\'imgsrc\')',savedAt:now(),history:[{ts:now(),label:mk('charcp'),data:lzPack({})}]};
 presetLibrary.p1={id:'p1',name:mk('presetname'),preset:{...blankPreset(),name:mk('presetname'),wi_format:AT('wi'),temperature:AT('temp'),prompts:[{id:'a',identifier:AT('ident'),name:mk('promptname'),content:mk('pc'),enabled:true,role:'system'}]},savedAt:now()};
 store.set('aet_tpl_char',JSON.stringify({t1:{id:'t1',name:mk('tplname'),content:mk('tplcontent'),savedAt:now()}}));
 store.set('aet_tpl_lore',store.get('aet_tpl_char')); store.set('aet_tpl_preset',store.get('aet_tpl_char'));
 store.set('loreos_notebook',JSON.stringify({pages:{nb1:{id:AT('nbid'),title:mk('nbtitle'),content:'',updatedAt:now()}},activePageId:null}));
 // render everything
 for (const v of ['home','library','notebook','laboratory']) { navigateTo(v); await w(300); }
 navigateTo('editor'); switchMode('lore'); renderList(); openInTab(0); await w(200);
 g('lorebookName').value=mk('lbinput'); exportJson && 0;
 openLibrary(); await w(150); document.querySelector('#libList .lib-hist')?.click(); await w(200); document.getElementById('itemHistoryModal')?.remove(); closeModal('libModal');
 switchMode('char'); renderCharSidebar(); openChar('c1'); await w(300); openCharLibrary(); await w(150); document.querySelector('#libList .lib-hist')?.click(); await w(200); document.getElementById('itemHistoryModal')?.remove(); closeModal('libModal');
 openAttachLbModal && openAttachLbModal(); await w(200); closeModal('attachLbModal');
 switchMode('preset'); renderPresetSidebar(); openPreset('p1'); await w(300); openPresetLibrary(); await w(150); closeModal('libModal');
 for (const m of ['lore','char','preset']) { openTemplateLibrary(m); await w(250); closeModal('tplModal'); }
 openWsPicker(); for (const t of ['lore','char','preset']) { renderWsPickerList(t); await w(100); } closeModal('wsPickerModal');
 // merge + search modals with hostile entries
 mergeStaging={name:mk('mergename'),entries:rebuildEntries({0:{uid:0,comment:mk('mergec'),key:[mk('mergek')]}})}; g('mergeCurrent').textContent='x'; g('mergeFrom').textContent='y'; renderMergeList(); await w(100);
 g('srFind').value='content'; switchMode('lore'); doSearch(); await w(150);
 // backup history modal + settings storage panel
 openSyncHistory(); await w(100); openModal('settingsModal'); await w(400);
 navigateTo('library'); await w(300); navigateTo('home'); await w(300);
 o.hits=window.__hit; return o;
})()
