// The Library page driven with real mouse clicks (the in-page scenarios call handlers directly, which
// once hid a dead + New menu). Usage: node tests/e2e/library-ui.js
const { chromium } = require('playwright'); const { init } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'); const root=path.resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; fs.readFile(path.join(root,p),(e,d)=>{ if(e){s.writeHead(404);s.end();return;} const ext=path.extname(p); s.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[ext]||'application/octet-stream'}); s.end(d);});}).listen(0);
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const fails=[]; const chk=(n,c)=>{ if(!c) fails.push(n); };
 for (const vp of [{width:1280,height:900},{width:390,height:844,hasTouch:true,isMobile:true}].filter(v=>!process.env.VP||(process.env.VP==='phone')===!!v.hasTouch)) {
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
  // Home's + Add menu (also drawn after start-up)
  await pg.evaluate(()=>window.LoreOS.navigateTo('home')); await pg.waitForTimeout(300);
  await pg.click('#hbAddBtn'); await pg.waitForTimeout(150);
  chk(label+': Home + Add opens its menu', await pg.evaluate(()=>getComputedStyle(document.querySelector('#hbAddDd .dd-menu')).display==='block'));
  await pg.click('#hbAddDd [data-hbnew="note"]'); await pg.waitForTimeout(250);
  chk(label+': Home note editor opens', await pg.evaluate(()=>document.getElementById('hbModal').classList.contains('open')));
  await pg.click('#hbModal .modal-x'); await pg.waitForTimeout(150);
  // Home board: drag a card to rearrange (mouse on desktop, press-and-hold on touch)
  await pg.evaluate(()=>{ const L=window.LoreOS; L.homeSet({board:['a','b','c'].map((id,i)=>({id,type:'note',title:'Card '+id.toUpperCase(),text:'text '+id+' '.repeat(1)+'x'.repeat(40+i*30)}))}); L.navigateTo('home'); L.renderHomeView(); });
  await pg.waitForTimeout(400);
  const order=()=>pg.evaluate(()=>window.LoreOS.homeGet().board.map(c=>c.id).join(''));
  // bring the whole board into view first, so measuring one card cannot scroll another one away
  // (centred, so the phone's bottom bar is not on top of a card)
  const box=async id=>{ await pg.evaluate(()=>document.getElementById('homeBoard').scrollIntoView({block:'center'})); await pg.waitForTimeout(150); return await pg.locator('[data-card="'+id+'"]').first().boundingBox(); };
  chk(label+': board starts a,b,c', await order()==='abc');
  if (!vp.hasTouch) {
    const bc=await box('c'), ba=await box('a');
    await pg.mouse.move(bc.x+bc.width/2, bc.y+bc.height/2); await pg.mouse.down();
    await pg.mouse.move(bc.x+bc.width/2-20, bc.y+bc.height/2-20, {steps:4});
    chk(label+': a ghost follows the pointer while dragging', await pg.evaluate(()=>!!document.querySelector('.hb-ghost') && !!document.querySelector('.hb-dragging')));
    await pg.mouse.move(ba.x+ba.width/2, ba.y+4, {steps:12}); await pg.mouse.up(); await pg.waitForTimeout(300);
    chk(label+': dragging C above A reorders to c,a,b', await order()==='cab', await order());
    chk(label+': the drop did not open the editor, ghost is gone', await pg.evaluate(()=>!document.getElementById('hbModal').classList.contains('open') && !document.querySelector('.hb-ghost')));
    // a plain click still edits
    await pg.click('[data-card="b"]'); await pg.waitForTimeout(250);
    chk(label+': a plain click still opens the editor', await pg.evaluate(()=>document.getElementById('hbModal').classList.contains('open')));
    await pg.click('#hbModal .modal-x'); await pg.waitForTimeout(150);
    // escape cancels a drag
    const b2=await box('b'), a2=await box('c');
    await pg.mouse.move(b2.x+b2.width/2, b2.y+b2.height/2); await pg.mouse.down(); await pg.mouse.move(a2.x+a2.width/2, a2.y+4, {steps:10}); await pg.keyboard.press('Escape'); await pg.mouse.up(); await pg.waitForTimeout(300);
    chk(label+': Escape cancels the drag', await order()==='cab' && await pg.evaluate(()=>!document.querySelector('.hb-ghost')), await order());
    // resize with the grip in a card's corner
    { const bb=await box('b'); await pg.mouse.move(bb.x+bb.width/2, bb.y+bb.height/2); await pg.waitForTimeout(100);
      const gx=bb.x+bb.width-8, gy=bb.y+bb.height-8;
      await pg.mouse.move(gx,gy); await pg.mouse.down(); await pg.mouse.move(gx+bb.width*1.1,gy,{steps:8}); await pg.mouse.up(); await pg.waitForTimeout(300);
      chk(label+': dragging the grip makes a card two columns wide', await pg.evaluate(()=>window.LoreOS.homeGet().board.find(c=>c.id==='b').w)===2);
      chk(label+': resizing did not reorder or open the editor', await order()==='cab' && await pg.evaluate(()=>!document.getElementById('hbModal').classList.contains('open')), await order());
      const bb2=await box('b'); const gx2=bb2.x+bb2.width-8, gy2=bb2.y+bb2.height-8;
      await pg.mouse.move(gx2,gy2); await pg.mouse.down(); await pg.mouse.move(gx2-bb2.width*0.9,gy2,{steps:8}); await pg.mouse.up(); await pg.waitForTimeout(300);
      chk(label+': and dragging it back makes it narrow again', await pg.evaluate(()=>window.LoreOS.homeGet().board.find(c=>c.id==='b').w)===1); }
    // keyboard: Alt+Arrow
    await pg.focus('[data-card="a"]'); await pg.keyboard.press('Alt+ArrowLeft'); await pg.waitForTimeout(300);
    chk(label+': Alt+Left moves a card earlier and keeps focus', await order()==='acb', await order());
  } else {
    const cdp=await pg.context().newCDPSession(pg);
    const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
    const bc=await box('c'), ba=await box('a');
    const cx=bc.x+bc.width/2, cy=bc.y+bc.height/2;
    await touch('touchStart',cx,cy); await pg.waitForTimeout(450);
    for (let i=1;i<=12;i++) { await touch('touchMove',cx,cy+(ba.y+4-cy)*i/12); await pg.waitForTimeout(25); }
    await touch('touchEnd',0,0); await pg.waitForTimeout(400);
    chk(label+': press-and-hold then drag reorders on touch', await order()==='cab', await order());
    // a quick swipe is a scroll, not a drag
    const bb=await box('b'); const sx=bb.x+bb.width/2, sy=bb.y+bb.height/2;
    await touch('touchStart',sx,sy); for (let i=1;i<=6;i++) { await touch('touchMove',sx,sy-12*i); await pg.waitForTimeout(15); } await touch('touchEnd',0,0); await pg.waitForTimeout(300);
    chk(label+': a quick swipe does not rearrange', await order()==='cab', await order());
  }
  chk(label+': no page errors', errs.length===0);
  if (errs.length) console.log(label, errs.slice(0,3));
  await pg.context().close();
 }
 await b.close(); srv.close();
 if (fails.length) { console.log('FAIL', fails); process.exit(1); } else console.log('library ui ok (real clicks, desktop and phone)');
})();
