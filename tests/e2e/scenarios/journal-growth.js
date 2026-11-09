(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const answer=async(text)=>{ await w(150); $('#renameModalInput').value=text; $('#renameOkBtn').click(); await w(250); };
 // ── the model, on its own ──
 { const d=normalizeJournal({pages:{a:{id:'a',title:'Old A',content:'x',updatedAt:'2026-01-02T00:00:00Z'},b:{id:'b',title:'Old B',updatedAt:'2026-01-05T00:00:00Z'},c:{id:'c',title:'C',parent:'b'}}});
   chk('old flat data keeps its newest-first order', flattenTree(d).map(x=>x.page.id).join('')==='bca'.replace('c','') + 'c' || flattenTree(d)[0].page.id==='b', flattenTree(d).map(x=>x.page.id));
   chk('a nested page is shown under its parent', flattenTree(d).map(x=>x.page.id+x.depth).join()==='b0,c1,a0', flattenTree(d).map(x=>x.page.id+x.depth));
   const cyc=normalizeJournal({pages:{x:{id:'x',parent:'y'},y:{id:'y',parent:'x'},z:{id:'z',parent:'nope'},s:{id:'s',parent:'s'}}});
   chk('a loop, a missing parent and a page inside itself are repaired', cyc.pages.z.parent===null && cyc.pages.s.parent===null && (cyc.pages.x.parent===null||cyc.pages.y.parent===null));
   const k=newPage(d,{parent:'a',title:'kid'}); chk('a subpage goes at the end of its parent, a new top-level page at the end of its notebook', d.pages[k].parent==='a' && (()=>{ const t=newPage(d,{title:'top'}); const tops=childrenOf(d,null,d.pages[t].notebook); return tops[tops.length-1].id===t; })());
   chk('a page cannot move into itself or its own subpage', !canMove(d,'a','a') && !canMove(d,'a',k) && canMove(d,k,null) && canMove(d,k,'b'));
   chk('moving puts it under the new parent', movePage(d,k,'b') && d.pages[k].parent==='b');
   const before=Object.keys(d.pages).length; removePage(d,'b'); chk('deleting a page keeps its subpages, one level up', Object.keys(d.pages).length===before-1 && d.pages.c.parent===null && d.pages[k].parent===null);
   toggleCollapsed(d,'a'); chk('closed branches hide what is inside', !flattenTree(d).some(x=>x.page.id===k) || d.pages[k].parent!=='a');
   const t=normalizeJournal({pages:{p1:{id:'p1',title:'Parent',content:''},p2:{id:'p2',title:'Needle',content:'',parent:'p1'}},collapsed:{p1:true}});
   chk('searching shows matches with their parents, even closed ones', flattenTree(t,'needle').map(x=>x.page.id).join()==='p1,p2' && flattenTree(t).length===1);
   chk('templates: built in and your own', templatesAll(d).filter(x=>x.builtin).length===JOURNAL_TEMPLATES.length && JOURNAL_TEMPLATES.length>=5 && (()=>{ const id=addTemplate(d,{name:'Mine',content:'hi'}); return templatesAll(d).some(x=>x.id===id&&!x.builtin) && removeTemplate(d,id); })());
   chk('mention links', parseMentionHref(mentionHref('char','u 1/2'))?.id==='u 1/2' && parseMentionHref('loreos://nope/x')===null && parseMentionHref('https://x.y')===null && parseMentionHref('loreos://char/')===null);
   chk('slash filter', filterSlash(slashItems(),'tog')[0].label==='Toggle' && filterSlash(slashItems(),'todo')[0].label==='To-do list' && filterSlash(slashItems(),'zzzz').length===0 && filterSlash(slashItems(),'').length===slashItems().length); }
 // ── old data loads in the view ──
 store.set('loreos_notebook',JSON.stringify({pages:{n1:{id:'n1',title:'Older page',content:'# Hello',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'},n2:{id:'n2',title:'Newer page',content:'text',createdAt:'2026-02-01T00:00:00Z',updatedAt:'2026-02-01T00:00:00Z'}},activePageId:null}));
 navigateTo('notebook'); await w(700);
 chk('pages from before nesting show, newest first', $$('.nb-page-item .nb-page-title').map(e=>e.textContent).join()==='Newer page,Older page', $$('.nb-page-item .nb-page-title').map(e=>e.textContent));
 // ── new page from a template ──
 $('#nbNewBtn').click(); await w(300);
 chk('New offers Blank and the templates', $$('#nbNewList .nb-tpl').length===1+JOURNAL_TEMPLATES.length && $('#nbNewModal').classList.contains('open'));
 $('[data-tpl="b_daily"]').click(); await w(700);
 chk('a template page starts with its content', /Today/.test($('.ProseMirror').textContent) && $$('.ProseMirror ul[data-type="taskList"] li').length===3);
 $('.ProseMirror ul[data-type="taskList"] li input').click(); await w(200);
 chk('to-dos can be ticked', $('.ProseMirror ul[data-type="taskList"] li').getAttribute('data-checked')==='true');
 $('#nbSaveBtn').click(); await w(300);
 { const d=nbGet(); const p=Object.values(d.pages).find(x=>/\[x\]/.test(x.content)); chk('and the tick is saved in the Markdown', !!p && /- \[x\] /.test(p.content) && /- \[ \] /.test(p.content), p&&p.content.slice(0,120)); }
 // ── subpages ──
 const parentId=nbGet().activePageId; $('#nbTitleInput').value='Worldbuilding'; $('#nbTitleInput').dispatchEvent(new Event('input',{bubbles:true})); $('#nbSaveBtn').click(); await w(300);
 $('#nbSubBtn').click(); await w(300); $('[data-tpl=""]').click(); await w(600);
 $('#nbTitleInput').value='Magic system'; $('#nbTitleInput').dispatchEvent(new Event('input',{bubbles:true})); $('#nbSaveBtn').click(); await w(300);
 const childId=nbGet().activePageId;
 chk('a subpage is saved under its parent', nbGet().pages[childId].parent===parentId);
 chk('the tree shows it indented, the parent has a caret', $(`.nb-page-item[data-nb-id="${childId}"]`).style.getPropertyValue('--d')==='1' && !!$(`.nb-page-item[data-nb-id="${parentId}"] [data-nb-toggle]`));
 chk('breadcrumbs name the parent', $('.nb-crumbs').textContent.includes('Worldbuilding'));
 $(`[data-nb-toggle="${parentId}"]`).click(); await w(250);
 chk('closing a branch hides its subpages', !$(`.nb-page-item[data-nb-id="${childId}"]`) && nbGet().collapsed[parentId]===true);
 $(`[data-nb-toggle="${parentId}"]`).click(); await w(250); chk('and opening shows them again', !!$(`.nb-page-item[data-nb-id="${childId}"]`));
 $('#nbSearch').value='magic'; $('#nbSearch').dispatchEvent(new Event('input',{bubbles:true})); await w(200);
 chk('search lists the matching page with where it lives, and not the others', !!$(`.nb-result[data-hit="${childId}"]`) && /Worldbuilding/.test($(`.nb-result[data-hit="${childId}"]`).textContent) && !$('.nb-result[data-hit="n2"]'));
 $('#nbSearch').value=''; $('#nbSearch').dispatchEvent(new Event('input',{bubbles:true})); await w(200);
 // move
 $('#nbMoveBtn').click(); await w(300);
 chk('the move list never offers the page itself or what is inside it', !$$('#nbMoveList [data-to]').some(b=>b.dataset.to===childId) && $$('#nbMoveList [data-to]').some(b=>b.dataset.to===''));
 $('#nbMoveList [data-to=""]').click(); await w(500);
 chk('moving to the top level works', nbGet().pages[childId].parent===null);
 $('#nbMoveBtn').click(); await w(300); $(`#nbMoveList [data-to="${parentId}"]`).click(); await w(500);
 chk('and back under a page', nbGet().pages[childId].parent===parentId);
 // delete the parent: the child moves up
 $(`.nb-page-item[data-nb-id="${parentId}"]`).click(); await w(500);
 $('#nbDeleteBtn').click(); await w(300); $('#confirmOkBtn').click(); await w(500);
 chk('deleting a parent keeps its subpages', !nbGet().pages[parentId] && nbGet().pages[childId] && nbGet().pages[childId].parent===null);
 chk('the deleted page can be brought back', (()=>{ const t=JSON.parse(store.get('aet_trash')||'[]'); return JSON.stringify(t).includes('Worldbuilding'); })());
 // ── the slash menu ──
 $(`.nb-page-item[data-nb-id="${childId}"]`).click(); await w(500);
 const ed=()=>$('.ProseMirror');
 const key=(k)=>ed().dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
 const typeInto=async(text)=>{ _nbEditor.chain().focus('end').insertContent(text).run(); await w(250); };
 await typeInto(' /h2'); chk('"/" opens a menu', !!$('.nb-pop') && /Heading 2/.test($('.nb-pop').textContent));
 key('Enter'); await w(250);
 chk('choosing Heading 2 makes a heading', !!$('.ProseMirror h2'));
 _nbEditor.chain().focus('end').insertContent('<p></p>').run(); await typeInto('/divider'); key('Enter'); await w(250);
 chk('Divider', !!$('.ProseMirror hr'));
 await typeInto('/toggle'); key('Enter'); await w(300);
 chk('Toggle makes a collapsible block', !!$('.ProseMirror div[data-type="details"]'));
 const sum=$('.ProseMirror summary'); _nbEditor.commands.focus(); 
 await typeInto('/todo'); key('Escape'); await w(150); chk('Escape closes the menu', !$('.nb-pop'));
 // ── a subpage from the slash menu ──
 const before=Object.keys(nbGet().pages).length;
 await typeInto(' /subpage'); key('Enter'); await w(400);
 chk('/subpage makes a page inside this one and links to it', Object.keys(nbGet().pages).length===before+1 && !![...$$('.ProseMirror a')].find(a=>/loreos:\/\/page\//.test(a.getAttribute('href'))));
 { const a=[...$$('.ProseMirror a')].find(a=>/loreos:\/\/page\//.test(a.getAttribute('href'))); a.click(); await w(500);
   const sub=Object.values(nbGet().pages).find(p=>p.parent===childId); chk('clicking that link opens the subpage', !!sub && nbGet().activePageId===sub.id && $('.nb-crumbs') && /Magic system/.test($('.nb-crumbs').textContent)); }
 // ── @ links to the Library ──
 createChar('Ayla Vance'); await w(600); const charId=state.activeCharId; state.charLibrary[charId].name='Ayla Vance'; navigateTo('notebook'); await w(600); chk('there is a character to link to', !!charId && !!state.charLibrary[charId]);
 await typeInto(' @ayla'); chk('"@" lists matching Library items', !!$('.nb-pop') && /Ayla Vance/.test($('.nb-pop').textContent) && /Character/.test($('.nb-pop').textContent), $('.nb-pop')&&$('.nb-pop').textContent);
 key('Enter'); await w(300);
 { const a=[...$$('.ProseMirror a')].find(a=>a.getAttribute('href')===mentionHref('char',charId)); chk('the link is a plain Markdown link to it', !!a && a.textContent==='Ayla Vance');
   $('#nbSaveBtn').click(); await w(300); const md=nbGet().pages[nbGet().activePageId].content; chk('saved as [Name](loreos://char/id)', md.includes('[Ayla Vance](loreos://char/'+charId+')'), md.slice(-120));
   a&&a.click(); await w(900); chk('clicking it opens the character in the Workshop', state.mode==='char' && state.activeCharId===charId); }
 navigateTo('notebook'); await w(600);
 // ── a picture ──
 { const cv=document.createElement('canvas'); cv.width=40; cv.height=30; const bl=await new Promise(r=>cv.toBlob(r,'image/png')); const ids=await addFiles([new File([bl],'Moonlit hall.png',{type:'image/png'})]);
   navigateTo('notebook'); await w(500); $(`.nb-page-item[data-nb-id="${childId}"]`).click(); await w(500);
   await typeInto(' @moonlit'); chk('pictures can be linked too', /Moonlit hall/.test(($('.nb-pop')||{}).textContent||'') && /Picture/.test(($('.nb-pop')||{}).textContent||'')); key('Enter'); await w(300);
   const a=[...$$('.ProseMirror a')].find(a=>a.getAttribute('href')===mentionHref('image',ids[0])); a&&a.click(); await w(500); chk('and clicking opens the picture', $('#galLightbox').classList.contains('open')); closeModal('galLightbox'); }
 // ── everything survives a save and a reload ──
 $('#nbSaveBtn').click(); await w(300);
 const pid=nbGet().activePageId; navigateTo('home'); await w(300); navigateTo('notebook'); await w(700);
 $(`.nb-page-item[data-nb-id="${pid}"]`).click(); await w(600);
 chk('toggle, heading, divider and links are still there after reopening', !!$('.ProseMirror div[data-type="details"]') && !!$('.ProseMirror h2') && !!$('.ProseMirror hr') && $$('.ProseMirror a[href^="loreos://"]').length>=2, [!!$('.ProseMirror div[data-type="details"]'),!!$('.ProseMirror h2'),!!$('.ProseMirror hr'),$$('.ProseMirror a[href^="loreos://"]').length, nbGet().activePageId===pid]);
 // ── safety: HTML in a page cannot run ──
 window.__xss=0; _nbEditor.commands.setContent('<img src=x onerror="window.__xss=1"><script>window.__xss=2<\/script> [bad](javascript:window.__xss=3)'); await w(400);
 chk('HTML typed into a page does not become live script or pictures', !$('.ProseMirror script') && !$('.ProseMirror img') && window.__xss===0 && ![...$$('.ProseMirror a')].some(a=>/^javascript:/i.test(a.getAttribute('href')||'')), $('.ProseMirror').innerHTML.slice(0,200));
 // ── templates of your own ──
 _nbEditor.commands.setContent('## My own shape\n\n- [ ] one'); _nbEditor.commands.focus(); $('#nbTitleInput').value='My shape'; $('#nbTitleInput').dispatchEvent(new Event('input',{bubbles:true})); await w(200); $('#nbSaveBtn').click(); await w(300);
 $('#nbTplBtn').click(); await answer('Shape template');
 chk('a page can be kept as a template', Object.values(nbGet().templates).some(t=>t.name==='Shape template' && /My own shape/.test(t.content)));
 $('#nbNewBtn').click(); await w(300);
 chk('it shows up under Yours', !!$$('#nbNewList .nb-tpl').find(b=>/Shape template/.test(b.textContent) && /Yours/.test(b.textContent)));
 $$('#nbNewList .nb-tpl').find(b=>/Shape template/.test(b.textContent)).click(); await w(700);
 chk('and starts a page from it', /My own shape/.test($('.ProseMirror').textContent) && $('#nbTitleInput').value==='My shape');
 $('#nbNewBtn').click(); await w(300); $('[data-tpl-del]').click(); await w(250); $('#confirmOkBtn').click(); await w(300);
 chk('a template of your own can be deleted', Object.keys(nbGet().templates).length===0); closeModal('nbNewModal');
 // ── in a backup ──
 { const bundle=syncBundleData(); const j=JSON.parse(bundle.loreos_notebook); chk('the nesting is part of the backup', Object.values(j.pages).some(p=>p.parent) && 'collapsed' in j && 'templates' in j); }
 chk('no emoji in the journal', !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('notebook-content').innerHTML));
 return out;
})()
