(async()=>{
 const o={fail:[]}; const w=ms=>new Promise(r=>setTimeout(r,ms)); const chk=(n,c,d)=>{ if(!c) o.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 // sliders stay in sync (replaced inline oninput)
 createPreset(); await w(250);
 const r=document.getElementById('psTempRange'), n=document.getElementById('psTempNum'), v=document.getElementById('psTempVal');
 r.value='1.2'; r.dispatchEvent(new Event('input',{bubbles:true})); chk('range->num+label', n.value==='1.2'&&v.textContent==='1.2',[n.value,v.textContent]);
 n.value='0.3'; n.dispatchEvent(new Event('input',{bubbles:true})); chk('num->range+label', r.value==='0.3'&&v.textContent==='0.3');
 // home buttons (replaced inline onclick)
 localStorage.clear(); for(const k of Object.keys(charLibrary)) delete charLibrary[k]; for(const k of Object.keys(presetLibrary)) delete presetLibrary[k];
 navigateTo('home'); await w(100);
 const click=t=>[...document.querySelectorAll('[data-new]')].find(b=>b.dataset.new===t).click();
 click('char'); await w(400); chk('home new char', mode==='char'&&Object.keys(charLibrary).length===1,[mode,Object.keys(charLibrary).length]);
 navigateTo('home'); await w(150); click('preset'); await w(400); chk('home new preset', mode==='preset'&&Object.keys(presetLibrary).length>=1);
 navigateTo('home'); await w(150); click('lore'); await w(400); chk('home new entry', mode==='lore'&&Object.keys(lorebook.entries).length===1);
 navigateTo('home'); await w(150); const lib=document.querySelector('[data-go=library]'); chk('dashboard library button', !!lib); if(lib){ lib.click(); await w(200); chk('went to library', currentView==='library'); }
 // header: nav theme button + mobile help
 const had=document.body.classList.contains('pink'); document.getElementById('navThemeBtn').click(); chk('theme button', document.body.classList.contains('pink')!==had);
 document.getElementById('mob-topbar-help').click(); chk('mobile help button', document.getElementById('helpModal').classList.contains('open')); closeModal('helpModal');
 return o;
})()
