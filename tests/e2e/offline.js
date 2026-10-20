const { chromium } = require('playwright'); const { ev, init: HINIT } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'); const root=path.resolve(__dirname,'../..');
const PORT=8093; let mutate={}, missing=new Set(), hits={};
function serve(prefix){
 return http.createServer((q,s)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); hits[p]=(hits[p]||0)+1;
  if(prefix){ if(!p.startsWith(prefix)){s.writeHead(404);s.end('nope');return;} p=p.slice(prefix.length-1); }
  if(p.endsWith('/'))p+='index.html';
  if(missing.has(p)){s.writeHead(404);s.end();return;}
  const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;}
    if(mutate[p]) d=Buffer.concat([d,Buffer.from(mutate[p])]);
    const type=f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':f.endsWith('.png')?'image/png':'application/octet-stream';
    const etag='"'+crypto.createHash('md5').update(d).digest('hex')+'"';
    if(q.headers['if-none-match']===etag){s.writeHead(304,{etag});s.end();return;}
    s.writeHead(200,{'content-type':type,etag,'cache-control':'max-age=600'}); s.end(d);});
 });
}
async function run(label,prefix,opts={}){
 const srv=serve(prefix).listen(PORT); const base=`http://localhost:${PORT}${prefix||'/'}`;
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined,args:['--no-sandbox']});
 const ctx=await b.newContext(); const out={label,base};
 await ctx.route(/googleapis|gstatic|accounts.google/, r=>{ const u=r.request().url(); if(u.includes('googleapis.com/css')) return r.fulfill({status:200,contentType:'text/css',headers:{'access-control-allow-origin':'*'},body:'/* fake font css */'}); r.abort(); });
 const pg=await ctx.newPage(); await pg.addInitScript(HINIT); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(base); await pg.waitForFunction(()=>navigator.serviceWorker.controller||false,{timeout:8000}).catch(()=>{});
 await pg.waitForTimeout(1200);
 out.controlled=await ev(pg, ()=>!!navigator.serviceWorker.controller);
 out.cached=await ev(pg, async()=>{ const names=await caches.keys(); const o={names}; for(const n of names){ const c=await caches.open(n); o[n]=(await c.keys()).map(r=>new URL(r.url).pathname); } return o; });
 const cacheKey=out.cached.names.find(n=>/^loreos-\d+/.test(n)); const have=out.cached[cacheKey]||[];
 const need=['index.html','legal.html','manifest.json','css/base.css','css/components.css','js/util.js','js/main.js','js/workshop.js','js/pwa.js','js/router.js','js/tiptap-bundle.js','vendor/lz-string.min.js','vendor/jszip.min.js','icons/icon-192.png'];
 out.missingFromCache=need.filter(n=>!have.some(h=>h.endsWith('/'+n)));
 out.fontCached=(out.cached['loreos-fonts-v1']||[]).length;
 // go offline, hard reload
 await ctx.setOffline(true);
 await pg.reload(); await pg.waitForTimeout(1200);
 out.offlineBoot=await ev(pg, ()=>({lz:typeof LZString,zip:typeof JSZip,router:typeof navigateTo,tiptap:typeof TiptapEditor,title:document.title}));
 out.offlineWork=await ev(pg, async()=>{ const w=ms=>new Promise(r=>setTimeout(r,ms)); createChar(); await w(200); const id=activeCharId; document.getElementById('chName').value='Offline Card'; document.getElementById('chName').dispatchEvent(new Event('input',{bubbles:true})); saveChar({silent:true}); exportCharJson(id); const cap=(await dl()).text; const zip=new JSZip(); zip.file('a.txt','hi'); const blob=await zip.generateAsync({type:'blob'}); return {saved:charLibrary[id].card.data.name, exported:JSON.parse(cap).data.name, zipBytes:blob.size>0, lz:LZString.decompressFromUTF16(LZString.compressToUTF16('x'))==='x'}; });
 // other pages while offline
 const legal=await pg.goto(base+'legal.html').catch(e=>null); out.legalOffline=legal?legal.status():'fail'; 
 await pg.goto(base); await pg.waitForTimeout(500);
 out.offlineToastOrNoErrors=errs;
 // back online + update available
 await ctx.setOffline(false);
 if(opts.update){ mutate['/js/router.js']='\n// changed'; const msgs=[]; await pg.exposeFunction('__got',()=>msgs.push(1)); await ev(pg, ()=>navigator.serviceWorker.addEventListener('message',e=>{ if(e.data&&e.data.type==='update-ready') window.__got(); })); await pg.reload(); await pg.waitForTimeout(1500); out.updateMessages=msgs.length; out.toast=await ev(pg, ()=>[...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent)); await pg.reload(); await pg.waitForTimeout(800); out.newCopyServed=await ev(pg, async()=>(await (await fetch('js/router.js')).text()).includes('// changed')); }
 await b.close(); srv.close(); mutate={}; return out;
}
(async()=>{
 console.log(JSON.stringify(await run('root','' ,{update:true}),null,1));
 console.log(JSON.stringify(await run('subfolder','/LoreOS/'),null,1));
 // install tolerance: a missing precache file must not stop the SW
 missing=new Set(['/icons/favicon.ico','/icons/icon-pink-192.png']); const r=await run('one-asset-404','/'); console.log('tolerant install -> controlled:',r.controlled,'| cached count:',(r.cached[r.cached.names.find(n=>/^loreos-\d+/.test(n))]||[]).length); missing=new Set();
})();
