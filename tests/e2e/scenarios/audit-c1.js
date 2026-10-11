(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:'Rin',description:'D',personality:'P',scenario:'S',first_mes:'Hi',mes_example:'<START>',creator_notes:'CN',system_prompt:'SP',post_history_instructions:'PHI',alternate_greetings:['A1','A2'],tags:['x','y'],creator:'me',character_version:'1.2',
   extensions:{talkativeness:'0.7',fav:true,world:'W',depth_prompt:{prompt:'dp',depth:4,role:'system'},custom_thing:{a:[1,2]}},group_only_greetings:['G1'],nickname:'Rinny',creation_date:123,modification_date:456,assets:[{type:'icon',uri:'ccdefault:',name:'main',ext:'png'}],source:['s1'],creator_notes_multilingual:{en:'hello'},
   character_book:{name:'bk',entries:[{keys:['k'],content:'c',extensions:{},enabled:true,insertion_order:1,id:1}]}}};
 importCharCard(JSON.parse(JSON.stringify(card)),'rin.json'); await w(500); const id=activeCharId;
 // type a title into greeting 1 and save
 const titleInputs=[...document.querySelectorAll('#chAltGreetList input.finput')]; chk('greeting title inputs rendered', titleInputs.length===2, titleInputs.length);
 titleInputs[0].value='Warm welcome'; titleInputs[0].dispatchEvent(new Event('input',{bubbles:true}));
 saveChar({silent:true}); await w(100);
 const stored=charLibrary[id].card.data;
 chk('title persisted after save', JSON.stringify(stored.alternate_greetings).includes('Warm welcome'), stored.alternate_greetings);
 chk('messages intact', stored.alternate_greetings.map(g=>typeof g==='object'?g.message:g).join()==='A1,A2');
 // reopen editor
 openChar(id); await w(200); chk('title still shown after reopen', document.querySelector('#chAltGreetList input.finput')?.value==='Warm welcome', document.querySelector('#chAltGreetList input.finput')?.value);
 // unknown fields preserved through save
 for(const k of ['group_only_greetings','nickname','creation_date','modification_date','assets','source','creator_notes_multilingual','character_book']) chk('keeps data.'+k, JSON.stringify(stored[k])===JSON.stringify(card.data[k])||k==='character_book', [k,stored[k]]);
 chk('keeps extensions', JSON.stringify(stored.extensions.depth_prompt)===JSON.stringify(card.data.extensions.depth_prompt)&&stored.extensions.custom_thing.a.length===2&&stored.extensions.talkativeness==='0.7'&&stored.extensions.fav===true, stored.extensions);
 // exports flatten to strings and keep everything
 exportCharJson(id); const j=JSON.parse((await dl()).text);
 chk('ST json: greetings are plain strings', j.data.alternate_greetings.every(x=>typeof x==='string')&&j.data.alternate_greetings.join()==='A1,A2', j.data.alternate_greetings);
 chk('ST json keeps unknown fields', j.data.nickname==='Rinny'&&j.data.assets.length===1&&j.data.creator_notes_multilingual.en==='hello'&&j.data.extensions.custom_thing.a.length===2);
 chk('V3 fields', j.spec==='chara_card_v3'&&Array.isArray(j.data.group_only_greetings)&&j.data.group_only_greetings[0]==='G1');
 exportCharJsonV2(id); const j2=JSON.parse((await dl()).text);
 chk('V2 json clean', j2.spec==='chara_card_v2'&&j2.spec_version==='2.0'&&j2.data.alternate_greetings.join()==='A1,A2'&&!('group_only_greetings' in j2.data)&&!('nickname' in j2.data), Object.keys(j2.data));
 chk('V2 keeps extensions + character_book', j2.data.extensions.depth_prompt.depth===4&&!!j2.data.character_book);
 exportCharSaucepan(id); const sp=JSON.parse((await dl()).text); chk('saucepan export has titles', JSON.stringify(sp.starting_scenarios||[]).includes('Warm welcome'), sp.starting_scenarios);
 // re-import exported V3 json -> same name/desc
 importCharCard(j,'again.json'); await w(400); const again=charLibrary[activeCharId].card.data; chk('re-import round trip', again.name==='Rin'&&again.description==='D'&&again.first_mes==='Hi'&&again.tags.join()==='x,y', again.name);
 return out;
})()
