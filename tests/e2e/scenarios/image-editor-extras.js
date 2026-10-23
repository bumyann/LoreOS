(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 // free stamp placement is pure: a stamp with fx/fy lands there, the grid still works
 const free=stampPlacements(1000,500,100,50,{position:'br',fx:0.25,fy:0.5});
 chk('free spot used', free.length===1&&free[0].x===250&&free[0].y===250, free);
 const grid=stampPlacements(1000,500,100,50,{position:'tl',margin:0});
 chk('grid still works', grid[0].x===50&&grid[0].y===25, grid);
 chk('clamped inside the picture', stampPlacements(1000,500,100,50,{fx:5,fy:-3})[0].x===1000);
 chk('tile ignores free spot', stampPlacements(1000,500,100,50,{tile:true,fx:0.5,fy:0.5}).length>1);
 // the stamp keeps its spot
 const st=normalizeStamp({kind:'text',text:{text:'hi'},fx:0.3,fy:0.7}); chk('stamp stores spot', st.fx===0.3&&st.fy===0.7, st);
 chk('no spot by default', normalizeStamp({kind:'text',text:{text:'hi'}}).fx===null);
 // add pictures from inside the editor
 const mk=(n)=>{ const cv=document.createElement('canvas'); cv.width=80; cv.height=60; const x=cv.getContext('2d'); x.fillStyle='#c33'; x.fillRect(0,0,80,60); return new Promise(r=>cv.toBlob(b=>r(new File([b],n,{type:'image/png'}))));};
 const before=Object.keys(state.galleryLibrary).length;
 await addPicturesHere([await mk('one.png'),await mk('two.png')]); await w(900);
 chk('two pictures added', Object.keys(state.galleryLibrary).length===before+2, Object.keys(state.galleryLibrary).length);
 chk('opened in the editor', state.mode==='image'&&!!state.activeImageId&&!!document.getElementById('imgView'), state.mode);
 chk('sidebar has add button', !!document.querySelector('.img-add-btn'));
 chk('bar has add button', !!document.getElementById('imgAddPic'));
 return out;
})()
