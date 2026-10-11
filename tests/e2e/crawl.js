// Smoke crawl: click every visible button in every mode/view and record JS errors.
const { chromium } = require('playwright'); const { ev, init: HINIT } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'); const root=process.env.ROOT||path.resolve(__dirname,'../..'); const classic=process.env.CLASSIC==='1';
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream'}); s.end(d);});}).listen(8089);
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined,args:['--no-sandbox']}); const all={}; let clicks=0;
 for(const [vw,vh] of [[1280,900],[390,844]]){
  const ctx=await b.newContext({viewport:{width:vw,height:vh},hasTouch:vw<500,isMobile:vw<500}); const pg=await ctx.newPage(); await pg.addInitScript(HINIT);
  let cur='boot'; const errs=[]; pg.on('pageerror',e=>errs.push(cur+' :: '+e.message)); pg.on('filechooser',fc=>fc.setFiles([]).catch(()=>{}));
  await pg.route(/accounts.google|fonts/, r=>r.abort()); pg.on('dialog',d=>d.dismiss().catch(()=>{}));
  await pg.goto('http://localhost:8089/'); await pg.waitForTimeout(800);
  const seed=()=>pg.evaluate(()=>{ const L=window.LoreOS||window; });
  await ev(pg, async()=>{ const w=ms=>new Promise(r=>setTimeout(r,ms)); createChar(); await w(150); createPreset(); await w(150); switchMode('lore'); createEntry(); createEntry(); await w(150); renderList(); });
  const steps=[['home',null],['library',null],['notebook',null],['laboratory',null],['editor','lore'],['editor','char'],['editor','preset']];
  for(const [view,mode] of steps){
    await ev(pg, async a=>{ navigateTo(a[0]); if(a[1]) switchMode(a[1]); await new Promise(r=>setTimeout(r,250)); }, [view,mode]);
    const n=await pg.evaluate(()=>{ window.__btns=[...document.querySelectorAll('button,.nav-item,.mode-tab,.ws-tab,.ei,.lib-card,.dash-recent-item,.mob-nav-btn')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&e.offsetParent!==null&&!e.disabled}); return window.__btns.length; });
    for(let i=0;i<n;i++){
      cur=`${vw}px ${view}/${mode||''} #${i}`;
      const label=await pg.evaluate(i=>{ const e=window.__btns[i]; return e? (e.id||e.className||e.tagName).toString().slice(0,40)+' "'+(e.textContent||'').trim().slice(0,20)+'"':null; },i);
      if(!label) continue; cur+=' '+label;
      // don't navigate away from the page structure we are crawling or reload it
      if(/Disconnect|Connect|syncExport|reload/i.test(label)) continue;
      try{ await pg.evaluate(i=>{ const e=window.__btns[i]; e&&e.click(); },i); clicks++; }catch(e){}
      await pg.waitForTimeout(40);
      // answer confirm/input dialogs and close modals so the next click starts clean
      await pg.evaluate(()=>{ const ok=document.getElementById('confirmOkBtn'); if(document.getElementById('confirmModal')?.classList.contains('open')) document.getElementById('confirmCancelBtn').click(); document.querySelectorAll('.modal.open').forEach(m=>{ if(m.id==='itemHistoryModal') m.remove(); else m.classList.remove('open'); }); document.getElementById('sidebar')?.classList.remove('mob-open'); document.getElementById('mob-backdrop')?.classList.remove('visible'); document.body.style.overflow=''; });
    }
    // every dialog: open it, click everything inside it
    if(view==='editor'){
      const ids=await pg.evaluate(()=>[...document.querySelectorAll('.modal')].map(m=>m.id).filter(id=>id&&id!=='confirmModal'&&id!=='renameModal'));
      for(const id of ids){
        await ev(pg, async x=>{ openModal(x); await new Promise(r=>setTimeout(r,60)); }, id);
        const mn=await pg.evaluate(id=>{ const m=document.getElementById(id); window.__mb=[...m.querySelectorAll('button')].filter(e=>e.offsetParent!==null&&!e.disabled&&!e.hasAttribute('data-close')); return window.__mb.length; },id);
        for(let i=0;i<mn;i++){ cur=`${vw}px modal ${id}/${mode} #${i}`; await pg.evaluate(i=>{ const e=window.__mb[i]; e&&e.click(); },i); clicks++; await pg.waitForTimeout(30);
          await pg.evaluate(()=>{ if(document.getElementById('confirmModal')?.classList.contains('open')) document.getElementById('confirmCancelBtn').click(); if(document.getElementById('renameModal')?.classList.contains('open')) document.getElementById('renameCancelBtn').click(); }); 
          await pg.evaluate(id=>{ const m=document.getElementById(id); if(m&&!m.classList.contains('open')) m.classList.add('open'); },id); }
        await pg.evaluate(()=>{ document.querySelectorAll('.modal.open').forEach(m=>{ if(m.id==='itemHistoryModal') m.remove(); else m.classList.remove('open'); }); });
      }
    }
    // views reset: re-seed if deletes emptied things
    await ev(pg, async()=>{ if(!Object.keys(charLibrary).length) createChar(); if(!Object.keys(presetLibrary).length) createPreset(); if(!Object.keys(lorebook.entries).length) createEntry(); });
  }
  all[vw]=errs; await ctx.close();
 }
 await b.close(); srv.close();
 const flat=Object.values(all).flat(); const uniq=[...new Set(flat.map(e=>e.replace(/#\d+ .*? :: /,' :: ').replace(/^\d+px /,'')))];
 console.log('clicks',clicks,'| errors',flat.length,'| distinct',uniq.length); uniq.slice(0,25).forEach(e=>console.log(' -',e.slice(0,220)));
})();
