(async()=>{
 const o={fail:[]}; const w=ms=>new Promise(r=>setTimeout(r,ms)); const chk=(n,c,d)=>{ if(!c) o.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 ['Zed','Alpha','Mira'].forEach((n,i)=>{ const id='cc'+i; charLibrary[id]={id,name:n,card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:n,description:'',tags:i?['tag'+i]:[],alternate_greetings:[],extensions:{}}},imageData:null,savedAt:new Date().toISOString()}; });
 ['Preset B','Preset A'].forEach((n,i)=>{ const id='pp'+i; presetLibrary[id]={id,name:n,preset:{...blankPreset(),name:n},savedAt:new Date(Date.now()+i).toISOString()}; });
 navigateTo('editor'); switchMode('char'); await w(200);
 chk('title',document.getElementById('sbTitle').textContent==='Characters'); chk('sorted',[...document.querySelectorAll('#entryList .ei-name')].map(e=>e.textContent).join()==='Alpha,Mira,Zed');
 document.querySelectorAll('#entryList .ei')[1].click(); await w(250); chk('opens in tab',wsItems.some(t=>t.itemId==='cc2')&&activeCharId==='cc2'&&document.getElementById('chName').value==='Mira');
 switchMode('preset'); await w(150); chk('preset list',[...document.querySelectorAll('#entryList .ei-name')].map(e=>e.textContent).join()==='Preset A,Preset B');
 document.querySelectorAll('#entryList .ei')[0].click(); await w(250); chk('preset opens',activePresetId==='pp1'&&document.getElementById('psName').value==='Preset A');
 switchMode('lore'); await w(100); chk('lore title',document.getElementById('sbTitle').textContent==='Entries'&&document.getElementById('sbSearch').value==='');
 return o;
})()
