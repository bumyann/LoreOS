(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 store.set('aet_meta','{}'); store.set('aet_library',JSON.stringify({L1:{name:'L1',lb:{entries:{}},savedAt:new Date().toISOString()},L2:{name:'L2',lb:{entries:{}},savedAt:new Date(Date.now()-1000).toISOString()}}));
 state.charLibrary={c1:{id:'c1',name:'Mira',card:{data:{name:'Mira'}},savedAt:new Date().toISOString()}};
 state.presetLibrary={p1:{id:'p1',name:'Pre',preset:{prompts:[]},savedAt:new Date().toISOString()}};
 state.promptLibrary={}; state.regexLibrary={r1:{id:'r1',name:'Rx',set:{scripts:[{id:'a'}]},savedAt:new Date().toISOString()}}; state.personaLibrary={};
 setLibraryLayout('shelves'); navigateTo('library'); await w(500);
 const shelves=()=>[...document.querySelectorAll('.libx-shelf')].map(s=>s.dataset.shelf);
 const booksOf=k=>[...document.querySelectorAll('.libx-shelf[data-shelf="'+k+'"] .libx-book .libx-name')].map(e=>e.textContent);
 chk('shelves in order, empty ones hidden', shelves().join()==='char,lore,preset,regex', shelves());
 chk('books stand on their shelf', booksOf('lore').sort().join()==='L1,L2' && booksOf('char').join()==='Mira' && booksOf('regex').join()==='Rx');
 chk('each shelf has a plate with its name and count', document.querySelector('.libx-shelf[data-shelf="lore"] .libx-plate').textContent.includes('Lorebooks') && document.querySelector('.libx-shelf[data-shelf="lore"] .libx-plate-n').textContent==='2');
 chk('books are not cards in a list', !document.querySelector('.libx-grid') && document.querySelectorAll('.libx-book').length===5);
 // favourites shelf on top, item also stays on its own shelf
 const book=n=>[...document.querySelectorAll('.libx-book')].find(b=>b.querySelector('.libx-name').textContent===n);
 book('Mira').querySelector('[data-act="pin"]').click(); await w(300);
 chk('favourites shelf comes first', shelves().join()==='pinned,char,lore,preset,regex', shelves());
 chk('a favourite also stays on its category shelf', booksOf('pinned').join()==='Mira' && booksOf('char').join()==='Mira');
 chk('pinned book is marked', !!document.querySelector('.libx-shelf[data-shelf="char"] .libx-book.pinned'));
 // filters
 document.querySelector('[data-type="lore"]').click(); await w(250);
 chk('type filter leaves one shelf', shelves().join()==='lore', shelves());
 document.querySelector('[data-type="all"]').click(); await w(250);
 type(document.getElementById('libxSearch'),'mira'); await w(400);
 chk('search groups results by shelf without a favourites shelf', shelves().join()==='char' && booksOf('char').join()==='Mira', shelves());
 type(document.getElementById('libxSearch'),''); await w(400);
 // click a book, details on a book
 book('L1').querySelector('[data-act="details"]').click(); await w(250);
 chk('details open from a book', document.getElementById('libxDetailModal').classList.contains('open') && document.getElementById('libxDetailTitle').textContent==='L1');
 document.getElementById('libxDetailDone').click(); await w(300);
 book('Pre').click(); await w(700);
 chk('clicking a book opens it in its editor', state.mode==='preset' && state.activePresetId==='p1', [state.mode,state.activePresetId]);
 navigateTo('library'); await w(400);
 // layout switch persists
 document.getElementById('libxLayoutList').click(); await w(300);
 chk('list layout shows cards, no shelves', document.querySelectorAll('.libx-shelf').length===0 && document.querySelectorAll('.libx-card').length>=5 && JSON.parse(localStorage.getItem('loreos_libview')).layout==='list');
 document.getElementById('libxLayoutShelves').click(); await w(300);
 chk('and back to shelves', document.querySelectorAll('.libx-shelf').length>=4 && JSON.parse(localStorage.getItem('loreos_libview')).layout==='shelves');
 // shelf groups with nothing at all
 setLibraryLayout('shelves'); store.set('aet_library','{}'); state.charLibrary={}; state.presetLibrary={}; state.regexLibrary={}; navigateTo('library'); await w(300); document.querySelector('[data-type="all"]').click(); await w(300);
 chk('empty library shows the welcome message, no shelves', document.querySelectorAll('.libx-shelf').length===0 && /nothing in your library yet/.test(document.getElementById('library-content').textContent));
 return out;
})()
