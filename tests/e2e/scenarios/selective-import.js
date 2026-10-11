(async()=>{
 const out={};
 createChar(); await new Promise(r=>setTimeout(r,100));
 const mine=activeCharId;
 const incoming={ cX:{id:'cX',name:'Imported One',card:{spec:'chara_card_v3',data:{name:'Imported One',tags:[],alternate_greetings:[],extensions:{}}},savedAt:new Date().toISOString()} };
 const bundle={_version:'1',_type:'char','aet_charLibrary':JSON.stringify(incoming)};
 const file=new File([JSON.stringify(bundle)],'x.json');
 document.getElementById('libModalTitle').textContent='Character Library';
 libImportSelective(file,'char',()=>{});
 await new Promise(r=>setTimeout(r,300));
 out.lsHasImported=!!JSON.parse(store.get('aet_charLibrary')).cX;
 out.memHasImported=!!charLibrary.cX;
 // now do any save
 saveCharLibrary();
 out.lsAfterNextSave=!!JSON.parse(store.get('aet_charLibrary')).cX;
 return out;
})()
