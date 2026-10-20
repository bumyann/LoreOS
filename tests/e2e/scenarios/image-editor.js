(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const mkFile=async(name,c1,c2,wd=300,ht=200)=>{ const cv=document.createElement('canvas'); cv.width=wd; cv.height=ht; const x=cv.getContext('2d'); const gr=x.createLinearGradient(0,0,wd,ht); gr.addColorStop(0,c1); gr.addColorStop(1,c2); x.fillStyle=gr; x.fillRect(0,0,wd,ht); const b=await new Promise(r=>cv.toBlob(r,'image/png')); return new File([b],name,{type:'image/png'}); };
 const px=(c,x,y)=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data);
 // ── pure operations ──
 const im=(w,h,fn)=>{ const o=makeImage(w,h); for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const c=fn(x,y); const i=(y*w+x)*4; o.data[i]=c[0];o.data[i+1]=c[1];o.data[i+2]=c[2];o.data[i+3]=255; } return o; };
 const at=(o,x,y)=>Array.from(o.data.slice((y*o.width+x)*4,(y*o.width+x)*4+3));
 const a=im(4,2,(x,y)=>[x*10,y*10,5]);
 const r=rotateImage(a,1);
 chk('rotate clockwise swaps the sides', r.width===2&&r.height===4 && at(r,1,0).join()===at(a,0,0).join() && at(r,0,0).join()===at(a,0,1).join(), [at(r,1,0),at(a,0,0)]);
 chk('rotate left undoes rotate right', at(rotateImage(rotateImage(a,1),-1),3,1).join()===at(a,3,1).join());
 chk('flip', at(flipImage(a,'h'),0,0).join()===at(a,3,0).join() && at(flipImage(a,'v'),0,0).join()===at(a,0,1).join());
 const c=cropImage(a,{x:1,y:0,w:2,h:2});
 chk('crop', c.width===2&&c.height===2&&at(c,0,0).join()===at(a,1,0).join());
 chk('crop is kept inside the picture', JSON.stringify(cropRect({x:-5,y:2,w:99,h:99},10,10))==='{"x":0,"y":2,"w":10,"h":8}');
 chk('ratio crop is centred', JSON.stringify(ratioRect(400,300,1))==='{"x":50,"y":0,"w":300,"h":300}');
 chk('scaled size keeps the shape', JSON.stringify(scaledSize(400,200,{width:100}))==='{"w":100,"h":50}');
 const g1=im(2,1,()=>[100,150,200]);
 adjustPixels(g1,{brightness:150}); chk('brightness', at(g1,0,0).join()==='150,225,255');
 const g2=im(1,1,()=>[200,100,50]); adjustPixels(g2,{gray:100}); const gp=at(g2,0,0); chk('grayscale makes channels equal', gp[0]===gp[1]&&gp[1]===gp[2]&&gp[0]>90&&gp[0]<150, gp);
 const g3=im(1,1,()=>[10,20,30]); adjustPixels(g3,{invert:100}); chk('invert', at(g3,0,0).join()==='245,235,225');
 const g4=im(1,1,()=>[50,60,70]); adjustPixels(g4,{}); chk('neutral changes nothing', at(g4,0,0).join()==='50,60,70' && isNeutral({}) && !isNeutral({hue:5}));
 const g5=im(9,9,(x,y)=>x===4&&y===4?[255,255,255]:[0,0,0]); boxBlur(g5,1); chk('blur spreads a dot', at(g5,4,4)[0]<255&&at(g5,3,4)[0]>0);
 chk('adjust values are clamped', normalizeAdjust({brightness:999,blur:-3}).brightness===200 && normalizeAdjust({blur:-3}).blur===0 && normalizeAdjust({hue:'x'}).hue===0);
 const h=new History(2); h.push('a');h.push('b');h.push('c'); chk('history keeps the last few', h.past.join()==='b,c' && h.undo('d')==='c' && h.redo('c')==='d' && h.canUndo);
 // ── canvas level ──
 const cv=newCanvas(20,10); cv.getContext('2d').fillStyle='#f00'; cv.getContext('2d').fillRect(0,0,20,10);
 chk('canvas rotate/resize/crop', rotateCanvas(cv,1).width===10 && resizeCanvas(cv,40,20).width===40 && cropCanvas(cv,{x:0,y:0,w:5,h:5}).height===5);
 const tc=newCanvas(100,60); drawText(tc,{text:'Hi',x:5,y:5,size:40,color:'#00ff00'}); const tdata=tc.getContext('2d').getImageData(0,0,100,60).data; let green=0; for(let i=0;i<tdata.length;i+=4) if(tdata[i+1]>200&&tdata[i+3]>200) green++; chk('text paints pixels', green>20, green);
 const sc=newCanvas(50,50); strokePath(sc,[{x:5,y:25},{x:45,y:25}],{size:6,color:'#0000ff'}); chk('stroke paints a line', px(sc,25,25)[2]>200);
 // ── the Workshop mode ──
 state.galleryLibrary={}; store.set('aet_gallery','{}');
 const ids=await addFiles([await mkFile('Cathedral.png','#0e1424','#8a9bd2',400,300),await mkFile('Court.png','#3f4c79','#bcc9e9',200,400)]);
 switchMode('image'); await w(300);
 chk('Image tab exists and is active', !!document.querySelector('.mode-tab[data-mode="image"].active') && state.mode==='image');
 chk('sidebar lists the gallery', document.querySelectorAll('#entryList .img-ei').length===2);
 chk('empty state before a picture is open', /image editor/.test(document.getElementById('editorContent').textContent));
 document.querySelector('#entryList .img-ei').click(); await w(700);
 chk('opening makes a Workshop tab', state.wsItems.some(t=>t.type==='image') && document.querySelector('.ws-tab-type').textContent==='IM');
 chk('editor shows the picture', !!document.getElementById('imgView') && document.getElementById('imgView').width>0);
 const sid=state.activeImageId; const entry=state.galleryLibrary[sid];
 // rotate
 const wBefore=entry.w, hBefore=entry.h;
 document.querySelector('[data-tool="transform"]').click(); document.getElementById('imgRotR').click(); await w(200);
 chk('rotate edits the picture and marks the tab unsaved', document.getElementById('imgView').width===hBefore && state.wsItems.find(t=>t.type==='image').unsaved && document.getElementById('imgSave').textContent==='Save •');
 chk('storage untouched until saved', state.galleryLibrary[sid].w===wBefore);
 document.getElementById('imgUndo').click(); await w(150);
 chk('undo', document.getElementById('imgView').width===wBefore);
 document.getElementById('imgRedo').click(); await w(150);
 chk('redo', document.getElementById('imgView').width===hBefore);
 // adjust live then save
 document.querySelector('[data-tool="adjust"]').click(); await w(100);
 const inp=document.querySelector('[data-adj="brightness"]'); inp.value=60; inp.dispatchEvent(new Event('input',{bubbles:true})); await w(150);
 const dark=px(document.getElementById('imgView'),10,10);
 document.querySelector('[data-preset="noir"]').click(); await w(150);
 const noir=px(document.getElementById('imgView'),20,20); chk('preset applies a look', Math.abs(noir[0]-noir[1])<6 && Math.abs(noir[1]-noir[2])<6, noir);
 // crop
 document.querySelector('[data-tool="crop"]').click(); await w(150);
 document.querySelector('[data-ratio="1"]').click(); await w(100);
 chk('crop box shown', document.getElementById('imgCrop').style.display!=='none');
 document.getElementById('imgCropApply').click(); await w(300);
 chk('square crop applied', document.getElementById('imgView').width===document.getElementById('imgView').height, [document.getElementById('imgView').width,document.getElementById('imgView').height]);
 // resize
 document.querySelector('[data-tool="resize"]').click(); await w(100);
 const W=document.getElementById('imgW'); W.value=100; W.dispatchEvent(new Event('input',{bubbles:true}));
 document.getElementById('imgResizeApply').click(); await w(300);
 chk('resize', document.getElementById('imgView').width===100&&document.getElementById('imgView').height===100);
 // draw (real pointer events)
 document.querySelector('[data-tool="draw"]').click(); await w(100);
 const wrap=document.getElementById('imgWrap'), vr=document.getElementById('imgView').getBoundingClientRect();
 const ptr=(type,x,y)=>wrap.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:vr.left+x*vr.width/100,clientY:vr.top+y*vr.height/100,pointerId:1,pointerType:'mouse',isPrimary:true}));
 document.getElementById('imgBrushColor').value='#00ff00'; document.getElementById('imgBrushColor').dispatchEvent(new Event('input',{bubbles:true}));
 try{ ptr('pointerdown',20,50); ptr('pointermove',50,50); ptr('pointermove',80,50); ptr('pointerup',80,50);}catch(e){ chk('pointer drawing ran',false,String(e)); }
 await w(200);
 const drawn=px(document.getElementById('imgView'),50,50); chk('brush drew green', drawn[1]>200&&drawn[0]<80, drawn);
 // text
 document.querySelector('[data-tool="text"]').click(); await w(100);
 document.getElementById('imgTxtApply').click(); await w(300);
 // save
 document.getElementById('imgName').value='Cathedral edit'; document.getElementById('imgName').dispatchEvent(new Event('input',{bubbles:true}));
 document.getElementById('imgSave').click(); await w(900);
 const saved=state.galleryLibrary[sid];
 chk('saved over the picture', saved.w===100&&saved.h===100&&saved.source==='edited'&&saved.name==='Cathedral edit', [saved.w,saved.h,saved.source,saved.name]);
 chk('full image replaced in storage', store.get('aet_img_'+sid).startsWith('data:image/'));
 chk('tab no longer unsaved', !state.wsItems.find(t=>t.type==='image').unsaved && document.getElementById('imgSave').textContent==='Save');
 // save as copy
 const nBefore=Object.keys(state.galleryLibrary).length;
 document.getElementById('imgSaveCopy').click(); await w(900);
 chk('save as a copy adds a picture and opens it', Object.keys(state.galleryLibrary).length===nBefore+1 && state.activeImageId!==sid && /\(edit\)/.test(state.galleryLibrary[state.activeImageId].name));
 // dirty close asks
 document.querySelector('[data-tool="transform"]').click(); document.getElementById('imgFlipH').click(); await w(150);
 const tabId=state.wsItems.find(t=>t.itemId===state.activeImageId).id;
 const closing=wsCloseTab(tabId); await w(300);
 chk('closing a dirty picture asks first', document.getElementById('confirmModal').classList.contains('open') && state.wsItems.some(t=>t.id===tabId));
 const closedItem=state.activeImageId; document.getElementById('confirmOkBtn').click(); await closing; await w(300);
 chk('confirming closes the tab', !state.wsItems.some(t=>t.id===tabId));
 // gallery Edit button
 showLibraryTab('gallery'); navigateTo('library'); await w(500);
 document.querySelector('.gal-item').click(); await w(300);
 chk('the viewer has an Edit button', document.getElementById('galLbEdit').style.display!=='none');
 document.getElementById('galLbEdit').click(); await w(800);
 chk('Edit opens the picture in the Workshop', state.mode==='image' && !!document.getElementById('imgView') && state.activeImageId);
 // restore tabs
 chk('persisted tabs include images', JSON.parse(localStorage.getItem('aet_wsTabs')).items.some(t=>t.type==='image'));
 chk('no emoji in the editor', !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('editorContent').innerHTML));
 return out;
})()
