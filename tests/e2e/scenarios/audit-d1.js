(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const F=(name,obj)=>new File([typeof obj==='string'?obj:JSON.stringify(obj)],name);
 const cls=async f=>(await classifyDrop(f))?.input||null;
 chk('png => char', await cls(new File([new Uint8Array([137,80,78,71])],'a.png'))==='fileCharInput');
 chk('charx', await cls(new File([new Uint8Array([1])],'a.charx'))==='fileCharxInput');
 chk('v3 card', await cls(F('c.json',{spec:'chara_card_v3',data:{name:'x'}}))==='fileCharInput');
 chk('v2 card', await cls(F('c.json',{spec:'chara_card_v2',data:{name:'x'}}))==='fileCharInput');
 chk('companion', await cls(F('c.json',{name:'x',persona:'p',starting_scenarios:[]}))==='fileCharCompanionInput');
 chk('ST lorebook', await cls(F('l.json',{entries:{}}))==='fileInput');
 chk('janitor lorebook (array)', await cls(F('l.json',[{name:'a'}]))==='fileJanitorInput');
 chk('saucepan lorebook', await cls(F('l.json',{content:[{title:'a',text:'b'}]}))==='fileSaucepanInput');
 chk('preset', await cls(F('p.json',{prompts:[],temperature:1}))==='filePresetInput');
 chk('backup', await cls(F('b.json',{_version:'1'}))==='syncImportFile');
 chk('garbage rejected', (await cls(F('g.json','{nope')))===null && (await cls(F('x.txt','hi')))===null && (await cls(F('o.json',{random:1})))===null);
 // end to end: a V3 card dropped on the page lands in the character library
 const before=Object.keys(charLibrary).length;
 await handleDrop([F('Dropped.json',{spec:'chara_card_v3',spec_version:'3.0',data:{name:'DropChar',description:'d',first_mes:'hi',tags:[],extensions:{}}})]); await w(600);
 chk('card imported by drop', Object.values(charLibrary).some(c=>c.name==='DropChar')||Object.keys(charLibrary).length>before, Object.keys(charLibrary).length);
 chk('switched to character editor', state.mode==='char', state.mode);
 // a preset
 await handleDrop([F('Pre.json',{name:'DropPreset',temperature:0.8,openai_max_context:8000,prompts:[],prompt_order:[]})]); await w(600);
 chk('preset imported by drop', Object.values(presetLibrary).some(p=>(p.name||'').includes('DropPreset')||p.preset?.name==='DropPreset'), Object.keys(presetLibrary));
 // an ST lorebook
 await handleDrop([F('Lore.json',{name:'DropBook',entries:{0:{uid:0,comment:'e1',key:['k'],content:'c'}}})]); await w(600);
 chk('lorebook imported by drop', Object.keys(lorebook.entries).length===1, Object.keys(lorebook.entries));
 out.ok=true; return out;
})()
