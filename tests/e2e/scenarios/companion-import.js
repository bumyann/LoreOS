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
 // export again: the same companion comes back, and what Saucepan still needs is listed
 const o0=URL.createObjectURL; let blob; URL.createObjectURL=b=>{blob=b;return o0(b)};
 exportCharCompanion(c.id||Object.keys(charLibrary).find(k=>charLibrary[k]===c)); await w(500); URL.createObjectURL=o0;
 const back=JSON.parse(await blob.text());
 chk('export keeps name, definition, blurbs and greetings', back.name==='Compy'&&back.display_name==='Compy | Day 1'&&back.card===comp.card&&back.full_description==='# Public blurb'&&back.short_description==='one line'&&back.starting_scenarios.length===2&&back.starting_scenarios[0].title==='One'&&back.starting_scenarios[1].message==='second hello', back);
 chk('export has a fresh id when the file had none', /^[0-9a-f-]{36}$/.test(back.id), back.id);
 const modal=document.getElementById('exportNotesModal');
 chk('the export notes open and mention the missing picture', modal&&modal.classList.contains('open')&&/picture/.test(document.getElementById('exportNotesList').textContent), modal&&document.getElementById('exportNotesList').textContent);
 closeModal('exportNotesModal');
 // the short description is editable in the SaucepanAI view
 openChar(Object.keys(charLibrary).find(k=>charLibrary[k]===c)); await w(400);
 const pick=document.getElementById('chFormatPicker'); pick.value='saucepan'; pick.dispatchEvent(new Event('change',{bubbles:true})); await w(400);
 const sd=document.getElementById('chShortDesc'); chk('short description box shows in the SaucepanAI view', !!sd&&sd.value==='one line'&&sd.closest('.fg').style.display!=='none');
 if(sd){ sd.value='edited line'; sd.dispatchEvent(new Event('input',{bubbles:true})); }
 saveChar(); await w(200);
 chk('editing it is saved', charLibrary[Object.keys(charLibrary).find(k=>charLibrary[k].name==='Compy')].card.data.extensions.saucepan.short_description==='edited line');
 return out;
})()
