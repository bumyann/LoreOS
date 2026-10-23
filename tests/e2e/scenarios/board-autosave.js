(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 navigateTo('home'); await w(300);
 const n0=homeGet().board.length;
 openCardEditor(null,'note'); await w(100);
 type(document.getElementById('hbText'),'first thought'); await w(900);
 chk('a new card is kept without pressing Save', homeGet().board.length===n0+1 && homeGet().board[0].text==='first thought', homeGet().board.length);
 type(document.getElementById('hbText'),'first thought, edited'); await w(900);
 chk('edits update the same card, no duplicate', homeGet().board.length===n0+1 && homeGet().board[0].text==='first thought, edited');
 chk('delete shows once it exists', document.getElementById('hbDelete').style.display==='');
 type(document.getElementById('hbText'),'typed then closed fast');
 document.querySelector('#hbModal .modal-x').click(); await w(300);
 chk('closing right after typing keeps the text', homeGet().board[0].text==='typed then closed fast', homeGet().board[0].text);
 openCardEditor(null,'note'); await w(100); document.querySelector('#hbModal .modal-x').click(); await w(300);
 chk('an empty new card is not kept', homeGet().board.length===n0+1);
 return out;
})()
