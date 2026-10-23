(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,240):'')); };
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const answer=async(text)=>{ await w(150); $('#renameModalInput').value=text; $('#renameOkBtn').click(); await w(250); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 store.set('loreos_notebook',JSON.stringify({pages:{o1:{id:'o1',title:'Old page',content:'moon notes',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}}}));
 state.homeData=undefined;
 navigateTo('notebook'); await w(600);
 // old pages land in one notebook called Journal
 chk('old pages are put in a notebook called Journal', nbGet().notebooks.bk_journal && nbGet().pages.o1.notebook==='bk_journal' && $$('.nb-book-title').map(e=>e.textContent).join()==='Journal');
 // make a second notebook
 $('#nbNewBookBtn').click(); await w(400);
 chk('a new notebook opens its overview', !!$('#nbBookTitle') && document.activeElement===$('#nbBookTitle'));
 type($('#nbBookTitle'),'Celestalis'); $('#nbBookTitle').dispatchEvent(new Event('change',{bubbles:true})); await w(300);
 const book2=nbGet().activeNotebookId; chk('it can be renamed', nbGet().notebooks[book2].title==='Celestalis' && $$('.nb-book-title').map(e=>e.textContent).includes('Celestalis'));
 // pages go in the open notebook
 $('#nbBookAdd2').click(); await w(300); $('[data-tpl=""]').click(); await w(600);
 type($('#nbTitleInput'),'Moon court'); $('#nbSaveBtn').click(); await w(300);
 const pg=nbGet().activePageId; chk('a page made inside the open notebook belongs to it', nbGet().pages[pg].notebook===book2);
 chk('breadcrumb starts at the notebook', /Celestalis/.test($('.nb-crumbs').textContent));
 $('#nbSubBtn').click(); await w(300); $('[data-tpl=""]').click(); await w(600); type($('#nbTitleInput'),'Silver queen'); $('#nbSaveBtn').click(); await w(300);
 const kid=nbGet().activePageId; chk('a subpage stays in the same notebook', nbGet().pages[kid].notebook===book2 && nbGet().pages[kid].parent===pg);
 // search finds notebooks and pages across notebooks
 type($('#nbSearch'),'moon'); await w(250);
 const hits=$$('.nb-result').map(b=>b.dataset.hit);
 chk('search spans notebooks: the old page (other notebook) and the new one', hits.includes('o1') && hits.includes(pg), hits);
 type($('#nbSearch'),'celest'); await w(250);
 chk('search finds a notebook by name', $$('.nb-result').some(b=>b.dataset.hitType==='notebook' && b.dataset.hit===book2));
 $('.nb-result[data-hit-type="notebook"]').click(); await w(300);
 chk('opening a result shows the notebook', !!$('#nbBookTitle') && nbGet().activeNotebookId===book2);
 type($('#nbSearch'),''); await w(200);
 // move a page between notebooks
 $(`.nb-page-item[data-nb-id="${pg}"]`).click(); await w(500); $('#nbMoveBtn').click(); await w(300);
 chk('the move list offers every notebook', $$('#nbMoveList .nb-move-book').length===2);
 $('#nbMoveList [data-book="bk_journal"]').click(); await w(500);
 chk('moving to another notebook takes the subpages along', nbGet().pages[pg].notebook==='bk_journal' && nbGet().pages[kid].notebook==='bk_journal' && nbGet().pages[pg].parent===null);
 // links: notebooks and pages are both linkable
 const cands=mentionCandidates('celest'); chk('@ finds a notebook', cands.some(c=>c.kind==='notebook'&&c.id===book2), cands);
 chk('@ finds a page', mentionCandidates('silver').some(c=>c.kind==='page'&&c.id===kid));
 chk('a notebook link is a link', parseMentionHref(mentionHref('notebook',book2)).kind==='notebook');
 openMention({kind:'notebook',id:book2}); await w(400); chk('clicking a notebook link opens it', !!$('#nbBookTitle') && nbGet().activeNotebookId===book2);
 openMention({kind:'page',id:kid}); await w(500); chk('clicking a page link opens it, in its notebook', nbGet().activePageId===kid && nbGet().activeNotebookId==='bk_journal');
 // library shows notebooks
 const rows=libraryRows().rows.filter(r=>r.kind==='notebook'); chk('the Library lists the notebooks', rows.length===2 && rows.some(r=>r.name==='Celestalis'), rows.map(r=>r.name));
 navigateTo('library'); await w(500);
 chk('and shows them on a shelf', !!$$('.libx-book').find(b=>/Celestalis/.test(b.textContent)));
 openLibraryItem(rows.find(r=>r.name==='Celestalis')); await w(600);
 chk('opening one goes to the Journal', $('#view-notebook').classList.contains('view-active') && nbGet().activeNotebookId===book2);
 // sticky notes: loose notes on a page
 nbOpenPage(kid); await w(500);
 chk('/ offers a sticky note', filterSlash(slashItems(),'sticky')[0].label==='Sticky note');
 chk('a new sticky note shows on the page', newStickyHere() && !!$('.nb-stk') && $$('.nb-stk').length===1);
 const sid=nbGet().pages[kid].stickies[0].id;
 $('.nb-stk-text').value='Remember the moon'; $('.nb-stk-text').dispatchEvent(new Event('input',{bubbles:true})); await w(900);
 chk('its text is saved with the page', nbGet().pages[kid].stickies[0].text==='Remember the moon');
 // move it by its strip
 { const bar=$('.nb-stk-bar'), r=bar.getBoundingClientRect(); const ev=(t,x,y)=>bar.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x,clientY:y,pointerId:1,button:0}));
   const x0=nbGet().pages[kid].stickies[0].x, y0=nbGet().pages[kid].stickies[0].y; ev('pointerdown',r.left+30,r.top+6); ev('pointermove',r.left-60,r.top+86); ev('pointerup',r.left-60,r.top+86); await w(200);
   const s1=nbGet().pages[kid].stickies[0]; chk('it can be dragged to a new place', Math.abs(s1.y-y0)>40 && s1.x!==x0, [x0,y0,s1.x,s1.y]);
   // lock: no more moving
   $('.nb-stk-lock').click(); await w(150); chk('lock keeps it in place', nbGet().pages[kid].stickies[0].locked===true && $('.nb-stk').classList.contains('locked'));
   const r2=$('.nb-stk-bar').getBoundingClientRect(); const bar2=$('.nb-stk-bar'); const ev2=(t,x,y)=>bar2.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x,clientY:y,pointerId:2,button:0}));
   ev2('pointerdown',r2.left+30,r2.top+6); ev2('pointermove',r2.left+200,r2.top+200); ev2('pointerup',r2.left+200,r2.top+200); await w(200);
   const s2=nbGet().pages[kid].stickies[0]; chk('a locked note does not move', s2.x===s1.x && s2.y===s1.y);
   $('.nb-stk-lock').click(); await w(150); chk('unlocking lets it move again', nbGet().pages[kid].stickies[0].locked===false); }
 const c0=$('.nb-stk').style.getPropertyValue('--sk'); $('.nb-stk-col').click(); await w(150); chk('colour changes', nbGet().pages[kid].stickies[0].color!==c0.trim() && nbGet().pages[kid].stickies[0].color===$('.nb-stk').style.getPropertyValue('--sk').trim());
 chk('the note looks like a note: paper corner and a corner x', getComputedStyle($('.nb-stk-paper')).clipPath!=='none' && !!$('.nb-stk-x'));
 nbOpenPage(pg); await w(300); nbOpenPage(kid); await w(500);
 chk('it is still there after leaving the page', $$('.nb-stk').length===1 && $('.nb-stk-text').value==='Remember the moon');
 $('.nb-stk-x').click(); await w(200); chk('the x deletes it', $$('.nb-stk').length===0 && !(nbGet().pages[kid].stickies||[]).length);
 // from the Inspiration board
 const home=homeGet(); const card=normalizeCard({id:homeId(),type:'note',title:'Moon idea',text:'A court that only meets at night. <b>x</b>',color:'#c47e9c',createdAt:new Date().toISOString()}); home.board.unshift(card); homeSet(home);
 const nBooks=Object.keys(nbGet().notebooks).length, nPages=Object.keys(nbGet().pages).length;
 await cardToJournal(card,'notebook'); await w(300);
 chk('a card can start a notebook', Object.keys(nbGet().notebooks).length===nBooks+1 && Object.values(nbGet().notebooks).some(b=>b.title==='Moon idea') && Object.keys(nbGet().pages).length===nPages+1);
 const mp=Object.values(nbGet().pages).find(p=>p.title==='Moon idea'); chk('with its text in the first page, html made harmless', /night/.test(mp.content) && /&lt;b>x/.test(mp.content) && !/<b>/.test(mp.content), mp.content);
 const p2=cardToJournal(card,'page'); await w(400); // two or more notebooks: asks where
 chk('a card can become a page, asking which notebook', !!$('[data-pick-book]')); $$('[data-pick-book]').find(b=>/Celestalis/.test(b.textContent)).click(); await p2; await w(300);
 chk('the page lands in the chosen notebook', Object.values(nbGet().pages).filter(p=>p.title==='Moon idea'&&p.notebook===book2).length===1);
 const p3=cardToJournal(card,'sticky'); await w(400);
 chk('a card can become a sticky note, asking which page', !!$('[data-pick-page]')); $(`[data-pick-page="${kid}"]`).click(); await p3; await w(700);
 chk('the sticky is added to that page', (nbGet().pages[kid].stickies||[]).some(x=>x.color==='#c47e9c' && /Moon idea/.test(x.text) && /night/.test(x.text)));
 chk('and the page opens with the note on it', nbGet().activePageId===kid && $('#view-notebook').classList.contains('view-active') && $$('.nb-stk').length===1 && $('.nb-stk').classList.contains('nb-stk-new'), [nbGet().activePageId===kid, $('#view-notebook').classList.contains('view-active'), $$('.nb-stk').length, $('.nb-stk')&&$('.nb-stk').className]);
 // the card editor has the buttons
 openCardEditor(card.id); await w(300); chk('the card editor offers Send to the Journal', $('#hbSendRow').style.display!=='none' && !!$('#hbToBook') && !!$('#hbToPage') && !!$('#hbToSticky'));
 $('#hbModal .modal-x').click(); await w(200);
 // deleting a notebook goes to Recently deleted and can be restored
 nbOpenBook(book2); await w(300); $('#nbBookDelete').click(); await w(300); $('#confirmOkBtn').click(); await w(500);
 chk('a deleted notebook (and its pages) is gone', !nbGet().notebooks[book2] && !Object.values(nbGet().pages).some(p=>p.notebook===book2));
 const t=JSON.parse(store.get('aet_trash')||'[]'); chk('and is in Recently deleted', JSON.stringify(t).includes('Celestalis'));
 const item=trashAll().find(x=>/Celestalis/.test(x.label||x.name||JSON.stringify(x))); 
 chk('restoring brings it back', (()=>{ try{ trashRestore(item.id); }catch(e){ return false; } return !!nbGet().notebooks[book2] || Object.values(nbGet().notebooks).some(b=>b.title==='Celestalis'); })());
 return out;
})()
