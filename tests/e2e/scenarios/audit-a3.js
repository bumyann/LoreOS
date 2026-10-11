(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const feed=async(inputId,obj,name='f.json')=>{ const dt=new DataTransfer(); dt.items.add(new File([JSON.stringify(obj)],name)); const el=document.getElementById(inputId); el.files=dt.files; el.dispatchEvent(new Event('change')); await w(400); };
 const confirmOpen=()=>document.getElementById('confirmModal').classList.contains('open');
 // --- open lorebook with unsaved work => import asks first
 lorebook={name:'Mine',entries:rebuildEntries({0:{comment:'mine',content:'x',key:['k']}})}; nextUid=1; loreLinkToLib(null);
 const janitor=[{key:['a','b'],keysecondary:['c'],comment:'Ent1',content:'C1',insertion_order:5,enabled:false,probability:80},{key:'x, /y,z/i',comment:'Ent2',content:'C2',enabled:true,constant:true}];

 chk('janitor file input exists',!!document.getElementById('fileJanitorInput'));
 // paste path
 document.getElementById('janitorPasteTA')&&openJanitorPasteModal(); const ta=document.getElementById('janitorPasteTA'); ta.value=JSON.stringify(janitor);
 handleJanitorPaste(); await w(150);
 chk('asks before replacing unsaved lorebook', confirmOpen()); if(confirmOpen()){ document.getElementById('confirmCancelBtn').click(); await w(100); }
 chk('cancel keeps current lorebook', lorebook.name==='Mine'&&Object.keys(lorebook.entries).length===1);
 handleJanitorPaste(); await w(150); if(confirmOpen()){ document.getElementById('confirmOkBtn').click(); await w(300); }
 const ents=Object.values(lorebook.entries);
 chk('janitor imported 2', ents.length===2, ents.length);
 chk('enabled:false -> disable:true', ents[0].disable===true && ents[1].disable===false, ents.map(e=>e.disable));
 chk('regex key with comma kept', JSON.stringify(ents[1].key)===JSON.stringify(['x','/y,z/i']), ents[1].key);
 chk('entries normalized (characterFilter, triggers)', ents.every(e=>e.characterFilter&&Array.isArray(e.triggers)));
 chk('persisted to storage', JSON.parse(store.get('aet_lorebook')).entries[0]?.comment==='Ent1');
 // export janitor: enabled mirrors disable (toggle in editor)
 lorebook.entries[1].disable=true;
 exportJanitorJson(); const jx=JSON.parse((await dl()).text);
 chk('janitor export enabled = !disable', jx[0].enabled===false&&jx[1].enabled===false, jx.map(e=>e.enabled));
 chk('janitor export keysecondaryRaw string', typeof jx[0].keysecondaryRaw==='string', jx[0].keysecondaryRaw);
 chk('janitor order kept', jx[0].insertion_order===5);
 // ST export -> import round trip equality
 exportJson(); const st=JSON.parse((await dl()).text);
 chk('ST export has entries keyed by uid', Object.entries(st.entries).every(([k,e])=>String(e.uid)===k));
 // saucepan round trip
 exportSaucepanJson(); const sp=JSON.parse((await dl()).text);
 chk('saucepan content', sp.content.length===2&&sp.content[0].title==='Ent1'&&sp.content[1].text==='C2');
 loreLinkToLib(null); await feed('fileSaucepanInput',sp,'sp.json'); chk('saucepan asks (unsaved)', confirmOpen()); if(confirmOpen()){ document.getElementById('confirmOkBtn').click(); await w(300); }
 chk('saucepan imported', Object.keys(lorebook.entries).length===2&&lorebook.entries[0].comment==='Ent1'&&lorebook.saucepanMeta, Object.keys(lorebook.entries));
 chk('saucepan entries normalized', lorebook.entries[0].characterFilter&&lorebook.entries[0].disable===false);
 // library-linked lorebook: no prompt
 const lib={}; lib.L={name:'L',lb:JSON.parse(JSON.stringify(lorebook)),savedAt:new Date().toISOString()}; store.set('aet_library',JSON.stringify(lib)); loreLinkToLib('L');
 await feed('fileInput',{name:'ST',entries:{0:{uid:0,key:['q'],comment:'qq',content:'z'}}},'st.json'); chk('linked lorebook replaced without prompt', !confirmOpen()&&lorebook.name==='ST'&&lorebook.entries[0].comment==='qq', [confirmOpen(),lorebook.name]);
 chk('import unlinked from library', loreActiveLibName()===null);
 // text export honours titles option & order 0
 lorebook={name:'T',entries:rebuildEntries({0:{comment:'zero',content:'C0',key:['k'],order:0},1:{comment:'ten',content:'C1',key:['k'],order:10}})};
 document.getElementById('etTitles').checked=false; doExportTxt(); let txt=(await dl()).text;
 chk('titles off hides names', !/zero|ten/.test(txt.split('\n').filter(l=>l.startsWith('##')).join('\n')), txt.split('\n').filter(l=>l.startsWith('##')));
 document.getElementById('etTitles').checked=true; doExportTxt(); txt=(await dl()).text;
 chk('order 0 sorts first', txt.indexOf('zero')<txt.indexOf('ten'));
 return out;
})()
