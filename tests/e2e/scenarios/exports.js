(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 const c=document.createElement('canvas'); c.width=c.height=4; c.getContext('2d').fillRect(0,0,4,4);
 const png=new Uint8Array(await new Promise(r=>c.toBlob(b=>b.arrayBuffer().then(r))));
 const card={spec:'chara_card_v3',spec_version:'3.0',id:'cInternal',data:{name:'日本語 🦊',description:'é 你好 😀',alternate_greetings:[{title:'t',message:'hi'},'😀'],tags:[],extensions:{}}};
 const v3=toV3Card(card); o.v3={hasId:'id' in v3, group:v3.data.group_only_greetings, alts:v3.data.alternate_greetings};
 const out=embedCharInPng(png,toV2Card(card.data),v3);
 // both chunks present, ccv3 preferred
 const back=extractCharFromPng(out); o.pngSpec=back.spec; o.pngName=back.data.name;
 const v2only=extractCharFromPng(embedCharInPng(png,toV2Card(card.data))); o.v2Spec=v2only.spec;
 // does a decoder that only knows chara still work? strip ccv3 by reading chara via old path: ensure chara chunk valid json
 // ccv3-only
 const b=embedCharInPng(png,toV2Card(card.data),v3);
 // full export paths via UI functions
 let cap={};
 importCharCard(card,'x.json'); await w(400);
 exportCharJson(activeCharId); cap.json=(await dl()).text; const j=JSON.parse(cap.json); o.jsonExport={spec:j.spec,hasId:'id' in j,group:j.data.group_only_greetings,alts:j.data.alternate_greetings};
 // charx with webp avatar
 const cv=document.createElement('canvas'); cv.width=cv.height=8; cv.getContext('2d').fillRect(0,0,8,8);
 charLibrary[activeCharId].imageData=cv.toDataURL('image/webp');
 const origCreate=URL.createObjectURL; let blob; URL.createObjectURL=b=>{blob=b;return origCreate(b)};
 exportCharCharx(activeCharId); await w(800);
 const zip=await JSZip.loadAsync(blob); const img=await zip.file('assets/icon/image/main.png').async('uint8array');
 o.charxPng=[...img.slice(0,4)]; o.charxCard=JSON.parse(await zip.file('card.json').async('string')).spec;
 return o;
})()
