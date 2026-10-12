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
 // a user with only a board still sees the dashboard
 state.charLibrary={}; navigateTo('home'); renderHomeView(); await w(300);
 chk('board alone is enough for the dashboard', !!document.getElementById('homeBoard') && !document.querySelector('.home-hero'));
 return out;
})()
