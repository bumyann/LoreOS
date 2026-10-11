// Large-data store (IndexedDB behind an in-memory copy): migration, persistence, fallback, size, two tabs, restore.
// Usage: node tests/e2e/kv.js   (same setup as run.js)
const { chromium } = require('playwright'); const { init: HINIT } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'); const root=path.resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream'}); s.end(d);});}).listen(0);
const fail=[]; const chk=(n,c,d)=>{ if(!c) fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,200):'')); else console.log('ok   '+n); };
const w=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const url=`http://localhost:${srv.address().port}/`;
 const newCtx=async(init)=>{ const ctx=await b.newContext({viewport:{width:1280,height:900}}); const pg=await ctx.newPage(); await pg.addInitScript(HINIT); if(init) await pg.addInitScript(init); await pg.route(/accounts\.google|fonts\./,r=>r.abort()); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); return {ctx,pg,errs}; };
 const L=(pg,code)=>pg.evaluate(`(async()=>{ const L=window.LoreOS; with(L){ return (${code}); } })()`);
 const idbRaw=(pg,key)=>pg.evaluate(k=>new Promise(res=>{ const r=indexedDB.open('loreos'); r.onsuccess=()=>{ const t=r.result.transaction('kv','readonly').objectStore('kv').get(k); t.onsuccess=()=>res(t.result===undefined?null:t.result); t.onerror=()=>res('ERR'); }; r.onerror=()=>res('ERR'); }),key);

 // 1. migration of data written by the old (localStorage-only) version
 {
  const lib=JSON.stringify({Old:{name:'Old',lb:{name:'Old',entries:{0:{uid:0,comment:'legacy',key:[],content:'x'}}},savedAt:'x'}});
  const chars=JSON.stringify({c1:{id:'c1',name:'Legacy Char',card:{data:{name:'Legacy Char'}},savedAt:'x'}});
  const {pg,errs}=await newCtx(`if(!localStorage.getItem('__seeded')){ localStorage.setItem('aet_library',${JSON.stringify(lib)}); localStorage.setItem('aet_charLibrary',${JSON.stringify(chars)}); localStorage.setItem('aet_theme','dark'); localStorage.setItem('__seeded','1'); }`);
  await pg.goto(url); await pg.waitForTimeout(1200);
  chk('mode is idb', (await L(pg,'kvMode()'))==='idb');
  chk('legacy data readable through the store', (await L(pg,"JSON.parse(store.get('aet_charLibrary')).c1.name"))==='Legacy Char');
  chk('legacy library shows in the app', (await L(pg,"Object.keys(libGet()).join()"))==='Old');
  chk('copied into IndexedDB', (await idbRaw(pg,'aet_charLibrary'))===chars);
  chk('removed from localStorage after the copy was confirmed', await pg.evaluate(()=>localStorage.getItem('aet_charLibrary')===null && localStorage.getItem('aet_library')===null));
  chk('small keys stay in localStorage', await pg.evaluate(()=>localStorage.getItem('aet_theme')==='dark'));
  chk('no page errors', errs.length===0, errs);
  await pg.context().close();
 }
 // 2. normal use persists across reloads; nothing big in localStorage; and it is bigger than 5 MB
 {
  const {pg,errs}=await newCtx(); await pg.goto(url); await pg.waitForTimeout(800);
  await L(pg,`(()=>{ charLibrary.big={id:'big',name:'Huge',card:{data:{name:'Huge',description:'x'.repeat(9000000)}},savedAt:'x'}; return saveCharLibrary(); })()`);
  await L(pg,'kvFlush()');
  await pg.reload(); await pg.waitForTimeout(1500);
  chk('9 MB character survives a reload (over the 5 MB localStorage cap)', (await L(pg,"(JSON.parse(store.get('aet_charLibrary')).big||{card:{data:{description:''}}}).card.data.description.length"))===9000000);
  chk('and the app loaded it', (await L(pg,"charLibrary.big ? charLibrary.big.name : null"))==='Huge');
  chk('localStorage stayed small', await pg.evaluate(()=>{ let n=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); n+=k.length+localStorage.getItem(k).length; } return n<200000; }));
  const usage=await L(pg,'storageUsage()'); chk('storage panel counts it as large-store data', usage.bigTotal>9000000 && usage.total<200000, {big:usage.bigTotal,small:usage.total});
  chk('no page errors', errs.length===0, errs);
  await pg.context().close();
 }
 // 3. IndexedDB unavailable: everything keeps working on localStorage
 {
  const {pg,errs}=await newCtx(`Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});`);
  await pg.goto(url); await pg.waitForTimeout(900);
  chk('fallback mode is ls', (await L(pg,'kvMode()'))==='ls');
  await L(pg,`(()=>{ charLibrary.f1={id:'f1',name:'Fallback',card:{data:{name:'Fallback'}},savedAt:'x'}; return saveCharLibrary(); })()`);
  chk('written to localStorage', await pg.evaluate(()=>/Fallback/.test(localStorage.getItem('aet_charLibrary')||'')));
  await pg.reload(); await pg.waitForTimeout(900);
  chk('persists across reload in fallback mode', (await L(pg,"charLibrary.f1 ? charLibrary.f1.name : null"))==='Fallback');
  chk('no page errors', errs.length===0, errs);
  await pg.context().close();
 }
 // 4. two tabs: a save in one is seen by the other (so the second does not overwrite it with stale data)
 {
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const mk=async()=>{ const pg=await ctx.newPage(); await pg.addInitScript(HINIT); await pg.route(/accounts\.google|fonts\./,r=>r.abort()); await pg.goto(url); await pg.waitForTimeout(900); return pg; };
  const A=await mk(), B=await mk();
  await L(A,`(()=>{ libSet({FromA:{name:'FromA',lb:{name:'FromA',entries:{}},savedAt:'x'}}); return 1; })()`); await L(A,'kvFlush()'); await w(400);
  chk('tab B sees the library tab A saved', (await L(B,"Object.keys(libGet()).join()"))==='FromA');
  await ctx.close();
 }
 // 5. a real restore: data is on disk before the page reloads
 {
  const {pg,errs}=await newCtx(); await pg.goto(url); await pg.waitForTimeout(800);
  const chars=JSON.stringify({r1:{id:'r1',name:'Restored',card:{spec:'chara_card_v3',data:{name:'Restored'}},savedAt:'x'}});
  await L(pg,`(async()=>{ openImportModal({_version:'1',_synced_at:new Date().toISOString(),aet_charLibrary:${JSON.stringify(chars)}},'t'); syncImportConfirm(); return 1; })()`);
  await pg.waitForNavigation({timeout:8000}).catch(()=>{}); await pg.waitForTimeout(1500);
  chk('restored character is there after the automatic reload', (await L(pg,"charLibrary.r1 ? charLibrary.r1.name : null"))==='Restored');
  chk('no page errors', errs.length===0, errs);
  await pg.context().close();
 }
 // 6. IndexedDB refuses the write during a restore: rolled back, libraries untouched, clear message
 {
  const {pg,errs}=await newCtx(); await pg.goto(url); await pg.waitForTimeout(800);
  await L(pg,`(async()=>{ charLibrary.keep={id:'keep',name:'KeepMe',card:{data:{name:'KeepMe'}},savedAt:'x'}; saveCharLibrary(); await kvFlush(); })()`);
  await pg.evaluate(()=>{ const real=IDBDatabase.prototype.transaction; window.__failWrites=true; IDBDatabase.prototype.transaction=function(s,m){ if(window.__failWrites && m==='readwrite') throw new DOMException('no space','QuotaExceededError'); return real.apply(this,arguments); }; });
  await L(pg,`(async()=>{ openImportModal({_version:'1',aet_charLibrary:JSON.stringify({z:{id:'z',name:'Intruder',card:{data:{name:'Intruder'}},savedAt:'x'}})},'t'); await syncImportConfirm(); })()`);
  await w(300);
  chk('data unchanged after a refused write', (await L(pg,"JSON.parse(store.get('aet_charLibrary')).keep ? 'kept' : 'lost'"))==='kept' && (await L(pg,"JSON.parse(store.get('aet_charLibrary')).z ? 'intruder' : 'clean'"))==='clean');
  chk('app unfrozen', (await L(pg,'restoringBackup'))===false);
  chk('user was told', (await pg.evaluate(()=>[...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent).join(' | '))).length>20);
  await pg.evaluate(()=>{ window.__failWrites=false; });
  await pg.context().close();
 }
 // 7. an older tab wrote to localStorage after the move: both copies are kept
 {
  const {pg}=await newCtx(); await pg.goto(url); await pg.waitForTimeout(800);
  await L(pg,`(async()=>{ libSet({Mine:{name:'Mine',lb:{name:'Mine',entries:{}},savedAt:'x'}}); await kvFlush(); })()`);
  await pg.evaluate(()=>localStorage.setItem('aet_library','{"FromOldTab":{"name":"FromOldTab","lb":{"entries":{}},"savedAt":"y"}}'));
  await pg.reload(); await pg.waitForTimeout(1500);
  chk('the live library is the IndexedDB one', (await L(pg,"Object.keys(libGet()).join()"))==='Mine');
  chk('the older tab copy was kept beside it', (await L(pg,"store.keys().some(k=>k.startsWith('aet_corrupt_aet_library'))"))===true);
  await pg.context().close();
 }
 // 8. the browser closed the database connection (mobile Safari does this after backgrounding): reopen and save
 {
  const {pg,errs}=await newCtx(); await pg.goto(url); await pg.waitForTimeout(800);
  await pg.evaluate(()=>{ const real=IDBDatabase.prototype.transaction; let once=true; IDBDatabase.prototype.transaction=function(s,m){ if(once && m==='readwrite'){ once=false; throw new DOMException('The database connection is closing.','InvalidStateError'); } return real.apply(this,arguments); }; });
  const ok=await L(pg,`(async()=>{ charLibrary.rc={id:'rc',name:'Reconnected',card:{data:{name:'Reconnected'}},savedAt:'x'}; saveCharLibrary(); return await kvFlush(); })()`);
  chk('save succeeds after the connection had been closed', ok===true, ok);
  await pg.reload(); await pg.waitForTimeout(1200);
  chk('and it persisted', (await L(pg,"charLibrary.rc ? charLibrary.rc.name : null"))==='Reconnected');
  chk('no page errors', errs.length===0, errs);
  await pg.context().close();
 }
 await b.close(); srv.close();
 console.log(fail.length?'\nFAIL\n'+fail.join('\n'):'\nall large-data store checks passed'); process.exit(fail.length?1:0);
})();
