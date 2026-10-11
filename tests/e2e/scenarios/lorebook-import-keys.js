(async()=>{
 const o={fail:[]}; const w=ms=>new Promise(r=>setTimeout(r,ms)); const chk=(n,c,d)=>{ if(!c) o.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const E=(c,extra={})=>({comment:c,content:c+' body',key:['k'+c],...extra});
 const names=r=>Object.entries(r).map(([k,e])=>k+':'+e.comment+':'+e.uid);
 // 1 clean numeric keys keep their slots (incl. gaps)
 let r=rebuildEntries({"0":E('a'),"5":E('b'),"2":E('c')}); o.numeric=names(r); chk('numeric keys kept',r[0].comment==='a'&&r[5].comment==='b'&&r[2].comment==='c');
 // 2 uuid/string keys are kept, not dropped
 r=rebuildEntries({"a1b2-uuid":E('u1'),"zz":E('u2'),"3":E('n3')}); o.uuid=names(r); chk('uuid kept',Object.keys(r).length===3&&r[3].comment==='n3'); chk('uuid slots unique',new Set(Object.values(r).map(e=>e.uid)).size===3);
 chk('keys == uid',Object.entries(r).every(([k,e])=>String(e.uid)===k));
 chk('report',rebuildEntries.lastReport.renumbered===2 && rebuildEntries.lastReport.skipped===0, rebuildEntries.lastReport);
 // 3 null / primitive entries skipped, no throw
 r=rebuildEntries({"0":null,"1":E('ok'),"2":7,"3":"str","4":[1]}); o.nulls=names(r); chk('only real entry kept',Object.keys(r).length===1&&r[1].comment==='ok'); chk('skipped count',rebuildEntries.lastReport.skipped===4,rebuildEntries.lastReport);
 // 4 arrays
 r=rebuildEntries([E('x'),E('y'),E('z')]); chk('array',names(r).join()==='0:x:0,1:y:1,2:z:2',names(r));
 // 5 duplicate / negative / float / huge / whitespace keys
 r=rebuildEntries({"1":E('d1'),"01":E('d2'),"-1":E('neg'),"2.5":E('flt'),"99999999999":E('huge'),"7 ":E('sp')}); o.odd=names(r);
 chk('no loss',Object.keys(r).length===6); chk('uids valid',Object.values(r).every(e=>Number.isInteger(e.uid)&&e.uid>=0));
 chk('"1" wins slot 1',r[1].comment==='d1');
 // 6 keys as comma string, keysecondary missing
 r=rebuildEntries({"0":{comment:'s',key:'alpha, beta ,gamma',keysecondary:'x,y'}}); chk('string keys',JSON.stringify(r[0].key)==='["alpha","beta","gamma"]'&&JSON.stringify(r[0].keysecondary)==='["x","y"]',r[0]);
 r=rebuildEntries({"0":{comment:'s',keys:['p','q']}}); chk('keys alias',JSON.stringify(r[0].key)==='["p","q"]');
 // 7 garbage input
 chk('null raw',JSON.stringify(rebuildEntries(null))==='{}'); chk('string raw',JSON.stringify(rebuildEntries('x'))==='{}'); chk('empty',JSON.stringify(rebuildEntries({}))==='{}');
 // 8 full import path: file with uuid keys and a null, then toasts + editor works
 const file=new File([JSON.stringify({name:'UUID Book',entries:{"aaa-111":E('first'),"bbb-222":E('second'),"9":null,"4":E('four')}})],'uuid.json');
 const dt=new DataTransfer(); dt.items.add(file); const inp=document.getElementById('fileInput'); inp.files=dt.files; inp.dispatchEvent(new Event('change')); await w(500);
 o.imported=Object.values(lorebook.entries).map(e=>e.uid+':'+e.comment); chk('import kept 3',Object.keys(lorebook.entries).length===3,o.imported);
 chk('nextUid ok',nextUid===Math.max(...Object.keys(lorebook.entries).map(Number))+1);
 o.toasts=[...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent);
 chk('warned',o.toasts.some(t=>/renumbered/.test(t))&&o.toasts.some(t=>/skipped/.test(t)),o.toasts);
 chk('no helper field leaked into lorebook',!('_rebuildReport' in lorebook));
 openInTab(Object.values(lorebook.entries)[0].uid); await w(200); chk('editor opens',!!document.querySelector('.entry-editor'));
 // export round trip
 exportJson(); const ex=JSON.parse((await dl()).text); chk('export entries',Object.keys(ex.entries).length===3&&Object.entries(ex.entries).every(([k,e])=>String(e.uid)===k)); chk('export clean',!('_rebuildReport' in ex));
 // 9 bad entries type
 const f2=new File([JSON.stringify({name:'bad',entries:"nope"})],'bad.json'); const dt2=new DataTransfer(); dt2.items.add(f2); inp.files=dt2.files; const before=Object.keys(lorebook.entries).length; inp.dispatchEvent(new Event('change')); await w(400);
 chk('bad entries rejected, book untouched',Object.keys(lorebook.entries).length===before&&lorebook.name==='UUID Book');
 return o;
})()
