(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,200):'')); };
 // ── workshop tabs ──
 chk('Persona tab is gone from the workshop', !document.querySelector('.mode-tab[data-mode="persona"]') && !document.getElementById('hdr-persona'));
 const tab=m=>document.querySelector('.mode-tab[data-mode="'+m+'"]');
 chk('Prompt tab is a real tab (not faded as a stub)', !!tab('prompt') && !tab('prompt').classList.contains('stub') && getComputedStyle(tab('prompt')).opacity==='1', tab('prompt') && getComputedStyle(tab('prompt')).opacity);
 chk('no tab is marked coming soon any more', document.querySelectorAll('.mode-tab.stub').length===0);
 chk('tabs in order', [...document.querySelectorAll('.mode-tab')].map(t=>t.dataset.mode).join()==='lore,char,preset,prompt,regex', [...document.querySelectorAll('.mode-tab')].map(t=>t.dataset.mode));
 tab('prompt').click(); await w(300);
 chk('clicking it opens the prompt editor', state.mode==='prompt' && /prompt pack/i.test(document.getElementById('sbTitle').textContent+document.getElementById('editorContent').textContent));
 // ── home ──
 state.promptLibrary={}; state.charLibrary={}; state.presetLibrary={}; store.set('aet_library','{}');
 navigateTo('home'); renderHomeView(); await w(150);
 const homeBtn=document.querySelector('#home-content [data-new="prompt"]');
 chk('Home (first visit) has + New Prompt Pack', !!homeBtn && /Prompt Pack/.test(homeBtn.textContent));
 homeBtn.click(); await w(500);
 chk('it creates a pack and opens the Prompt tab', state.mode==='prompt' && Object.keys(state.promptLibrary).length===1, state.mode);
 navigateTo('home'); renderHomeView(); await w(150);
 chk('Home dashboard lists the pack, a quick action and a count', !!document.querySelector('#home-content .dash-act[data-new="prompt"]') && /prompt packs/.test(document.querySelector('.dash-overview').textContent) && /New prompt pack/i.test(document.getElementById('dash-recent-list').textContent), document.getElementById('dash-recent-list').textContent.slice(0,80));
 // ── logo ──
 const iconHrefs=()=>[...document.head.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')].map(l=>l.getAttribute('href'));
 const manifestIcons=async()=>{ const l=document.head.querySelector('link[rel="manifest"]'); const m=await (await fetch(l.href)).json(); return m.icons.map(i=>i.src); };
 localStorage.removeItem('aet_logo'); document.body.classList.remove('pink'); applyLogo(); await w(300);
 chk('default is Automatic and the dark theme gets the dark logo', logoPrefs().mode==='auto' && iconHrefs().every(h=>!/pink/.test(h)) && (await manifestIcons()).every(s=>!/pink/.test(s)), [iconHrefs(), await manifestIcons()]);
 chk('installed-app manifest points at the chosen icons with absolute urls', (await manifestIcons()).every(s=>/^https?:\/\//.test(s)) && (await manifestIcons()).some(s=>/icon-512\.png$/.test(s)));
 toggleTheme(); await w(300);
 chk('Automatic follows the theme: pink theme -> pink logo', iconHrefs().some(h=>/pink/.test(h)) && (await manifestIcons()).every(s=>/pink/.test(s)), iconHrefs());
 toggleTheme(); await w(300);
 chk('and back to the dark logo', iconHrefs().every(h=>!/pink/.test(h)));
 // settings picker
 openSettings(); await w(300);
 chk('Settings has the logo picker with four choices', document.querySelectorAll('#stgLogoBody .logo-card').length===4);
 const pinkRadio=document.querySelector('#stgLogoBody input[value="pink"]'); pinkRadio.click(); await w(300);
 chk('picking Pink in dark mode gives the pink logo (the case that was annoying)', logoPrefs().mode==='pink' && iconHrefs().some(h=>/pink/.test(h)) && (await manifestIcons()).every(s=>/pink/.test(s)));
 document.querySelector('#stgLogoBody input[value="dark"]').click(); await w(300);
 chk('picking Dark gives the dark logo and the shipped tab icons', logoPrefs().mode==='dark' && iconHrefs().includes('icons/favicon.ico') && iconHrefs().every(h=>!/pink/.test(h)));
 // sidebar logo toggle
 document.getElementById('stgLogoShow').click(); await w(200);
 chk('sidebar logo can be shown', !!document.querySelector('.nav-logo .nav-logo-img') && /icon-192\.png$/.test(document.querySelector('.nav-logo-img').getAttribute('src')));
 // upload your own
 const cv=document.createElement('canvas'); cv.width=300; cv.height=120; const cx=cv.getContext('2d'); cx.fillStyle='#e22'; cx.fillRect(0,0,300,120);
 const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
 const dt=new DataTransfer(); dt.items.add(new File([blob],'mine.png',{type:'image/png'}));
 const fi=document.getElementById('stgLogoFile'); fi.files=dt.files; fi.dispatchEvent(new Event('change',{bubbles:true})); await w(800);
 chk('uploaded image becomes the logo', logoPrefs().mode==='custom' && iconHrefs().every(h=>/^data:image\/png/.test(h)), iconHrefs().map(h=>h.slice(0,20)));
 const c=customLogo();
 chk('stored as square 192 and 512 PNGs (not stretched)', !!c && c.s192.startsWith('data:image/png') && c.s512.length>c.s192.length);
 const sq=await new Promise(res=>{ const im=new Image(); im.onload=()=>res([im.naturalWidth,im.naturalHeight]); im.src=c.s512; });
 chk('512 x 512', sq.join('x')==='512x512', sq);
 chk('manifest uses the uploaded image', (await manifestIcons()).every(s=>/^data:image\/png/.test(s)));
 chk('it travels with backups', !!syncBundleData().aet_logo_custom && !!syncBundleData().aet_logo);
 chk('selected card is Your own and the sidebar shows it', document.querySelector('#stgLogoBody .logo-card.on').dataset.logo==='custom' && /^data:image\/png/.test(document.querySelector('.nav-logo-img').getAttribute('src')));
 document.getElementById('stgLogoRemove').click(); await w(300);
 chk('removing it goes back to Automatic and clears the image', logoPrefs().mode==='auto' && customLogo()===null && iconHrefs().every(h=>!/^data:/.test(h)));
 // a file that is not an image is refused
 const bad=new DataTransfer(); bad.items.add(new File(['not an image'],'x.png',{type:'image/png'}));
 const fi2=document.getElementById('stgLogoFile'); fi2.files=bad.files; fi2.dispatchEvent(new Event('change',{bubbles:true})); await w(500);
 chk('a broken image is refused with a message and changes nothing', logoPrefs().mode==='auto' && customLogo()===null && /Could not use that image/.test([...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent).join(' ')));
 out.ok=true; return out;
})()
