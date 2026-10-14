(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 const cv=document.createElement('canvas'); cv.width=cv.height=8; cv.getContext('2d').fillRect(0,0,8,8); const PIC=cv.toDataURL('image/png');
 // ── pure ──
 chk('only http(s) links are kept', safeUrl('https://a.com/x')==='https://a.com/x' && safeUrl('javascript:alert(1)')==='' && safeUrl('data:text/html,x')==='' && safeUrl('  http://b.org ')==='http://b.org' && safeUrl('ftp://x')==='');
 const nh=normalizeHome({board:[{id:'a',type:'link',url:'javascript:1',title:'t'},{id:'a',type:'note',text:'dup'},{type:'weird',text:'x',color:'red'},5,{id:'b',type:'image',image:'javascript:1'},{id:'c',type:'image',image:PIC}]});
 chk('board is cleaned: duplicates, bad link, bad type, bad colour, bad image', nh.board.length===4 && nh.board[0].url==='' && nh.board[1].type==='note' && nh.board[1].color==='' && nh.board[2].image==='' && nh.board[3].image===PIC, nh.board.map(c=>[c.id,c.type]));
 const mv=normalizeHome({board:[{id:'1',text:'a'},{id:'2',text:'b'},{id:'3',text:'c'}]}); chk('move earlier/later', moveCard(mv,'3',-1) && mv.board.map(c=>c.id).join()==='1,3,2' && !moveCard(mv,'1',-1) && !moveCard(mv,'2',1));
 chk('home board syncs with Drive', SYNC_KEYS.includes('aet_home') && SYNC_MODULES.some(m=>m.key==='home'));
 // ── dashboard ──
 store.set('aet_home','{}'); store.set('aet_meta','{}'); store.set('aet_library','{}'); state.promptLibrary={}; state.regexLibrary={}; state.personaLibrary={}; state.presetLibrary={};
 state.charLibrary={c1:{id:'c1',name:'Older',card:{data:{name:'Older'}},savedAt:new Date(Date.now()-5*86400000).toISOString()},c2:{id:'c2',name:'Newest',card:{data:{name:'Newest'}},savedAt:new Date().toISOString()}};
 togglePin('char','c1');
 navigateTo('home'); renderHomeView(); await w(300);
 chk('continue points at the most recent thing', /Newest/.test(document.querySelector('.dash-continue-n').textContent));
 chk('favourites come from the Library pins', document.querySelectorAll('#dash-pinned-list .dash-recent-item').length===1 && /Older/.test(document.getElementById('dash-pinned-list').textContent));
 chk('recent lists them newest first', document.querySelector('#dash-recent-list .dash-recent-item .dash-recent-name').textContent==='Newest');
 chk('counts', /2/.test(document.querySelector('.dash-overview').textContent));
 document.getElementById('homeContinue').click(); await w(700);
 chk('Continue opens it in its editor', state.mode==='char' && state.activeCharId==='c2', [state.mode,state.activeCharId]);
 navigateTo('home'); renderHomeView(); await w(300);
 document.querySelector('#dash-pinned-list .dash-recent-item').click(); await w(700);
 chk('a favourite opens too', state.activeCharId==='c1', state.activeCharId);
 navigateTo('home'); renderHomeView(); await w(300);
 // ── quick actions panel ──
 chk('quick actions are a side panel with six buttons and the Library', !!document.querySelector('.dash-side .qa-list') && document.querySelectorAll('.dash-side .qa-btn[data-new]').length===6 && !!document.querySelector('.dash-side [data-go="library"]'));
 chk('icon-only: no visible text, but each has a tooltip and an accessible name', [...document.querySelectorAll('.dash-side .qa-btn')].every(b=>b.getAttribute('aria-label') && b.dataset.tip && getComputedStyle(b.querySelector('.qa-lbl')).position==='absolute' && b.getBoundingClientRect().width<=48));
 chk('buttons carry a symbol, a label and a hint', [...document.querySelectorAll('.dash-side .qa-btn[data-new]')].every(b=>b.querySelector('.qa-ico').textContent.trim() && b.querySelector('.qa-lbl').textContent.trim() && b.querySelector('.qa-hint').textContent.trim()));
 document.querySelector('.qa-btn[data-new="persona"]').click(); await w(500);
 chk('New Persona opens the persona dialog', document.getElementById('personaModal').classList.contains('open') && Object.keys(state.personaLibrary).length>=1);
 closeModal('personaModal');
 document.querySelector('.qa-btn[data-go="library"]').click(); await w(300);
 chk('Open Library goes to the Library', document.getElementById('view-library').classList.contains('view-active'));
 navigateTo('home'); renderHomeView(); await w(300);
 // ── recent: faces on top, everything else below; stats in one scrollable row ──
 state.presetLibrary={p9:{id:'p9',name:'Some Preset',preset:{prompts:[]},savedAt:new Date().toISOString()}}; state.personaLibrary={u9:{id:'u9',name:'A Persona',persona:{title:'',description:'',avatar:''},savedAt:new Date().toISOString()}};
 renderHomeView(); await w(300);
 const rowsEl=[...document.querySelectorAll('#dash-recent-list .dash-hrow')];
 chk('recent has a row of portrait cards and a row of tiles', rowsEl.length===2 && rowsEl[0].classList.contains('dash-covers') && rowsEl[1].classList.contains('dash-tilerow'), rowsEl.map(r=>r.className));
 chk('characters and personas are cards with the name below the art', [...rowsEl[0].querySelectorAll('.dash-cover')].length>=3 && /A Persona/.test(rowsEl[0].textContent) && !/Some Preset/.test(rowsEl[0].textContent) && !!rowsEl[0].querySelector('.dash-cover-art + .dash-recent-name'));
 chk('presets and the rest are tiles in the lower row', /Some Preset/.test(rowsEl[1].textContent) && !/Newest/.test(rowsEl[1].textContent));
 chk('rows scroll sideways inside themselves', rowsEl.every(r=>getComputedStyle(r).overflowX==='auto'));
 chk('stats are one scrollable row', getComputedStyle(document.querySelector('.dash-overview')).flexWrap==='nowrap' && getComputedStyle(document.querySelector('.dash-overview')).overflowX==='auto');
 document.querySelector('#dash-recent-list .dash-cover').click(); await w(700);
 chk('a portrait card opens its item', state.mode==='char' || document.getElementById('personaModal').classList.contains('open'), state.mode);
 closeModal('personaModal'); navigateTo('home'); renderHomeView(); await w(300);
 // ── rail is quiet until hover ──
 { const b=document.querySelector('.qa-btn[data-new="preset"]'); const rest=getComputedStyle(b).color; const hov=getComputedStyle(b).getPropertyValue('--qa-h').trim();
   chk('rail icons share the app colour and keep the category colour for hover', hov==='#5aa0b4' && rest!=='rgb(90, 160, 180)' && getComputedStyle(document.querySelector('.qa-btn[data-new="char"]')).color===rest, [rest,hov]); }
 // ── navigation uses symbols, not sparkles ──
 const navIcons=[...document.querySelectorAll('.nav-item-icon')].slice(0,5).map(e=>e.textContent.replace(/\uFE0E/g,''));
 chk('desktop nav has distinct symbols', navIcons.join('')==='⌂▤❡⚒⚗' && !navIcons.includes('✦'), navIcons);
 chk('phone nav too', !/✦/.test(document.getElementById('mob-nav').textContent), [...document.querySelectorAll('#mob-nav .icon')].slice(0,5).map(e=>e.textContent));
 // ── board ──
 chk('empty board explains itself', /sparks an idea/.test(document.getElementById('home-content').textContent));
 document.querySelector('[data-hbnew="note"]').click(); await w(250);
 chk('note editor opens without link or picture fields', document.getElementById('hbModal').classList.contains('open') && document.getElementById('hbUrlRow').style.display==='none' && document.getElementById('hbImgRow').style.display==='none' && document.getElementById('hbDelete').style.display==='none');
 document.getElementById('hbSave').click(); await w(150);
 chk('an empty note is refused', homeGet().board.length===0 && document.getElementById('hbModal').classList.contains('open'));
 type(document.getElementById('hbTitle'),'Court rule'); type(document.getElementById('hbText'),'No one says the name.'); document.querySelector('#hbColors [data-c="#9a78c8"]').click();
 document.getElementById('hbSave').click(); await w(300);
 chk('note saved and drawn with its colour', homeGet().board.length===1 && homeGet().board[0].color==='#9a78c8' && /Court rule/.test(document.getElementById('homeBoard').textContent) && !!document.querySelector('.hb-card.tinted'));
 // link
 document.querySelector('[data-hbnew="link"]').click(); await w(250);
 chk('link editor shows the link field', document.getElementById('hbUrlRow').style.display!=='none');
 type(document.getElementById('hbTitle'),'Refs'); type(document.getElementById('hbUrl'),'javascript:alert(1)'); document.getElementById('hbSave').click(); await w(200);
 chk('a javascript: link is refused', homeGet().board.length===1 && document.getElementById('hbModal').classList.contains('open'));
 type(document.getElementById('hbUrl'),'https://example.com/refs'); document.getElementById('hbSave').click(); await w(300);
 const a=document.querySelector('.hb-link a');
 chk('link opens in a new tab, safely', !!a && a.getAttribute('href')==='https://example.com/refs' && a.target==='_blank' && /noopener/.test(a.rel) && homeGet().board[0].type==='link', a&&a.outerHTML);
 // image (set through the store; the picker needs a file dialog)
 const hh=homeGet(); hh.board.push({id:'img1',type:'image',title:'Cathedral',text:'mood',image:PIC}); homeSet(hh); renderHomeView(); await w(300);
 chk('image card shows picture and caption', !!document.querySelector('.hb-image img') && /Cathedral/.test(document.querySelector('.hb-image').textContent));
 // edit + reorder + delete + undo
 document.querySelector('[data-card="img1"]').click(); await w(250);
 chk('editing an image card shows the picture controls', document.getElementById('hbImgRow').style.display!=='none' && document.getElementById('hbColorRow').style.display==='none' && !!document.querySelector('#hbPrev img') && document.getElementById('hbDelete').style.display!=='none');
 type(document.getElementById('hbTitle'),'Drowned cathedral'); document.getElementById('hbEarlier').click(); await w(250);
 chk('moving earlier reorders the board', homeGet().board.map(c=>c.id).indexOf('img1')===1, homeGet().board.map(c=>c.id));
 document.getElementById('hbSave').click(); await w(300);
 chk('edit saved', homeGet().board.find(c=>c.id==='img1').title==='Drowned cathedral');
 document.querySelector('[data-card="img1"]').click(); await w(250); document.getElementById('hbDelete').click(); await w(200); document.getElementById('confirmOkBtn').click(); await w(400);
 chk('card deleted', !homeGet().board.some(c=>c.id==='img1'));
 const undo=[...document.querySelectorAll('.notif button, .notif .notif-act')].find(b=>/Undo/.test(b.textContent)); if(undo) undo.click(); await w(400);
 chk('undo brings it back', homeGet().board.some(c=>c.id==='img1'));
 chk('no emoji on Home', !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('home-content').innerHTML));
 // dropping picture files on the board makes image cards (and is not imported as a character card)
 const blob=await new Promise(r=>cv.toBlob(r,'image/png')); const charsBefore=Object.keys(state.charLibrary).length; const boardBefore=homeGet().board.length;
 const dropFiles=files=>{ const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f)); document.getElementById('hbZone').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true})); };
 dropFiles([new File([blob],'moodboard shot.png',{type:'image/png'})]); await w(700);
 const nb=homeGet().board;
 chk('a dropped picture becomes the first image card', nb.length===boardBefore+1 && nb[0].type==='image' && nb[0].title==='moodboard shot' && !!nb[0].image, nb.map(c=>c.type));
 chk('and was not imported as a character', Object.keys(state.charLibrary).length===charsBefore && !document.getElementById('dropHint').classList.contains('on'));
 dropFiles([new File(['PK'],'archive.zip',{type:'application/zip'})]); await w(400);
 chk('files that are neither pictures nor text are not added', homeGet().board.length===boardBefore+1);
 dropFiles([new File(['Line one\nthe rest of it'],'notes.txt',{type:'text/plain'})]); await w(500);
 { const nc=homeGet().board[0]; chk('a dropped text file becomes a note', nc.type==='note' && nc.title==='Line one' && nc.text==='the rest of it', nc); }
 // text, links and pictures dragged in from elsewhere
 const dropData=(data,files)=>{ const dt=new DataTransfer(); Object.entries(data).forEach(([k,v])=>dt.setData(k,v)); (files||[]).forEach(f=>dt.items.add(f)); document.getElementById('hbZone').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true})); };
 dropData({'text/plain':'https://example.com/some/page'}); await w(400);
 chk('a dropped link becomes a link card', homeGet().board[0].type==='link' && homeGet().board[0].url==='https://example.com/some/page' && homeGet().board[0].title==='example.com', homeGet().board[0]);
 dropData({'text/plain':'javascript:alert(1)'}); await w(400);
 chk('a javascript: link is not a link card', homeGet().board[0].type!=='link' || homeGet().board[0].url==='');
 dropData({'text/plain':'Plot idea\nwhat if the court never existed'}); await w(400);
 chk('dropped text becomes a note, first line as title', homeGet().board[0].type==='note' && homeGet().board[0].title==='Plot idea' && /never existed/.test(homeGet().board[0].text));
 dropData({'text/plain':'just a thought'}); await w(400);
 chk('one line of text becomes a titleless note', homeGet().board[0].type==='note' && homeGet().board[0].title==='' && homeGet().board[0].text==='just a thought');
 dropData({'text/html':'<p><img src="https://cdn.example.invalid/pic.png"></p>','text/uri-list':'https://cdn.example.invalid/pic.png'}); await w(1200);
 chk('a picture from a web page that will not hand it over becomes a link card with a note', homeGet().board[0].type==='link' && /link to it/.test(homeGet().board[0].text), homeGet().board[0]);
 chk('textToCard', textToCard('  ')===null && textToCard('http://a.b/c').type==='link' && textToCard('two words http://a.b').type==='note' && textToCard('a\nb\nc').title==='a');
 // paste
 { const dt=new DataTransfer(); dt.setData('text/plain','pasted idea'); const n0=homeGet().board.length; document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})); await w(500);
   chk('pasting on Home adds a card', homeGet().board.length===n0+1 && homeGet().board[0].text==='pasted idea'); }
 { const ta=document.createElement('textarea'); document.body.append(ta); const dt=new DataTransfer(); dt.setData('text/plain','typed in a box'); const n0=homeGet().board.length; ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})); await w(300); ta.remove();
   chk('pasting into a text box is left alone', homeGet().board.length===n0); }
 chk('the drop zone is marked for the app-wide importer to leave alone', !!document.querySelector('#hbZone[data-drop-own]'));
 // ── card width ──
 renderHomeView(); await w(300);
 chk('columns follow the width', boardColumns(1000)===5 && boardColumns(380)===2 && boardColumns(100)===1 && boardColumns(5000)===6);
 { const b=document.getElementById('homeBoard'); const c=homeGet().board[0]; const el=document.querySelector('[data-card="'+c.id+'"]');
   chk('cards start one column wide with a resize grip, laid out as a masonry grid', getComputedStyle(b).display==='grid' && el.dataset.w==='1' && !!el.querySelector('[data-resize]') && /span \d+/.test(el.style.gridRowEnd), [el.dataset.w, el.style.gridRowEnd]);
   el.focus(); el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,shiftKey:true,bubbles:true,cancelable:true})); await w(300);
   chk('Alt+Shift+Right makes a card wider (and keeps it)', homeGet().board[0].w===2 && document.querySelector('[data-card="'+c.id+'"]').dataset.w==='2', homeGet().board[0].w);
   document.querySelector('[data-card="'+c.id+'"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,shiftKey:true,bubbles:true,cancelable:true})); await w(300);
   chk('Alt+Shift+Left narrows it, never below one', homeGet().board[0].w===1);
   document.querySelector('[data-card="'+c.id+'"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,shiftKey:true,bubbles:true,cancelable:true})); await w(200);
   chk('and never goes below one column', homeGet().board[0].w===1); }
 chk('widths are limited to 1-4', normalizeCard({type:'note',text:'x',w:99}).w===4 && normalizeCard({type:'note',text:'x',w:-3}).w===1 && normalizeCard({type:'note',text:'x'}).w===1);
 document.querySelector('[data-card]').click(); await w(250);
 chk('the editor has a Width setting', !!document.getElementById('hbSize'));
 document.getElementById('hbSize').value='3'; document.getElementById('hbSave').click(); await w(300);
 chk('the editor sets the width', homeGet().board[0].w===3, homeGet().board[0].w);
 // keyboard move
 renderHomeView(); await w(250);
 const ids=homeGet().board.map(c=>c.id); const second=document.querySelector('[data-card="'+ids[1]+'"]'); second.focus();
 second.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true,cancelable:true})); await w(300);
 chk('Alt+Left moves a card earlier', homeGet().board[0].id===ids[1] && document.activeElement===document.querySelector('[data-card="'+ids[1]+'"]'), homeGet().board.map(c=>c.id));
 // reorderBoard
 const cur=homeGet().board.map(c=>c.id); reorderBoard([...cur].reverse()); chk('reorderBoard writes the new order', homeGet().board.map(c=>c.id).join()===[...cur].reverse().join());
 reorderBoard(['nope',cur[0]]); chk('reorderBoard keeps cards it was not told about', homeGet().board.length===cur.length && homeGet().board[0].id===cur[0]);
 // a user with only a board still sees the dashboard
 state.charLibrary={}; navigateTo('home'); renderHomeView(); await w(300);
 chk('board alone is enough for the dashboard', !!document.getElementById('homeBoard') && !document.querySelector('.home-hero'));
 return out;
})()
