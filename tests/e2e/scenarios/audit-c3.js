(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const toasts=()=>[...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent);
 createChar(); await w(200); const id=activeCharId;
 const set=(i,v)=>{ const e=document.getElementById(i); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); };
 set('chName','日本語 Test 🦊'); set('chDesc','desc ünï 你好'); set('chFirst','Hello {{user}}'); set('chTags','a, b ,c'); set('chCreator','me'); saveChar({silent:true});
 const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d'); x.fillStyle='#09f'; x.fillRect(0,0,64,64); charLibrary[id].imageData=cv.toDataURL('image/webp');
 // V3 and V2 PNG exports
 openCharPngExport(id,false); await w(1000); const v3=__dl.filter(d=>/\.png$/.test(d.name)).pop(); chk('v3 png downloaded', !!v3&&/_v3\.png$/.test(v3.name), v3&&v3.name);
 openCharPngExport(id,true); await w(1000); const v2=__dl.filter(d=>/\.png$/.test(d.name)).pop(); chk('v2 png downloaded', !!v2&&/_v2\.png$/.test(v2.name), v2&&v2.name);
 const bufOf=async d=>new Uint8Array(await d.blob.arrayBuffer());
 const b3=await bufOf(v3), b2=await bufOf(v2);
 chk('PNG signature ok', b3[0]===137&&b3[1]===80&&b2[0]===137);
 const c3=extractCharFromPng(b3), c2=extractCharFromPng(b2);
 chk('v3 png reads back as v3', c3.spec==='chara_card_v3'&&c3.data.name==='日本語 Test 🦊'&&c3.data.tags.join()==='a,b,c'&&c3.data.first_mes==='Hello {{user}}', c3&&c3.spec);
 chk('v2 png reads back as v2', c2.spec==='chara_card_v2'&&c2.data.description==='desc ünï 你好', c2&&c2.spec);
 // import PNG file through the file input
 const feed=async(bytes,name)=>{ const dt=new DataTransfer(); dt.items.add(new File([bytes],name,{type:'image/png'})); const el=document.getElementById('fileCharInput'); el.files=dt.files; el.dispatchEvent(new Event('change')); await w(900); };
 const before=Object.keys(charLibrary).length; await feed(b3,'card.png');
 chk('png import adds a character with the image', Object.keys(charLibrary).length===before+1&&!!charLibrary[activeCharId].imageData&&charLibrary[activeCharId].card.data.name==='日本語 Test 🦊', [Object.keys(charLibrary).length,before]);
 // a PNG with no card data
 const plain=new Uint8Array(await new Promise(r=>cv.toBlob(b=>b.arrayBuffer().then(r),'image/png')));
 await feed(plain,'plain.png'); chk('plain png reports no card data', toasts().some(t=>/No character data/i.test(t)), toasts());
 // truncated / corrupt png
 await feed(b3.slice(0,40),'broken.png'); chk('corrupt png does not crash', true);
 // not-json file as .json
 const dt=new DataTransfer(); dt.items.add(new File(['{not json'],'bad.json')); const el=document.getElementById('fileCharInput'); el.files=dt.files; el.dispatchEvent(new Event('change')); await w(300);
 chk('bad json reports error', toasts().some(t=>/Import error|Unexpected/i.test(t)), toasts());
 // flat v1 card & array-of-greetings variants
 importCharCard({name:'Flat V1',description:'d',first_mes:'hi',alternate_greetings:['x','y'],tags:'oops-a-string'},'v1.json'); await w(400);
 chk('v1 flat card imports (tags not array tolerated)', charLibrary[activeCharId].card.data.name==='Flat V1'&&Array.isArray(charLibrary[activeCharId].card.data.tags), charLibrary[activeCharId].card.data.tags);
 return out;
})()
