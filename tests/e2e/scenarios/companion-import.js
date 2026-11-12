(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const comp={ name:'Compy', display_name:'Compy | Day 1', full_description:'# Public blurb', short_description:'one line',
   card:'Name: Compy\n\nPersonality:\n- Traits: calm', formatting_instructions:'*actions*', advanced_prompt:null, example_dialogue:null,
   tags:['a'], starting_scenarios:[{title:'One',message:'first hello'},{title:'Two',message:'second hello'}] };
 await handleDrop([new File([JSON.stringify(comp)],'companion.json')]); await w(600);
 const c=Object.values(charLibrary).find(x=>x.name==='Compy'); chk('imported', !!c);
 const d=c&&c.card.data;
 chk('definition becomes description', d&&d.description.startsWith('Name: Compy')&&d.description.includes('Traits: calm'), d&&d.description);
 chk('first greeting', d&&d.first_mes==='first hello', d&&d.first_mes);
 chk('alt greeting', d&&d.alternate_greetings.length===1&&d.alternate_greetings[0].message==='second hello'&&d.alternate_greetings[0].title==='Two');
 chk('full description goes to the notes, short description stays its own field', d&&d.creator_notes==='# Public blurb'&&d.extensions.saucepan.short_description==='one line', d&&[d.creator_notes,d.extensions.saucepan]);
 chk('formatting kept', d&&d.extensions.saucepan&&d.extensions.saucepan.formatting_instructions==='*actions*');
 chk('null example ok', d&&d.mes_example==='');
 chk('there is no SaucepanAI export (Saucepan will not restore one without tags and its own picture)', !document.querySelector('[id$="ExportCompanionBtn"]') && !/SaucepanAI/.test(document.querySelector('#dd-char-export .dd-menu')?.textContent||''));
 return out;
})()
