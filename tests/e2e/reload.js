// Real data survives a reload untouched: build a realistic workspace, reload, and make sure the
// start-up storage check sets nothing aside and shows no warning. Usage: node tests/e2e/reload.js
const { chromium } = require('playwright'); const { ev, init } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'); const root=path.resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream'}); s.end(d);});}).listen(0);
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1280,height:900}}); const pg=await ctx.newPage(); await pg.addInitScript(init);
 const warns=[]; pg.on('console',m=>{ if(/set aside|unusable saved data/i.test(m.text())) warns.push(m.text()); });
 await pg.route(/accounts\.google|fonts\./,r=>r.abort());
 const url=`http://localhost:${srv.address().port}/`; await pg.goto(url); await pg.waitForTimeout(600);
 await ev(pg,`(async()=>{
   const w=ms=>new Promise(r=>setTimeout(r,ms));
   lorebook={name:'Book',entries:rebuildEntries({0:{uid:0,comment:'a',key:['k'],content:'c'},1:{uid:1,comment:'b',key:['k2'],content:'d'}})}; renderList(); openInTab(0); saveToStorage();
   libSet({Saved:{name:'Saved',entries:{0:{uid:0,comment:'x',key:[],content:'y'}}}});
   charLibrary.c1={id:'c1',name:'Char',card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:'Char'}},imageData:null,savedAt:new Date().toISOString()}; saveCharLibrary();
   const pr=blankPreset(); pr.name='Pre'; presetLibrary.p1={id:'p1',name:'Pre',preset:pr,savedAt:new Date().toISOString()}; savePresetLibrary();
   openChar('c1'); openPreset('p1'); wsShowItem('char','c1'); wsShowItem('preset','p1'); await w(300);
   store.set('loreos_notebook',JSON.stringify({activePageId:'j',pages:{j:{id:'j',title:'T',content:'<p>x</p>',updatedAt:'2026-01-01'}}}));
   state.promptLibrary.k1={id:'k1',name:'PromptPack',pack:normalizePack(blankPack()),savedAt:new Date().toISOString()}; savePromptLibrary();
   state.regexLibrary.r1={id:'r1',name:'RegexSet',set:normalizeSet(blankSet()),savedAt:new Date().toISOString()}; saveRegexLibrary();
   settingsSet({keepFullAvatars:false}); trashPush('char','Gone',{id:'g',name:'Gone',card:{data:{}}},{undo:false});
   wsSaveTabs(); await w(400);
 })()`);
 const keysBefore=await pg.evaluate(()=>window.LoreOS.store.keys().sort());
 await pg.reload(); await pg.waitForTimeout(1200);
 const after=await pg.evaluate(()=>({keys:window.LoreOS.store.keys().sort(), corrupt:window.LoreOS.store.keys().filter(k=>k.startsWith('aet_corrupt_')), toast:[...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent), tabs:JSON.parse(localStorage.getItem('aet_wsTabs')||'null')}));
 const problems=[];
 if(after.corrupt.length) problems.push('set aside: '+after.corrupt.join(', '));
 if(after.toast.some(t=>/set aside/i.test(t))) problems.push('warning shown: '+after.toast.join(' | '));
 if(warns.length) problems.push('console warning: '+warns[0]);
 if(!after.tabs||!Array.isArray(after.tabs.items)||!after.tabs.items.length) problems.push('open tabs were lost: '+JSON.stringify(after.tabs));
 console.log('keys written:',keysBefore.join(', ')); console.log(problems.length?'FAIL\n - '+problems.join('\n - '):'ok: nothing set aside after reload');
 await b.close(); srv.close(); process.exit(problems.length?1:0);
})();
