(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 charLibrary.j1={id:'j1',name:'Jan',card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:'Jan',description:'DEFINITION TEXT',personality:'calm',creator_notes:'public blurb',first_mes:'hi',alternate_greetings:[{title:'t',message:'yo'}],tags:['a'],extensions:{}}},imageData:null,savedAt:new Date().toISOString()};
 switchMode('char'); openChar('j1'); await w(300);
 exportCharJsonV2('j1',{janitor:true}); const j=JSON.parse((await dl()).text);
 chk('spec v2', j.spec==='chara_card_v2');
 chk('definition moved into personality', /DEFINITION TEXT/.test(j.data.personality) && /calm/.test(j.data.personality), j.data.personality);
 chk('description (bio) is the public notes', j.data.description==='public blurb', j.data.description);
 chk('greetings flattened', j.data.alternate_greetings[0]==='yo');
 exportCharJsonV2('j1'); const n=JSON.parse((await dl()).text);
 chk('normal V2 export unchanged', n.data.description==='DEFINITION TEXT' && n.data.personality==='calm');
 chk('stored card untouched', charLibrary.j1.card.data.description==='DEFINITION TEXT');
 chk('no companion export left', !document.getElementById('charHdrExportSaucepanBtn') && !document.getElementById('chExportSaucepanBtn') && !('exportCharSaucepan' in window.LoreOS));
 out.ok=true; return out;
})()
