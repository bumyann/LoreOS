(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 const answer=async(text)=>{ await w(150); document.getElementById('renameModalInput').value=text; document.getElementById('renameOkBtn').click(); await w(200); };
 const cv=document.createElement('canvas'); cv.width=cv.height=8; cv.getContext('2d').fillRect(0,0,8,8); const PIC=cv.toDataURL('image/png');
 // ── pure meta: folders ──
 let m=normalizeMeta(null); const wid=addWorld(m,'Celestalis'); const f1=addFolder(m,wid,null,'Series A'); const f2=addFolder(m,wid,f1,'Book 1'); const f3=addFolder(m,wid,null,'Series B');
 chk('nested folders', m.folders[f2].parent===f1 && folderPath(m,f2).map(f=>f.name).join()==='Series A,Book 1' && childFolders(m,wid,null).length===2 && folderTree(m,f1).length===2);
 patchItem(m,'char','x',{world:wid,folder:f2}); chk('item in a folder', m.items['char:x'].folder===f2);
 const w2=addWorld(m,'Other'); patchItem(m,'char','x',{world:w2}); chk('changing world clears the folder', m.items['char:x'].folder===null);
 patchItem(m,'char','x',{world:wid,folder:f2}); removeFolder(m,f1); chk('deleting a folder moves things up', !m.folders[f1] && m.folders[f2].parent===null && m.items['char:x'].folder===f2);
 removeFolder(m,f2); chk('and items go up too', m.items['char:x'].folder===null);
 const bad=normalizeMeta({worlds:{a:{name:'A'}},folders:{p:{world:'a',parent:'q',name:'P'},q:{world:'a',parent:'p',name:'Q'},z:{world:'nope',name:'Z'}},items:{}});
 chk('folder cycles and strangers are repaired', Object.keys(bad.folders).sort().join()==='p,q' && (bad.folders.p.parent===null || bad.folders.q.parent===null) , bad.folders);
 chk('too-big pictures are dropped', normalizeMeta({worlds:{a:{name:'A',banner:'data:image/png;base64,'+'A'.repeat(800000)}}}).worlds.a.banner==='');
 removeWorld(m,wid); chk('deleting a world drops its folders', Object.values(m.folders).every(f=>f.world!==wid) && !m.items['char:x']);
 // ── view ──
 store.set('aet_meta','{}'); store.set('aet_library',JSON.stringify({Lore1:{name:'Lore1',lb:{entries:{}},savedAt:new Date().toISOString()}}));
 state.presetLibrary.p1={id:'p1',name:'Preset One',preset:{prompts:[]},savedAt:new Date(Date.now()-86400000).toISOString()};
 state.promptLibrary.k1={id:'k1',name:'Pack One',pack:{modules:[]},savedAt:new Date(Date.now()-2*86400000).toISOString()};
 state.charLibrary.c1={id:'c1',name:'Mira',card:{data:{name:'Mira'}},imageData:PIC,savedAt:new Date().toISOString()};
 setLibraryLayout('list'); navigateTo('library'); await w(400);
 const cardOf=n=>[...document.querySelectorAll('.libx-card')].find(c=>c.querySelector('.libx-name').textContent===n);
 const names=()=>[...document.querySelectorAll('.libx-card .libx-name')].map(e=>e.textContent);
 // picture + symbol on a non-character
 cardOf('Preset One').querySelector('[data-act="details"]').click(); await w(200);
 chk('picture controls shown for presets', document.getElementById('libxPicBox').style.display!=='none');
 document.querySelector('#libxSymGrid [data-sym="☾"]').click(); await w(150);
 chk('symbol saved', recordOf(metaGet(),'preset','p1').symbol==='☾');
 chk('symbol preview', document.getElementById('libxPicPreview').textContent.includes('☾'));
 _pickPicture.fn=async()=>PIC; document.getElementById('libxPicBtn').click(); await w(300);
 chk('picture saved', recordOf(metaGet(),'preset','p1').image===PIC);
 document.getElementById('libxDetailDone').click(); await w(300);
 chk('card shows the picture over the symbol', !!cardOf('Preset One').querySelector('.libx-thumb img'));
 cardOf('Preset One').querySelector('[data-act="details"]').click(); await w(200);
 document.getElementById('libxPicClear').click(); await w(150); document.getElementById('libxDetailDone').click(); await w(300);
 chk('without the picture the symbol shows', cardOf('Preset One').querySelector('.libx-thumb').textContent.includes('☾'));
 cardOf('Pack One').querySelector('[data-act="details"]').click(); await w(200); document.getElementById('libxDetailDone').click(); await w(300);
 chk('default is the kind pixel icon, not an emoji', !!cardOf('Pack One').querySelector('.libx-thumb svg.px') && !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('library-content').textContent));
 cardOf('Mira').querySelector('[data-act="details"]').click(); await w(200);
 chk('characters use their own picture (no picker)', document.getElementById('libxPicBox').style.display==='none' && !!cardOf('Mira').querySelector('.libx-thumb img'));
 document.getElementById('libxDetailDone').click(); await w(200);
 // ── worlds, banner, folders through the UI ──
 document.getElementById('libxAddWorld').click(); await answer('Celestalis'); await w(300);
 chk('world opens with banner controls', !!document.querySelector('.libx-banner') && /Add a banner/.test(document.getElementById('libxBannerBtn').textContent));
 document.getElementById('libxBannerBtn').click(); await w(400);
 const wr=Object.values(metaGet().worlds)[0];
 chk('banner stored and shown', wr.banner===PIC && /url\(/.test(document.querySelector('.libx-banner').getAttribute('style')||'') && /Change banner/.test(document.getElementById('libxBannerBtn').textContent));
 chk('world colour swatches shown', document.querySelectorAll('#libxWorldColors [data-wcolor]').length===12);
 document.querySelector('#libxWorldColors [data-wcolor="#c46c6c"]').click(); await w(300);
 chk('swatch changes the world colour everywhere', Object.values(metaGet().worlds)[0].color==='#c46c6c' && /rgb\(196, 108, 108\)/.test(document.querySelector('.libx-worldname .libx-dot').style.background) && /rgb\(196, 108, 108\)/.test(document.querySelector('.libx-rail-item.active .libx-dot').style.background));
 { const wp=document.getElementById('libxWorldColorPick'); wp.value='#12ab34'; wp.dispatchEvent(new Event('change')); await w(300); }
 chk('custom colour works too', Object.values(metaGet().worlds)[0].color==='#12ab34');
 chk('bad colours are dropped', normalizeMeta({worlds:{a:{name:'A',color:'red'}}}).worlds.a.color==='');
 document.getElementById('libxBannerClear').click(); await w(300); chk('banner removed', Object.values(metaGet().worlds)[0].banner==='');
 // folders
 document.getElementById('libxAddFolder').click(); await answer('Series A'); await w(300);
 chk('folder card shown', document.querySelectorAll('.libx-folder').length===1 && /Series A/.test(document.querySelector('.libx-folder').textContent));
 document.querySelector('.libx-folder').click(); await w(300);
 chk('inside the folder: breadcrumbs and folder tools', document.querySelectorAll('.libx-crumb').length===2 && !!document.getElementById('libxRenameFolder'));
 document.getElementById('libxAddFolder').click(); await answer('Book 1'); await w(300);
 document.querySelector('.libx-folder').click(); await w(300);
 chk('nested folder', document.querySelectorAll('.libx-crumb').length===3 && /Series A/.test(document.querySelector('.libx-crumbs').textContent) && /Book 1/.test(document.querySelector('.libx-crumbs').textContent));
 // put an item in the nested folder through details
 document.querySelector('[data-type="all"]').click(); await w(200);
 cardOf('Pack One').querySelector('[data-act="details"]').click(); await w(200);
 const ws=document.getElementById('libxDetailWorld'); ws.value=Object.keys(metaGet().worlds)[0]; ws.dispatchEvent(new Event('change')); await w(400);
 const fs=document.getElementById('libxDetailFolder');
 chk('folder list appears once a world is chosen', !fs.disabled && [...fs.options].some(o=>/Series A › Book 1/.test(o.textContent)), [...fs.options].map(o=>o.textContent));
 fs.value=[...fs.options].find(o=>/Book 1/.test(o.textContent)).value; fs.dispatchEvent(new Event('change')); await w(300);
 chk('item has the folder', !!recordOf(metaGet(),'prompt','k1').folder);
 document.getElementById('libxDetailDone').click(); await w(300);
 // browse: world root hides it, folder shows it
 document.querySelector('[data-world]').click(); await w(300);
 chk('world top level does not list foldered items', !names().includes('Pack One'), names());
 document.querySelectorAll('.libx-folder')[0].click(); await w(300); chk('series level does not list it either', !names().includes('Pack One'), names());
 document.querySelector('.libx-folder').click(); await w(300); chk('the folder lists it', names().join()==='Pack One', names());
 type(document.getElementById('libxSearch'),'pack'); await w(400); chk('search inside a folder works', names().join()==='Pack One');
 type(document.getElementById('libxSearch'),''); await w(400);
 // search at the world level reaches into folders
 document.querySelector('.libx-crumb[data-folder=""]').click(); await w(300);
 type(document.getElementById('libxSearch'),'pack'); await w(400); chk('searching a world reaches into its folders', names().join()==='Pack One', names());
 type(document.getElementById('libxSearch'),''); await w(400);
 // new thing made inside a folder lands there
 document.querySelectorAll('.libx-folder')[0].click(); await w(300); document.querySelector('.libx-folder').click(); await w(300);
 const nm=Object.keys(state.personaLibrary).length; document.querySelector('[data-libnew="persona"]').click(); await w(500); document.getElementById('personaDone').click(); await w(300);
 const pid=Object.keys(state.personaLibrary).pop(); const prec=recordOf(metaGet(),'persona',pid);
 chk('new persona lands in the open folder', Object.keys(state.personaLibrary).length===nm+1 && !!prec.folder && !!prec.world, prec);
 // rename + delete a folder
 document.getElementById('libxRenameFolder').click(); await answer('Book One'); await w(300);
 chk('folder renamed', /Book One/.test(document.querySelector('.libx-crumbs').textContent));
 document.getElementById('libxDeleteFolder').click(); await w(200); document.getElementById('confirmOkBtn').click(); await w(400);
 chk('deleting a folder keeps its items one level up', document.querySelectorAll('.libx-crumb').length===2 && names().includes('Pack One') && names().includes('New persona') && recordOf(metaGet(),'prompt','k1').folder!==null, names());
 chk('no emoji anywhere in the library page', !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('library-content').innerHTML));
 return out;
})()
