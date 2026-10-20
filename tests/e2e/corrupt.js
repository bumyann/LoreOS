// Corrupt / hostile localStorage: every saved key set to garbage, one at a time, plus all at once.
// The app must still start (no uncaught errors, editors usable). Usage: node tests/e2e/corrupt.js
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'); const root=path.resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream'}); s.end(d);});}).listen(0);
const KEYS=['aet_lorebook','aet_tabs','aet_activeTab','aet_nextUid','aet_charLibrary','aet_presetLibrary','aet_promptLibrary','aet_library','aet_tpl_lore','aet_tpl_char','aet_tpl_preset','aet_theme','aet_zoom','aet_css','aet_css_light','aet_font_fp','aet_font_fx','aet_font_fb','aet_theme_slots','aet_settings','loreos_notebook','aet_backup_history','loreos_gdrive_linked'];
const GARBAGE=['{not json','null','[]','"str"','123','{"entries":5}','{"a":null}'];
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const port=srv.address().port; const bad=[]; let runs=0;
 async function boot(seed,label){
  const ctx=await b.newContext({viewport:{width:1280,height:900}}); const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(`try{ const s=${JSON.stringify(seed)}; for(const k in s) localStorage.setItem(k,s[k]); }catch(e){}`);
  await pg.route(/accounts\.google|fonts\./,r=>r.abort());
  await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(600);
  // can the user still do the basics?
  const ok=await pg.evaluate(async()=>{ try{ const L=window.LoreOS; L.createChar(); L.switchMode('lore'); L.switchMode('preset'); L.switchMode('char'); L.navigateTo('notebook'); L.navigateTo('home'); return true; }catch(e){ return 'threw: '+e.message; } });
  runs++; if(errs.length||ok!==true) bad.push(label+' => '+(errs[0]||ok));
  await ctx.close();
 }
 for(const k of KEYS) for(const g of GARBAGE) await boot({[k]:g},k+'='+g);
 const all={}; KEYS.forEach((k,i)=>all[k]=GARBAGE[i%GARBAGE.length]); await boot(all,'ALL KEYS CORRUPT');
 await b.close(); srv.close(); console.log(runs+' boots, '+bad.length+' problems'); bad.slice(0,30).forEach(x=>console.log(' - '+x)); process.exit(bad.length?1:0);
})();
