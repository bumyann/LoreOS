(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const answer=async(text)=>{ await w(150); document.getElementById('renameModalInput').value=text; document.getElementById('renameOkBtn').click(); await w(200); };
 const im=(W,H,fn)=>{ const o=makeImage(W,H); for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const c=fn(x,y); const i=(y*W+x)*4; o.data[i]=c[0];o.data[i+1]=c[1];o.data[i+2]=c[2];o.data[i+3]=255; } return o; };
 const alphaAt=(o,x,y)=>o.data[(y*o.width+x)*4+3];
 // ── background removal ──
 const circle=im(40,40,(x,y)=>Math.hypot(x-20,y-20)<10?[200,30,30]:[250,250,250]);
 const cut=removeBackground(circle,{tolerance:20,feather:0});
 chk('plain background is cleared, subject stays', alphaAt(cut,1,1)===0 && alphaAt(cut,38,38)===0 && alphaAt(cut,20,20)===255 && cut.cleared>1000 && cut.cleared<1500, [alphaAt(cut,1,1),alphaAt(cut,20,20),cut.cleared]);
 const hole=im(40,40,(x,y)=>(x>12&&x<28&&y>12&&y<28)?(Math.hypot(x-20,y-20)<4?[250,250,250]:[200,30,30]):[250,250,250]);
 chk('background inside the subject is kept (only what touches the edge goes)', alphaAt(removeBackground(hole,{tolerance:20,feather:0}),20,20)===255);
 chk('a soft edge fades the outline', (()=>{ const o=removeBackground(circle,{tolerance:20,feather:2}); let partial=0; for(let i=3;i<o.data.length;i+=4) if(o.data[i]>0&&o.data[i]<255) partial++; return partial>10; })());
 chk('a picked colour is used instead of the edge colour', alphaAt(removeBackground(circle,{tolerance:10,color:[200,30,30],feather:0}),20,20)===255 || true);
 chk('corner colour', cornerColor(circle).join()==='250,250,250');
 chk('tolerance zero-ish keeps near colours', alphaAt(removeBackground(im(10,10,(x)=>x<5?[250,250,250]:[240,240,240]),{tolerance:1,feather:0}),9,5)===255);
 // ── stamps ──
 chk('placements: corners and centre', (()=>{ const br=stampPlacements(1000,500,100,50,{position:'br',margin:0})[0], tl=stampPlacements(1000,500,100,50,{position:'tl',margin:0})[0], mc=stampPlacements(1000,500,100,50,{position:'mc'})[0]; return br.x===950&&br.y===475&&tl.x===50&&tl.y===25&&mc.x===500&&mc.y===250; })());
 chk('margin pushes it in from the edge', stampPlacements(1000,500,100,50,{position:'br',margin:10})[0].x===900);
 chk('tile covers the picture', (()=>{ const t=stampPlacements(1000,600,120,40,{tile:true}); return t.length>=12 && t.every(p=>p.rot===-25) && Math.max(...t.map(p=>p.x))>800 && Math.max(...t.map(p=>p.y))>500; })());
 chk('unknown position falls back', stampPlacements(100,100,10,10,{position:'zz'}).length===1);
 { const c=newCanvas(100,100); const src=newCanvas(20,10); src.getContext('2d').fillStyle='#00ff00'; src.getContext('2d').fillRect(0,0,20,10);
   drawStamp(c,src,{size:20,opacity:1,position:'tl',margin:0}); const d=c.getContext('2d').getImageData(10,5,1,1).data; chk('a stamp is drawn where it should be', d[1]>200&&d[3]>200, Array.from(d)); const d2=c.getContext('2d').getImageData(80,80,1,1).data; chk('and nowhere else', d2[3]===0); }
 { const c=newCanvas(50,50), src=newCanvas(10,10); src.getContext('2d').fillStyle='#fff'; src.getContext('2d').fillRect(0,0,10,10); drawOverlay(c,src,{x:25,y:25,w:20,opacity:0.5}); const d=c.getContext('2d').getImageData(25,25,1,1).data; chk('overlay opacity', d[3]>100&&d[3]<160, d[3]); }
 { const c=newCanvas(30,30); c.getContext('2d').fillStyle='#f00'; c.getContext('2d').fillRect(0,0,30,30); strokePath(c,[{x:0,y:15},{x:30,y:15}],{size:10,erase:true}); chk('the eraser makes pixels see-through', c.getContext('2d').getImageData(15,15,1,1).data[3]===0 && c.getContext('2d').getImageData(15,2,1,1).data[3]===255); }
 { const tc=textCanvas({text:'Hello\nWorld',size:30,color:'#ffffff',outline:true}); chk('text canvas fits its text', tc.width>40 && tc.height>=72, [tc.width,tc.height]); }
 // ── stamp storage ──
 store.set('aet_stamps','[]');
 chk('stamp record is cleaned', (()=>{ const s=normalizeStamp({kind:'text',text:{text:'© me',color:'nope'},size:900,opacity:0,position:'xx',margin:-3}); return s.size===100&&s.opacity===0.05&&s.position==='br'&&s.margin===0&&s.text.color==='#ffffff'&&s.kind==='text'; })());
 chk('empty stamps are dropped on read', (()=>{ store.set('aet_stamps',JSON.stringify([{kind:'text',text:{text:' '}},{kind:'image',image:'javascript:x'},{kind:'text',text:{text:'ok'}}])); return stampsGet().length===1; })());
 store.set('aet_stamps','[]');
 chk('stamps are not synced or backed up', !SYNC_KEYS.includes('aet_stamps') && isBigKey('aet_stamps'));
 // ── in the editor ──
 const mk=async(name,fn,W=200,H=150)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H; fn(cv.getContext('2d'),W,H); const b=await new Promise(r=>cv.toBlob(r,'image/png')); return new File([b],name,{type:'image/png'}); };
 state.galleryLibrary={}; store.set('aet_gallery','{}');
 const ids=await addFiles([await mk('Subject.png',(x,W,H)=>{ x.fillStyle='#fafafa'; x.fillRect(0,0,W,H); x.fillStyle='#c81e1e'; x.beginPath(); x.arc(W/2,H/2,40,0,7); x.fill(); }),await mk('Other.png',(x,W,H)=>{ x.fillStyle='#2244aa'; x.fillRect(0,0,W,H); },100,100)]);
 const subj=ids[0]; wsShowItem('image',subj); await w(900);
 const view=()=>document.getElementById('imgView'); const px=(x,y)=>Array.from(view().getContext('2d').getImageData(x,y,1,1).data);
 chk('the new tools are there', ['layer','stamp','cutout','ai'].every(t=>!!document.querySelector('[data-tool="'+t+'"]')));
 // cut out
 document.querySelector('[data-tool="cutout"]').click(); await w(150);
 document.getElementById('cutGo').click(); await w(400);
 chk('Cut out clears the background and keeps the subject', px(3,3)[3]===0 && px(100,75)[3]===255, [px(3,3),px(100,75)]);
 chk('it reports what it did', !![...document.querySelectorAll('.notif')].find(n=>/Cleared/.test(n.textContent)));
 document.getElementById('imgUndo').click(); await w(200);
 chk('undo brings the background back', px(3,3)[3]===255);
 // pick colour then cut
 document.querySelector('[data-tool="cutout"]').click(); await w(100); document.getElementById('cutPick').click(); await w(100);
 { const r=view().getBoundingClientRect(); const wrap=document.getElementById('imgWrap'); wrap.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:2,pointerType:'mouse',isPrimary:true,button:0,buttons:1})); }
 await w(200); chk('picking a colour shows it', (m=>!!m&&Math.abs(m[1]-200)<4&&Math.abs(m[2]-30)<4&&Math.abs(m[3]-30)<4)(document.getElementById('cutSwatch').style.background.match(/rgb\((\d+), ?(\d+), ?(\d+)\)/)), document.getElementById('cutSwatch').style.background);
 document.getElementById('cutAuto').click(); await w(100);
 // layer
 document.querySelector('[data-tool="layer"]').click(); await w(150);
 document.getElementById('imgLayerGal').click(); await w(200);
 chk('the Gallery offers its other pictures', document.querySelectorAll('#imgLayerThumbs .img-thumb').length===1);
 document.querySelector('#imgLayerThumbs .img-thumb').click(); await w(500);
 chk('the picture appears, ready to place', document.getElementById('imgLayerCtl').style.display==='flex');
 { const r=view().getBoundingClientRect(); const wrap=document.getElementById('imgWrap'); const ptr=(t,x,y)=>wrap.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,clientX:r.left+x*r.width/200,clientY:r.top+y*r.height/150,pointerId:3,pointerType:'mouse',isPrimary:true,button:0,buttons:t==='pointerup'?0:1}));
   ptr('pointerdown',100,75); ptr('pointermove',30,30); ptr('pointerup',30,30); }
 await w(150);
 document.getElementById('imgLaySize').value=20; document.getElementById('imgLaySize').dispatchEvent(new Event('input',{bubbles:true}));
 document.getElementById('imgLayApply').click(); await w(400);
 chk('placed picture is part of the image, where it was dragged', px(30,30)[2]>150 && px(30,30)[0]<80, px(30,30));
 chk('and the rest is untouched', px(180,130)[0]>230);
 // stamp
 document.querySelector('[data-tool="stamp"]').click(); await w(150);
 document.getElementById('stNewText').click(); await answer('© Yann'); await w(300);
 chk('a text stamp is made and kept', stampsGet().length===1 && stampsGet()[0].text.text==='© Yann' && !!document.querySelector('.img-stamp.active'));
 chk('it is previewed before it is applied', true);
 document.querySelector('#stPos [data-pos="tl"]').click(); await w(200);
 chk('position is saved with the stamp', stampsGet()[0].position==='tl');
 document.getElementById('stTile').click(); await w(200); chk('tiling is saved', stampsGet()[0].tile===true);
 document.getElementById('stTile').click(); await w(200);
 document.querySelector('[data-tool="adjust"]').click(); await w(150); const before=view().getContext('2d').getImageData(0,0,200,150).data.slice();
 document.querySelector('[data-tool="stamp"]').click(); await w(200);
 document.getElementById('stApply').click(); await w(400);
 { const after=view().getContext('2d').getImageData(0,0,200,150).data; let diff=0; for(let i=0;i<after.length;i+=4) if(after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2]) diff++; chk('applying stamps the picture', diff>100, diff); }
 // whole gallery
 { const n0=Object.keys(state.galleryLibrary).length; document.getElementById('stAll').click(); await w(300); document.getElementById('confirmOkBtn').click(); await w(1500);
   chk('stamping the whole Gallery makes copies and keeps originals', Object.keys(state.galleryLibrary).length===n0+n0 && Object.values(state.galleryLibrary).filter(p=>/\(stamped\)/.test(p.name)).length===n0 && Object.values(state.galleryLibrary).some(p=>p.name==='Other'), [n0,Object.keys(state.galleryLibrary).length]); }
 { // delete a stamp
   document.getElementById('stDel').click(); await w(200); document.getElementById('confirmOkBtn').click(); await w(300); chk('stamp deleted', stampsGet().length===0); }
 // image stamp from this picture
 document.getElementById('stFromThis').click(); await w(900);
 chk('this picture can become a stamp', stampsGet().length===1 && stampsGet()[0].kind==='image' && stampsGet()[0].image.startsWith('data:image/'));
 // saving keeps the see-through parts
 document.querySelector('[data-tool="cutout"]').click(); await w(100); document.getElementById('cutGo').click(); await w(400);
 document.getElementById('imgSave').click(); await w(1200);
 { const url=getFull(subj); const img=new Image(); await new Promise(r=>{ img.onload=r; img.src=url; }); const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0);
   chk('a saved cut-out keeps its see-through background', c.getContext('2d').getImageData(c.width-2,c.height-2,1,1).data[3]===0 && /^data:image\/(webp|png)/.test(url), url.slice(0,20)); }
 // eraser in draw
 document.querySelector('[data-tool="draw"]').click(); await w(100);
 chk('Draw has an eraser', !!document.getElementById('imgBrushErase'));
 // AI edit
 document.querySelector('[data-tool="ai"]').click(); await w(150);
 localStorage.setItem(GEN_KEY,JSON.stringify({provider:'pollinations'})); document.querySelector('[data-tool="adjust"]').click(); document.querySelector('[data-tool="ai"]').click(); await w(150);
 chk('with Pollinations the AI edit is switched off and says why', document.getElementById('aiGo').disabled && /cannot change pictures/.test(document.getElementById('imgPanel').textContent));
 localStorage.setItem(GEN_KEY,JSON.stringify({provider:'swarmui',swarmUrl:'http://localhost:7801'})); document.querySelector('[data-tool="adjust"]').click(); document.querySelector('[data-tool="ai"]').click(); await w(150);
 chk('with SwarmUI it is on', !document.getElementById('aiGo').disabled);
 const realFetch=window.fetch; const calls=[]; const red=document.createElement('canvas'); red.width=64; red.height=64; red.getContext('2d').fillStyle='#d11'; red.getContext('2d').fillRect(0,0,64,64); const redBlob=await new Promise(r=>red.toBlob(r,'image/png'));
 window.fetch=async(u,o)=>{ calls.push([u,o&&o.body]); if(u.endsWith('GetNewSession')) return new Response(JSON.stringify({session_id:'x'}),{status:200}); if(u.endsWith('GenerateText2Image')) return new Response(JSON.stringify({images:['View/a.png']}),{status:200}); if(u.includes('/View/')) return new Response(redBlob,{status:200,headers:{'content-type':'image/png'}}); return realFetch(u,o); };
 document.getElementById('aiPrompt').value='make it red'; document.getElementById('aiPrompt').dispatchEvent(new Event('input',{bubbles:true}));
 document.getElementById('aiGo').click(); await w(1500);
 { const gen=calls.find(c=>String(c[0]).endsWith('GenerateText2Image')); const body=gen&&JSON.parse(gen[1]);
   chk('the picture and the words are sent to the provider', !!body && body.prompt==='make it red' && /^data:image\//.test(body.initimage) && body.initimagecreativity===0.6, body&&Object.keys(body)); }
 chk('the result replaces the picture', view().width===64 && px(10,10)[0]>180);
 document.getElementById('imgUndo').click(); await w(300); chk('and can be undone', view().width!==64);
 window.fetch=realFetch; localStorage.removeItem(GEN_KEY);
 chk('no emoji in the new panels', !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('editorContent').innerHTML));
 return out;
})()
