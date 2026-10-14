(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 // ── the record ──
 chk('shape is kept, clamped, and 0 means fit the content', normalizeCard({type:'note',text:'a',ar:2}).ar===2 && normalizeCard({type:'note',text:'a'}).ar===0 && normalizeCard({type:'note',text:'a',ar:99}).ar===6 && normalizeCard({type:'note',text:'a',ar:0.01}).ar===0.2 && normalizeCard({type:'note',text:'a',ar:'x'}).ar===0);
 chk('cleanAr', cleanAr(1.23456)===1.235 && cleanAr(-1)===0);
 homeSet({board:[
  {id:'a',type:'note',text:'alpha'},{id:'b',type:'note',text:'beta'},{id:'c',type:'note',text:'gamma'},{id:'d',type:'note',text:'delta'},{id:'e',type:'note',text:'epsilon'}]});
 navigateTo('home'); renderHomeView(); await w(400);
 const card=id=>document.querySelector('[data-card="'+id+'"]');
 const dispatch=(el,type,x,y,extra={})=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:5,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,...extra}));
 // ── resize both ways ──
 { const el=card('a'); el.scrollIntoView({block:'center'}); await w(200);
   const r=el.getBoundingClientRect(), grip=el.querySelector('[data-resize]'); const gr=grip.getBoundingClientRect(); const x=gr.left+gr.width/2, y=gr.top+gr.height/2;
   dispatch(grip,'pointerdown',x,y); dispatch(document,'pointermove',x+5,y+150); dispatch(document,'pointermove',x+10,y+240); dispatch(document,'pointerup',x+10,y+240); await w(300);
   const c=homeGet().board.find(b=>b.id==='a'); const r2=card('a').getBoundingClientRect();
   chk('dragging down makes a fixed, taller shape', c.ar>0 && c.ar<r.width/r.height && r2.height>r.height+100, [c.ar,r.height,r2.height]);
   chk('the shape is kept in the record and on the card', card('a').dataset.ar===String(c.ar) && card('a').classList.contains('hb-fixed'));
   chk('height follows the stored shape', Math.abs(r2.height - r2.width/c.ar) < 3, [r2.width,r2.height,c.ar]);
 }
 { const el=card('b'); const gr=el.querySelector('[data-resize]').getBoundingClientRect(); const x=gr.left+gr.width/2, y=gr.top+gr.height/2;
   const r=el.getBoundingClientRect();
   dispatch(el.querySelector('[data-resize]'),'pointerdown',x,y); dispatch(document,'pointermove',x+3,y+2); dispatch(document,'pointerup',x+3,y+2); await w(250);
   chk('a click on the grip does not turn on a fixed shape', homeGet().board.find(b=>b.id==='b').ar===0);
 }
 { const el=card('c'); const gr=el.querySelector('[data-resize]').getBoundingClientRect(); const x=gr.left+gr.width/2, y=gr.top+gr.height/2;
   dispatch(el.querySelector('[data-resize]'),'pointerdown',x,y); dispatch(document,'pointermove',x,y+120,{shiftKey:true}); dispatch(document,'pointerup',x,y+120,{shiftKey:true}); await w(250);
   chk('Shift while dragging makes it square', homeGet().board.find(b=>b.id==='c').ar===1, homeGet().board.find(b=>b.id==='c').ar);
   const rr=card('c').getBoundingClientRect(); chk('square on screen', Math.abs(rr.width-rr.height)<3, [rr.width,rr.height]);
 }
 // wide rectangle via the editor
 openCardEditor('d'); await w(200);
 chk('editor offers shapes', document.querySelectorAll('#hbShape option').length>=8);
 document.getElementById('hbShape').value='3.5'; document.getElementById('hbSize').value='3'; document.getElementById('hbSave').click(); await w(300);
 { const c=homeGet().board.find(b=>b.id==='d'); const rr=card('d').getBoundingClientRect();
   chk('long and thin from the editor', c.ar===3.5 && c.w===3 && rr.width/rr.height>3.2, [c.ar,c.w,rr.width,rr.height]); }
 openCardEditor('a'); await w(150);
 chk('a dragged shape shows as custom', document.getElementById('hbShape').value==='custom' || SHAPES.some(s=>Number(s[0])===homeGet().board[0].ar));
 document.getElementById('hbShape').value='0'; document.getElementById('hbSave').click(); await w(250);
 chk('back to fit the content', homeGet().board.find(b=>b.id==='a').ar===0 && !card('a').classList.contains('hb-fixed'));
 // ── drag anywhere ──
 const order=()=>homeGet().board.map(b=>b.id).join('');
 { const board=document.getElementById('homeBoard'); board.scrollIntoView({block:'center'}); await w(250);
   const src=card('a'), sr=src.getBoundingClientRect(); const targ=card('e'); const tr=targ.getBoundingClientRect();
   const before=order();
   dispatch(src,'pointerdown',sr.left+20,sr.top+20);
   dispatch(document,'pointermove',sr.left+40,sr.top+40);
   for(let i=0;i<4;i++){ const q=card('e').getBoundingClientRect(); dispatch(document,'pointermove',q.left+q.width*0.85,q.top+q.height*0.85); await w(60); }
   { const q=card('e').getBoundingClientRect(); dispatch(document,'pointerup',q.left+q.width*0.85,q.top+q.height*0.85); } await w(300);
   chk('dragging onto the last block moves it after it', order()!==before && order().endsWith('a'), [before,order()]);
 }
 { const board=document.getElementById('homeBoard'); const first=board.querySelector('.hb-card'); const src=card('e'); const sr=src.getBoundingClientRect(); const fr=first.getBoundingClientRect();
   dispatch(src,'pointerdown',sr.left+10,sr.top+10); dispatch(document,'pointermove',sr.left+30,sr.top+30); dispatch(document,'pointermove',fr.left+5,fr.top+5); dispatch(document,'pointermove',fr.left+4,fr.top+4);
   dispatch(document,'pointerup',fr.left+4,fr.top+4); await w(300);
   chk('dragging to the very top-left puts it first', order().startsWith('e'), order());
 }
 { // stacking: put a card under, then above, another card in a different column
   const colOf=id=>Number(card(id).dataset.col), top=id=>card(id).offsetTop;
   const cols=boardColumns(document.getElementById('homeBoard').clientWidth);
   chk('the board has several columns here', cols>=3, cols);
   const ids=[...document.querySelectorAll('#homeBoard .hb-card')].map(c=>c.dataset.card);
   const mover=ids[0]; let target=ids.find(id=>id!==mover && colOf(id)!==colOf(mover)); const others=ids.filter(id=>id!==mover);
   const colsBefore=Object.fromEntries(others.map(id=>[id,colOf(id)]));
   const drag=async(id,toCard,where)=>{ const src=card(id), sr=src.getBoundingClientRect(); const tr0=card(toCard).getBoundingClientRect();
     const offX=10, offY=10; dispatch(src,'pointerdown',sr.left+offX,sr.top+offY); dispatch(document,'pointermove',sr.left+offX+20,sr.top+offY+20);
     for(let i=0;i<3;i++){ const tr=card(toCard).getBoundingClientRect(); const x=tr.left+offX+2, y=where==='below'?tr.bottom-6:tr.top+4; dispatch(document,'pointermove',x,y); await w(60); }
     const tr=card(toCard).getBoundingClientRect(); const x=tr.left+offX+2, y=where==='below'?tr.bottom-6:tr.top+4; dispatch(document,'pointerup',x,y); await w(350); };
   await drag(mover,target,'below');
   chk('dropping low on a card stacks the dragged one directly under it, in that card\'s column', colOf(mover)===colOf(target) && top(mover)>top(target) && ids.filter(i=>colOf(i)===colOf(target)&&top(i)>top(target)&&top(i)<top(mover)).length===0, [colOf(mover),colOf(target),top(mover),top(target)]);
   chk('the other cards stayed in their columns', others.every(id=>colOf(id)===colsBefore[id]||id===target), others.map(id=>[colsBefore[id],colOf(id)]));
   const stored=homeGet(); chk('the column is saved with the card and the board', stored.board.find(b=>b.id===mover).c===colOf(mover) && stored.cols===cols, [stored.board.find(b=>b.id===mover).c,stored.cols]);
   let t2=ids.find(id=>id!==mover && colOf(id)!==colOf(mover)); const topBefore=top(t2);
   await drag(mover,t2,'above');
   chk('dropping high on a card puts it above that card', colOf(mover)===colOf(t2) && top(mover)<top(t2) && top(t2)>=topBefore, [colOf(mover),colOf(t2),top(mover),top(t2)]);
   renderHomeView(); await w(400);
   chk('the arrangement is the same after the page is drawn again', colOf(mover)===colOf(t2) && top(mover)<top(t2));
   chk('no card overlaps another', (()=>{ const rs=[...document.querySelectorAll('#homeBoard .hb-card')].map(c=>c.getBoundingClientRect()); for(let a=0;a<rs.length;a++)for(let b=a+1;b<rs.length;b++){ const A=rs[a],B=rs[b]; if(A.left<B.right-1&&B.left<A.right-1&&A.top<B.bottom-1&&B.top<A.bottom-1) return false; } return true; })());
 }
 { // fewer columns (a phone) ignores the saved columns and still lays out cleanly
   const b=document.getElementById('homeBoard'); const w0=b.style.width; b.style.width='380px'; layoutBoard(b); await w(400);
   const rs=[...b.querySelectorAll('.hb-card')].map(c=>c.getBoundingClientRect()); let overlap=false; for(let a=0;a<rs.length;a++)for(let c=a+1;c<rs.length;c++){ const A=rs[a],B=rs[c]; if(A.left<B.right-1&&B.left<A.right-1&&A.top<B.bottom-1&&B.top<A.bottom-1) overlap=true; }
   chk('a narrow board lays out without overlap', !overlap && boardColumns(380)===2); b.style.width=w0; layoutBoard(b); }
 chk('shapes survive a reload of the data', normalizeHome(JSON.parse(JSON.stringify(homeGet()))).board.find(b=>b.id==='d').ar===3.5);
 chk('no page scroll sideways', document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);
 return out;
})()
