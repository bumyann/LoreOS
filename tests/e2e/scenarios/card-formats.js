(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 // tiny png
 const c=document.createElement('canvas'); c.width=c.height=4; c.getContext('2d').fillRect(0,0,4,4);
 const png=new Uint8Array(await new Promise(r=>c.toBlob(b=>b.arrayBuffer().then(r))));
 const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:'日本語 🦊 Test',description:'é ü 你好 😀',alternate_greetings:['hi','😀'],tags:[],extensions:{}}};
 // round trip via chara
 const out=embedCharInPng(png,card); const back=extractCharFromPng(out);
 o.charaRoundTrip = back && back.data.name==='日本語 🦊 Test' && back.data.description==='é ü 你好 😀';
 // ccv3-only png (as written by ST / Chub for V3)
 const json=JSON.stringify(card); const b64=btoa(unescape(encodeURIComponent(json)));
 const kw='ccv3\0'+b64; const body=[...('tEXt'+kw)].map(ch=>ch.charCodeAt(0));
 const crc=crc32(new Uint8Array(body)); const len=kw.length;
 const chunk=new Uint8Array([...u32be(len),...body,...u32be(crc)]);
 const ihdrLen=13, at=8+8+ihdrLen+4;
 const stripped=stripExistingCharaChunks(png);
 const pngCcv3=new Uint8Array([...stripped.subarray(0,at),...chunk,...stripped.subarray(at)]);
 o.ccv3OnlyImport = extractCharFromPng(pngCcv3);
 // V3 required fields in a created+saved card
 createChar(); await w(100); saveChar({silent:true});
 const d=charLibrary[activeCharId].card.data; o.v3HasGroupOnly='group_only_greetings' in d; o.spec=charLibrary[activeCharId].card.spec;
 // V2 card import then save -> spec
 importCharCard({spec:'chara_card_v2',spec_version:'2.0',data:{name:'v2card',description:'x'}},'v2.json'); await w(400);
 const before=charLibrary[activeCharId].card.spec; saveChar({silent:true}); o.v2Before=before; o.v2AfterSave=charLibrary[activeCharId].card.spec;
 return o;
})()
