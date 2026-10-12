// Regression suite: each scenario runs in a fresh page with the app booted, then a check decides pass/fail.
// Usage: node tests/e2e/run.js [name-prefix]   (needs `playwright` installed; see README.md)
// Regression suite: runs each scenario in a fresh page and checks the result.
const { chromium } = require('playwright'); const { ev, init: HINIT } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'); const root=process.env.ROOT||path.resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream'}); s.end(d);});}).listen(8092);
const has=(o,...ks)=>ks.every(k=>o&&o[k]!==undefined);
const T=[
 ['entry-renumbering',   o=>o.names.length===7&&o.stored===7&&o.afterAbove.shows!==undefined],
 ['delete-and-library-xss',o=>o.tabsAfterDelete.stale===0&&o.xssFiredInPicker===false&&o.xssLib===false],
 ['selective-import',o=>o.memHasImported&&o.lsAfterNextSave],
 ['journal-autosave',    o=>o.pages[0]==='typed text that is not yet saved'],
 ['preset-import',     o=>o.importedGarbage===0&&o.seed===-1],
 ['card-formats',    o=>o.ccv3OnlyImport&&o.ccv3OnlyImport.spec==='chara_card_v3'&&o.v2AfterSave==='chara_card_v3'],
 ['exports',     o=>o.pngSpec==='chara_card_v3'&&o.v2Spec==='chara_card_v2'&&o.charxCard==='chara_card_v3'&&o.v3.hasId===false&&o.jsonExport.hasId===false&&o.charxPng.join()==='137,80,78,71'],
 ['pronoun-noun',o=>o.fail.length===0&&/him/.test(o.p.he_to_she)===false&&o.p.he_to_they.includes('They are late')],
 ['restore-race',o=>o.backupLoreSurvived&&o.backupCharSurvived],
 ['restore-rollback',  o=>o.charsRolledBack&&o.presetsRolledBack&&o.flagReset&&o.saveWorks],
 ['autosave-tabs',o=>o.fieldSurvivedTabSwitch==='Typed not saved'&&o.bookEntriesIsArray&&o.exportedBookArray&&o.errorsOnClose.length===0&&o.tabsAfterCreates.join()==='char,char,preset'],
 ['xss-attributes',  o=>o.hit.length===0],
 ['audit-a1', o=>o&&o.diffs.length===0],
 ['audit-a2', o=>o&&o.fails.length===0&&o.keepUntouched],
 ['audit-a3', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-b1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-b2', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-c1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-c3', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-p1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-j1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-k1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-g1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-j2', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-d1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-m1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-t1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['audit-q1', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['prompt-packs', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['ui-logo-home-tabs', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['regex-sets', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['charx-lossless', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['lumiverse', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['regex-single', o=>o&&Array.isArray(o.fail)&&o.fail.length===0],
 ['text-roundtrip', o=>o.fail.length===0],
 ['xss-everywhere',   o=>o.hits.length===0],
 ['lorebook-import-keys',   o=>o.fail.length===0],
 ['perf-shortcuts-files', o=>o.renderList2000ms<1500&&o.filenames[0].includes('日本語')],
 ['shortcuts-escape', o=>o.fail.length===0],
 ['sidebar',   o=>o.fail.length===0],
 ['inline-handlers',o=>o.fail.length===0],
];
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined,args:['--no-sandbox']});
 let pass=0,fail=0; const only=process.argv[2];
 for(const [name,check] of T){
  if(only&&!name.startsWith(only)) continue;
  const code=fs.readFileSync(path.join(__dirname,'scenarios',name+'.js'),'utf8');
  const ctx=await b.newContext({viewport:{width:1280,height:900}}); const pg=await ctx.newPage(); await pg.addInitScript(HINIT);
  // A scenario that starts with `// kv: ls` runs against plain localStorage (the fallback path, or to simulate a tiny quota)
  if(/^\/\/ kv: ls/.test(code)) await pg.addInitScript("try{localStorage.setItem('aet_kv_off','1')}catch(e){}");
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/accounts.google|fonts/, r=>r.abort());
  let ok=false, detail='';
  try{ await pg.goto('http://localhost:8092/'); await pg.waitForTimeout(700); const res=await ev(pg, code); ok=!!check(res); if(!ok) detail=JSON.stringify(res).slice(0,400); }catch(e){ detail='threw: '+e.message.slice(0,200); }
  if(errs.length){ ok=false; detail+=' PAGEERRORS: '+errs.slice(0,3).join(' | '); }
  console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' -> '+detail)); ok?pass++:fail++;
  await ctx.close();
 }
 await b.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
