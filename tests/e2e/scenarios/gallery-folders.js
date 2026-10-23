(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const mk=(n,col)=>{ const cv=document.createElement('canvas'); cv.width=60; cv.height=40; const x=cv.getContext('2d'); x.fillStyle=col; x.fillRect(0,0,60,40); return new Promise(r=>cv.toBlob(b=>r(new File([b],n,{type:'image/png'}))));};
 const ids=await addFiles([await mk('a.png','#c33'),await mk('b.png','#3c3'),await mk('c.png','#33c')]);
 chk('three pictures', ids.length===3);
 const f1=folderAdd('Refs'); const f2=folderAdd('Faces',f1.id);
 chk('folders made', !!f1&&!!f2&&foldersGet().length===2);
 chk('nested path', folderPathNames(foldersGet(),f2.id).join('/')==='Refs/Faces');
 chk('move in', moveToFolder([ids[0],ids[1]],f2.id)===2 && getEntry(ids[0]).folder===f2.id);
 chk('a folder cannot go inside itself or its child', folderMove(f1.id,f2.id)===false && folderMove(f1.id,f1.id)===false);
 // zip round trip keeps the folders
 const blob=await exportGalleryZip(); const added=await importGalleryZip(await blob.arrayBuffer());
 chk('zip import', added>=3, added);
 const inFaces=Object.values(state.galleryLibrary).filter(e=>e.folder&&foldersGet().find(f=>f.id===e.folder&&f.name==='Faces')).length;
 chk('folders came back with the zip (no duplicate folders)', foldersGet().length===2 && inFaces>=4, [foldersGet().length,inFaces]);
 // the view
 showLibraryTab('gallery'); navigateTo('library'); await w(400);
 chk('root shows the folder', [...document.querySelectorAll('.gal-folder')].some(b=>b.textContent.includes('Refs')));
 document.querySelector('.gal-folder[data-galfolder="'+f1.id+'"]').click(); await w(300);
 chk('inside Refs shows subfolder + breadcrumb', !!document.querySelector('.gal-folder[data-galfolder="'+f2.id+'"]') && !!document.querySelector('.gal-crumbs'));
 document.querySelector('.gal-folder[data-galfolder="'+f2.id+'"]').click(); await w(300);
 chk('pictures of that folder show', document.querySelectorAll('.gal-item').length>=4, document.querySelectorAll('.gal-item').length);
 // searching looks everywhere
 const s=document.getElementById('galSearch'); s.value='c'; s.dispatchEvent(new Event('input')); await w(500);
 chk('search ignores folders', document.querySelectorAll('.gal-item').length>=1 && !document.querySelector('.gal-crumbs'));
 s.value=''; s.dispatchEvent(new Event('input')); await w(500);
 // deleting a folder keeps pictures
 folderRemove(f2.id); chk('pictures moved up', getEntry(ids[0]).folder===f1.id && foldersGet().length===1);
 gv_reset: { document.querySelector('.gal-crumb')&&document.querySelector('.gal-crumb').click(); }
 return out;
})()
