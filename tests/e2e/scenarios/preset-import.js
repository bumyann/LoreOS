(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 const before=Object.keys(presetLibrary).length;
 const dt=new DataTransfer(); dt.items.add(new File([JSON.stringify({foo:'bar'})],'notapreset.json'));
 const inp=document.getElementById('filePresetInput'); inp.files=dt.files; inp.dispatchEvent(new Event('change'));
 await w(400);
 o.importedGarbage = Object.keys(presetLibrary).length-before;
 // seed blank
 switchMode('preset'); createPreset(); await w(200);
 document.getElementById('psSeed').value='';
 savePreset({silent:true});
 const e=presetLibrary[activePresetId].preset; o.seed=e.seed; o.seedJson=JSON.stringify({seed:e.seed});
 return o;
})()
