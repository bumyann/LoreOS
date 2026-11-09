(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,240):'')); };
 const cv=document.createElement('canvas'); cv.width=cv.height=8; cv.getContext('2d').fillRect(0,0,8,8);
 const png=new Uint8Array(await new Promise(r=>cv.toBlob(b=>b.arrayBuffer().then(r))));
 const now='2024-03-21T12:00:00Z';
 const manifest={schemaVersion:1,createdAt:now,author:{name:'Someone'},characters:['characters/alice/character.json'],scenarios:['scenarios/s1.json','scenarios/s2.json']};
 const ch={schemaVersion:1,id:'alice',name:'ali',displayName:'Alice Smith',isNSFW:false,persona:'A curious character.',createdAt:now,updatedAt:now,loreItems:[{key:'home',value:'A small town.'}],images:[{path:'images/portrait.png',label:'P'}]};
 const sc=(o)=>({schemaVersion:1,formattingInstructions:'Be kind.',minP:0.1,minPEnabled:true,temperature:0.8,repeatPenalty:1.1,repeatLastN:64,topK:40,topP:0.9,exampleMessages:[{characterID:'alice',text:'Hi!'}],canDeleteExampleMessages:true,firstMessages:[{characterID:'alice',text:'Welcome.'}],narrative:'A cafe.',promptTemplate:null,grammar:null,messages:[],...o});
 const z=new JSZip(); z.file('manifest.json',JSON.stringify(manifest)); z.file('characters/alice/character.json',JSON.stringify(ch)); z.file('characters/alice/images/portrait.png',png);
 z.file('scenarios/s1.json',JSON.stringify(sc({title:'Cafe'}))); z.file('scenarios/s2.json',JSON.stringify(sc({title:'Roof',firstMessages:[{characterID:'alice',text:'Nice view.'}]})));
 const buf=await z.generateAsync({type:'uint8array'});
 // drop it on the page: the .byaf extension routes it to the Backyard import
 await handleDrop([new File([buf],'alice.byaf')]); await w(900);
 const e=Object.values(charLibrary).find(x=>x.name==='Alice Smith'); chk('imported by drop', !!e);
 const d=e&&e.card.data;
 chk('fields mapped', d&&d.description==='A curious character.'&&d.first_mes==='Welcome.'&&d.scenario==='A cafe.'&&d.alternate_greetings.length===1&&d.alternate_greetings[0].message==='Nice view.'&&d.character_book.entries[0].content==='A small town.', d);
 chk('picture imported', !!(e&&e.imageData&&/^data:image\/png/.test(e.imageData)));
 closeModal('exportNotesModal');
 // export it again
 const o=URL.createObjectURL; let blob; URL.createObjectURL=x=>{blob=x;return o(x)};
 exportCharByaf(Object.keys(charLibrary).find(k=>charLibrary[k]===e)); await w(1200); URL.createObjectURL=o;
 const back=await JSZip.loadAsync(blob); const names=Object.keys(back.files).filter(n=>!back.files[n].dir).sort();
 chk('archive has the spec layout', names.join()==='characters/alice/character.json,characters/alice/images/portrait.png,manifest.json,scenarios/scenario1.json,scenarios/scenario2.json', names);
 const m2=JSON.parse(await back.file('manifest.json').async('string')), c2=JSON.parse(await back.file('characters/alice/character.json').async('string')), s1=JSON.parse(await back.file('scenarios/scenario1.json').async('string'));
 chk('manifest points at the character and both scenarios', m2.schemaVersion===1&&m2.characters[0]==='characters/alice/character.json'&&m2.scenarios.length===2, m2);
 chk('character keeps its content', c2.displayName==='Alice Smith'&&c2.name==='ali'&&c2.persona==='A curious character.'&&c2.loreItems[0].key==='home'&&c2.images[0].path==='images/portrait.png', c2);
 chk('scenario keeps its settings', s1.temperature===0.8&&s1.formattingInstructions==='Be kind.'&&s1.firstMessages[0].text==='Welcome.'&&s1.title==='Cafe', s1);
 const modal=document.getElementById('exportNotesModal'); chk('the export notes open', modal&&modal.classList.contains('open'));
 closeModal('exportNotesModal');
 // an archive that tries to point outside itself is refused
 const bad=new JSZip(); bad.file('manifest.json',JSON.stringify({...manifest,characters:['characters/../character.json']})); bad.file('character.json','{}');
 let err=''; try{ await readByaf(await bad.generateAsync({type:'uint8array'})); }catch(x){ err=String(x.message); }
 chk('a path that leaves the archive is refused', /unexpected place/.test(err), err);
 let err2=''; try{ await readByaf(await new JSZip().generateAsync({type:'uint8array'})); }catch(x){ err2=String(x.message); }
 chk('a zip with no manifest gets a friendly error', /not a Backyard archive/.test(err2), err2);
 return out;
})()
