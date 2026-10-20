(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const c=document.createElement('canvas'); c.width=c.height=4; c.getContext('2d').fillRect(0,0,4,4);
 const png=new Uint8Array(await new Promise(r=>c.toBlob(b=>b.arrayBuffer().then(r))));
 // a charx the way other tools make them: icon elsewhere, sprites, alternate avatar, modules, lorebook, regex
 const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:'Mira',description:'d',first_mes:'hi',alternate_greetings:['a','b'],tags:[],
  assets:[{type:'icon',uri:'embeded://assets/icon/main.png',name:'main',ext:'png'},{type:'emotion',uri:'embeded://assets/emotion/happy.png',name:'happy',ext:'png'},{type:'x-risu-asset',uri:'embeded://assets/other/stack.json',name:'stack',ext:'json'}],
  character_book:{name:'bk',entries:[{keys:['k'],content:'c',enabled:true,insertion_order:1,extensions:{}}],extensions:{}},
  extensions:{regex_scripts:[{id:'1',scriptName:'r',findRegex:'/a/g',replaceString:'b',placement:[2]}]}}};
 const z=new JSZip();
 z.file('card.json',JSON.stringify(card)); z.file('assets/icon/main.png',png); z.file('assets/emotion/happy.png',png);
 z.file('assets/other/stack.json','{"layers":[1,2]}');
 z.file('lumiverse_modules.json',JSON.stringify({version:1,alternate_fields:{description:[{id:'v1',label:'x',value:'y'}]},alternate_avatars:[{id:'av1',label:'smile',file:'assets/alt/smile.png'}],expressions:{neutral:'assets/emotion/happy.png'}}));
 z.file('assets/alt/smile.png',png);
 const buf=await z.generateAsync({type:'arraybuffer'});
 const res=await readCharx(buf);
 chk('icon found through the card asset list', !!res.imageData && res.iconPath==='assets/icon/main.png', res.iconPath);
 chk('other files kept', res.charxFiles.map(f=>f.path).sort().join()==='assets/alt/smile.png,assets/emotion/happy.png,assets/other/stack.json', res.charxFiles.map(f=>f.path));
 chk('modules kept whole', res.lumiModules && res.lumiModules.alternate_avatars && res.lumiModules.expressions);
 const d=describeCharx(res).join(' | ');
 chk('summary mentions sprite, lorebook, regex, modules', /1 expression sprite/.test(d)&&/lorebook \(1 entries\)/.test(d)&&/1 regex script/.test(d)&&/Lumiverse modules/.test(d), d);
 importCharCard(res.cardData,'m.charx',res.imageData,{charxFiles:res.charxFiles,lumiModules:res.lumiModules}); await w(500);
 const e=charLibrary[activeCharId];
 chk('entry stores extras', e.charxFiles.length===3 && !!e.lumiModules);
 const origCreate=URL.createObjectURL; let blob; URL.createObjectURL=b=>{blob=b;return origCreate(b)};
 exportCharCharx(activeCharId); await w(900);
 const back=await JSZip.loadAsync(blob);
 const names=Object.keys(back.files).filter(n=>!back.files[n].dir).sort();
 chk('export has everything', ['assets/alt/smile.png','assets/emotion/happy.png','assets/icon/image/main.png','assets/other/stack.json','card.json','lumiverse_modules.json'].every(n=>names.includes(n)), names);
 const oc=JSON.parse(await back.file('card.json').async('string'));
 chk('icon entry points at the real file', oc.data.assets.find(a=>a.type==='icon').uri==='embeded://assets/icon/image/main.png' && oc.data.assets.filter(a=>a.type==='icon').length===1, oc.data.assets);
 chk('sprite entries kept', oc.data.assets.some(a=>a.type==='emotion'));
 chk('lorebook and regex kept in card', oc.data.character_book.entries.length===1 && oc.data.extensions.regex_scripts.length===1);
 const om=JSON.parse(await back.file('lumiverse_modules.json').async('string'));
 chk('modules round trip', om.alternate_avatars[0].id==='av1' && om.expressions.neutral && om.alternate_fields.description[0].id==='v1', om);
 // round trip again
 const res2=await readCharx(await back.generateAsync({type:'arraybuffer'}));
 chk('second round has same files', res2.charxFiles.length===3);
 // plain card with no extras still exports
 importCharCard({spec:'chara_card_v2',data:{name:'Plain'}},'p.json'); await w(400);
 exportCharCharx(activeCharId); await w(600);
 const plain=await JSZip.loadAsync(blob); chk('plain card has no modules file', !plain.file('lumiverse_modules.json'));
 return out;
})()
