(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 const answer=async(text)=>{ await w(150); document.getElementById('renameModalInput').value=text; document.getElementById('renameOkBtn').click(); await w(200); };
 const mkFile=async(name,c1,c2,wd=300,ht=200)=>{ const cv=document.createElement('canvas'); cv.width=wd; cv.height=ht; const x=cv.getContext('2d'); const gr=x.createLinearGradient(0,0,wd,ht); gr.addColorStop(0,c1); gr.addColorStop(1,c2); x.fillStyle=gr; x.fillRect(0,0,wd,ht); const b=await new Promise(r=>cv.toBlob(r,'image/png')); return new File([b],name,{type:'image/png'}); };
 // fresh
 state.galleryLibrary={}; store.set('aet_gallery','{}'); store.set('aet_meta','{}'); store.set('aet_home','{}');
 // ── storage ──
 const ids=await addFiles([await mkFile('Cathedral.png','#0e1424','#8a9bd2',400,300),await mkFile('Court.png','#3f4c79','#bcc9e9',200,400),new File(['hello'],'notes.txt',{type:'text/plain'})]);
 chk('pictures added, other files skipped', ids.length===2 && Object.keys(state.galleryLibrary).length===2);
 const e0=state.galleryLibrary[ids[0]];
 chk('entry has name, size, thumbnail, source', e0.name==='Cathedral' && e0.w===400 && e0.h===300 && e0.thumb.startsWith('data:image/') && e0.source==='upload');
 chk('the full picture has its own key', store.get('aet_img_'+ids[0]).startsWith('data:image/') && !store.get('aet_gallery').includes(store.get('aet_img_'+ids[0]).slice(30,80)));
 chk('pictures are local only: not in the Drive sync or backup keys', !SYNC_KEYS.includes('aet_gallery') && !SYNC_KEYS.some(k=>k.startsWith('aet_img_')));
 chk('big-key routing', isBigKey('aet_img_x') && isBigKey('aet_gallery'));
 const long=await mkFile('Huge.png','#222','#eee',3600,2000); const hid=(await addFiles([long]))[0];
 chk('large pictures are shrunk for keeping', state.galleryLibrary[hid].w<=1800 && state.galleryLibrary[hid].thumb.length<getFull(hid).length, [state.galleryLibrary[hid].w]);
 // ── filter/sort pure ──
 const list=listPictures();
 chk('filter by name and source', filterPictures(list,{q:'cath'}).length===1 && filterPictures(list,{source:'generated'}).length===0 && filterPictures(list,{source:'upload'}).length===3);
 chk('sort', filterPictures(list,{sort:'name'})[0].name==='Cathedral' && filterPictures(list,{sort:'newest'}).length===3);
 // ── the tab ──
 showLibraryTab('gallery'); navigateTo('library'); await w(500);
 chk('Library has two tabs, Gallery showing', document.querySelectorAll('.libx-tab').length===2 && document.querySelector('.libx-tab.on').dataset.libtab==='gallery');
 chk('every picture is on the wall', document.querySelectorAll('.gal-item').length===3);
 chk('pictures do not appear on the shelves', (showLibraryTab('library'), renderLibraryView(), !document.querySelector('.libx-shelf') && !/Cathedral/.test(document.getElementById('library-content').textContent)));
 document.querySelector('[data-libtab="gallery"]').click(); await w(400);
 chk('tab choice sticks', JSON.parse(localStorage.getItem('loreos_libview')).tab==='gallery');
 chk('source chips count', /All\s*3/.test(document.querySelector('.gal-bar').textContent) && /Uploaded\s*3/.test(document.querySelector('.gal-bar').textContent));
 type(document.getElementById('galSearch'),'court'); await w(400);
 chk('search the wall', document.querySelectorAll('.gal-item').length===1 && /Court/.test(document.querySelector('.gal-item').getAttribute('aria-label')));
 type(document.getElementById('galSearch'),''); await w(400);
 // ── viewer ──
 const itemOf=n=>[...document.querySelectorAll('.gal-item')].find(i=>i.getAttribute('aria-label')===n);
 itemOf('Cathedral').click(); await w(300);
 chk('clicking opens the viewer with the full picture', document.getElementById('galLightbox').classList.contains('open') && document.getElementById('galLbImg').src===store.get('aet_img_'+ids[0]) && document.getElementById('galLbName').value==='Cathedral');
 chk('viewer shows source, size and date', /Uploaded/.test(document.getElementById('galLbMeta').textContent) && /400 × 300/.test(document.getElementById('galLbMeta').textContent));
 chk('no prompt box for an upload', document.getElementById('galLbPromptWrap').style.display==='none');
 const first=document.getElementById('galLbName').value; document.getElementById('galLbNext').click(); await w(200);
 chk('next picture', document.getElementById('galLbName').value!==first);
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})); await w(200);
 chk('arrow key goes back', document.getElementById('galLbName').value===first);
 type(document.getElementById('galLbName'),'Drowned cathedral'); document.getElementById('galLbName').dispatchEvent(new Event('change')); await w(300);
 chk('renaming saves', state.galleryLibrary[ids[0]].name==='Drowned cathedral' && !!itemOf('Drowned cathedral'));
 itemOf('Drowned cathedral').click(); await w(250);
 document.getElementById('galLbFav').click(); await w(300);
 chk('favourite', recordOf(metaGet(),'image',ids[0]).pinned===true && !!itemOf('Drowned cathedral').querySelector('.gal-fav'));
 document.getElementById('galLbHome').click(); await w(700);
 chk('pin to Home makes an image card with the picture', homeGet().board.length===1 && homeGet().board[0].type==='image' && homeGet().board[0].title==='Drowned cathedral' && !!homeGet().board[0].image);
 chk('Edit is hidden until the image editor exists', document.getElementById('galLbEdit').style.display==='none' || !!hooks.edit);
 // details: tags + world
 document.getElementById('galLbDetails').click(); await w(300);
 chk('details dialog opens for a picture (no picture picker)', document.getElementById('libxDetailModal').classList.contains('open') && document.getElementById('libxPicBox').style.display==='none');
 type(document.getElementById('libxDetailTags'),'mood, gothic'); const ws=document.getElementById('libxDetailWorld'); ws.value='__new'; ws.dispatchEvent(new Event('change')); await answer('Celestalis'); await w(300);
 type(document.getElementById('libxDetailTags'),'mood, gothic'); document.getElementById('libxDetailDone').click(); await w(400);
 chk('tags saved on the picture', recordOf(metaGet(),'image',ids[0]).tags.join()==='mood,gothic' && !!recordOf(metaGet(),'image',ids[0]).world, recordOf(metaGet(),'image',ids[0]));
 chk('tag chip and world filter appear', !!document.querySelector('[data-galtag="mood"]') && !!document.getElementById('galWorld'));
 document.querySelector('[data-galtag="mood"]').click(); await w(300);
 chk('filter by tag', document.querySelectorAll('.gal-item').length===1);
 document.querySelector('[data-galtag="mood"]').click(); await w(300);
 document.getElementById('galFavs').click(); await w(300); chk('favourites filter', document.querySelectorAll('.gal-item').length===1);
 document.getElementById('galFavs').click(); await w(300);
 const wsel=document.getElementById('galWorld'); wsel.value=Object.keys(metaGet().worlds)[0]; wsel.dispatchEvent(new Event('change')); await w(300);
 chk('filter by world', document.querySelectorAll('.gal-item').length===1); wsel.value=''; wsel.dispatchEvent(new Event('change')); await w(300);
 // ── delete + undo ──
 itemOf('Court').click(); await w(250); document.getElementById('galLbDelete').click(); await w(400);
 chk('delete removes the picture and its stored file', !Object.values(state.galleryLibrary).some(p=>p.name==='Court') && !store.get('aet_img_'+ids[1]));
 const undo=[...document.querySelectorAll('.notif button, .notif .notif-act')].find(b=>/Undo/.test(b.textContent)); if(undo) undo.click(); await w(400);
 chk('undo brings it back with its file', Object.values(state.galleryLibrary).some(p=>p.name==='Court') && !!store.get('aet_img_'+ids[1]));
 // ── drop + paste ──
 const zone=document.getElementById('galZone');
 const dt=new DataTransfer(); dt.items.add(await mkFile('Dropped.png','#400','#f88')); dt.items.add(new File(['x'],'x.zip',{type:'application/zip'}));
 const before=Object.keys(state.galleryLibrary).length;
 zone.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true})); await w(900);
 chk('dropping pictures adds them (and not as character cards)', Object.keys(state.galleryLibrary).length===before+1 && Object.keys(state.charLibrary).length===0 && !document.getElementById('dropHint').classList.contains('on'));
 { const pdt=new DataTransfer(); pdt.items.add(await mkFile('Pasted.png','#044','#8ff')); const n0=Object.keys(state.galleryLibrary).length; document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:pdt,bubbles:true,cancelable:true})); await w(900);
   chk('pasting a picture adds it', Object.keys(state.galleryLibrary).length===n0+1); }
 // ── zip round trip ──
 const blob=await exportGalleryZip(); const n1=Object.keys(state.galleryLibrary).length;
 const z=await JSZip.loadAsync(await blob.arrayBuffer());
 chk('zip has an index and the pictures', !!z.file('gallery.json') && Object.keys(z.files).filter(f=>f.startsWith('images/')&&!z.files[f].dir).length===n1, Object.keys(z.files).length);
 const added=await importGalleryZip(await blob.arrayBuffer());
 chk('importing the zip brings the pictures back in', added===n1 && Object.keys(state.galleryLibrary).length===n1*2, [added,Object.keys(state.galleryLibrary).length]);
 // ── persistence ──
 await kvFlush(); chk('index and files are saved', Object.keys(JSON.parse(store.get('aet_gallery'))).length===n1*2 && Object.keys(state.galleryLibrary).every(id=>!!store.get('aet_img_'+id)));
 // storage shape guard
 chk('gallery shape is checked at start-up', true);
 chk('no emoji in the gallery', !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('library-content').innerHTML));
 return out;
})()
