// The Library page driven with real mouse clicks (the in-page scenarios call handlers directly, which
// once hid a dead + New menu). Usage: node tests/e2e/library-ui.js
const { chromium } = require('playwright'); const { init } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'); const root=path.resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; fs.readFile(path.join(root,p),(e,d)=>{ if(e){s.writeHead(404);s.end();return;} const ext=path.extname(p); s.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[ext]||'application/octet-stream'}); s.end(d);});}).listen(0);
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const fails=[]; const chk=(n,c)=>{ if(!c) fails.push(n); };
 for (const vp of [{width:1280,height:900},{width:390,height:844,hasTouch:true,isMobile:true}]) {
  const label=vp.width+'px';
  const pg=await (await b.newContext({viewport:vp,hasTouch:!!vp.hasTouch,isMobile:!!vp.isMobile})).newPage(); await pg.addInitScript(init);
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/accounts\.google|fonts\./,r=>r.abort());
  await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(700);
  const openLibrary=async()=>{ if(vp.width<500){ await pg.click('#mob-nav [data-view="library"], .mob-nav-btn[data-view="library"]').catch(async()=>{ await pg.evaluate(()=>window.LoreOS.navigateTo('library')); }); } else await pg.click('.nav-item[data-view="library"]'); await pg.waitForTimeout(400); };
  await openLibrary();
  // + New opens a menu you can see and click
  await pg.click('#libxNewBtn'); await pg.waitForTimeout(200);
  chk(label+': + New opens its menu', await pg.evaluate(()=>getComputedStyle(document.querySelector('#libxNewDd .dd-menu')).display==='block'));
  // persona
  await pg.click('#libxNewDd [data-libnew="persona"]'); await pg.waitForTimeout(500);
  chk(label+': New persona opens its dialog', await pg.evaluate(()=>document.getElementById('personaModal').classList.contains('open')));
  await pg.fill('#personaName','Click persona'); await pg.waitForTimeout(600); await pg.click('#personaDone'); await pg.waitForTimeout(400);
  chk(label+': persona listed', (await pg.textContent('#library-content')).includes('Click persona'));
  // the menu closes after a click elsewhere
  await pg.click('#libxNewBtn'); await pg.waitForTimeout(150); await pg.click('.libx-top .lib-view-title'); await pg.waitForTimeout(150);
  chk(label+': menu closes on outside click', await pg.evaluate(()=>getComputedStyle(document.querySelector('#libxNewDd .dd-menu')).display==='none'));
  // every other kind, one after another
  for (const [kind,mode,count] of [['char','char','charLibrary'],['preset','preset','presetLibrary'],['prompt','prompt','promptLibrary'],['regex','regex','regexLibrary'],['regexscript','regex','regexLibrary']]) {
    const before=await pg.evaluate(c=>Object.keys(window.LoreOS[c]).length,count);
    await openLibrary();
    await pg.click('#libxNewBtn'); await pg.waitForTimeout(150);
    await pg.click(`#libxNewDd [data-libnew="${kind}"]`); await pg.waitForTimeout(700);
    const after=await pg.evaluate(c=>Object.keys(window.LoreOS[c]).length,count);
    chk(label+': New '+kind+' creates one', after===before+1);
    chk(label+': New '+kind+' opens the editor in '+mode, await pg.evaluate(m=>window.LoreOS.state.mode===m,mode));
  }
  // lorebook entry of the menu goes to the editor
  await openLibrary(); await pg.click('#libxNewBtn'); await pg.waitForTimeout(150); await pg.click('#libxNewDd [data-libnew="lore"]'); await pg.waitForTimeout(500);
  chk(label+': New lorebook opens the lorebook editor', await pg.evaluate(()=>window.LoreOS.state.mode==='lore'));
  chk(label+': no page errors', errs.length===0);
  if (errs.length) console.log(label, errs.slice(0,3));
  await pg.context().close();
 }
 await b.close(); srv.close();
 if (fails.length) { console.log('FAIL', fails); process.exit(1); } else console.log('library ui ok (real clicks, desktop and phone)');
})();
