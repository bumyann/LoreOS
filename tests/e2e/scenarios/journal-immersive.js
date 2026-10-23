(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,240):'')); };
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const d0=normalizeJournal({}); const b1=newNotebook(d0,{title:'Celestalis'}); const b2=newNotebook(d0,{title:'Amaranthine'});
 const p1=newPage(d0,{notebook:b1,title:'One',content:'first page'}), p2=newPage(d0,{notebook:b1,title:'Two',content:'second page'}), p3=newPage(d0,{notebook:b1,title:'Three',content:'third page'});
 d0.activeNotebookId=b1; d0.activePageId=p1; nbSet(d0);
 chk('new pages go at the end of the notebook', model_order(d0,b1).join()===[p1,p2,p3].join());
 function model_order(d,b){ return orderedPages(d,b).map(p=>p.id); }
 // the default view is a setting
 setNbDefaultMode('immersive'); chk('default view is stored', nbDefaultMode()==='immersive' && nbMode()==='immersive');
 navigateTo('home'); await w(200); navigateTo('notebook'); await w(800);
 chk('the Journal opens as an open notebook by default', !!$('#nb-book-open') && !$('.nb-layout:not(.immersive)'));
 chk('both pages show page contents (two editors)', $$('.ProseMirror').length===2 && $('#nbTitleInput').value==='One' && $('#nbSecTitle').value==='Two', [$$('.ProseMirror').length]);
 chk('page numbers', $$('.nb-pgno').map(e=>e.textContent).join()==='page 1,page 2', $$('.nb-pgno').map(e=>e.textContent));
 chk('the sidebar is a bookmark, hidden until clicked', !!$('#nbBookmark') && getComputedStyle($('#nb-sidebar')).display==='none');
 $('#nbBookmark').click(); await w(200); chk('clicking the bookmark shows the contents', getComputedStyle($('#nb-sidebar')).display!=='none' && $$('.nb-page-item').length===3);
 $('.nb-page-item[data-nb-id="'+p3+'"]').click(); await w(800);
 chk('choosing a page opens its spread and closes the contents', getComputedStyle($('#nb-sidebar')).display==='none' && $('#nbTitleInput').value==='Three' && !$('#nbSecTitle') && /empty/.test($('#nb-second-inner').textContent), [$('#nbTitleInput').value]);
 // the other side prompts for a page
 $('#nbEmptyAdd').click(); await w(900);
 chk('an empty page offers to start one, which joins the spread', Object.keys(nbGet().pages).length===4 && $$('.ProseMirror').length===2, [Object.keys(nbGet().pages).length,$$('.ProseMirror').length,$('#nbTitleInput')&&$('#nbTitleInput').value,$('#nbSecTitle')&&$('#nbSecTitle').value,document.getElementById('nb-second-inner')&&document.getElementById('nb-second-inner').innerHTML.slice(0,100)]);
 // typing on the second page saves it
 const secId=secPage().id; secPage().editor.chain().focus('end').insertContent(' hello from the left page').run(); await w(2500);
 chk('the second page saves by itself', /hello from the left page/.test(nbGet().pages[secId].content), nbGet().pages[secId].content);
 // sticky notes on either page
 chk('a sticky note can go on the second page', newStickyHere(secId) && $$('#nbSecStickyLayer .nb-stk').length===1 && nbGet().pages[secId].stickies.length===1);
 // turning pages
 $('#nbPrevPage').click(); await w(900); chk('previous turns back to the earlier spread', $('#nbTitleInput').value==='One'||$('#nbSecTitle').value==='Two', [$('#nbTitleInput')&&$('#nbTitleInput').value]);
 $('#nbNextPage').click(); await w(900); chk('next turns forward', ($('#nbTitleInput')||{}).value==='Three'||($('#nbSecTitle')||{}).value==='Three');
 // closing the book shows every notebook on the desk
 $('#nbCloseBook').click(); await w(500);
 chk('closing shows all notebooks lying on the desk', $$('.nb-closed-book').length===2 && !!$('.nb-desk-scroll') && $('.nb-desk-scroll').scrollHeight>0);
 chk('the desk has things scattered on it', $$('.nb-desk-decor i').length>=12);
 chk('the buttons match the desk', !!$('.nb-deskbtn') && /rgb\(58, 62, 84\)/.test(getComputedStyle($('.nb-deskbtn')).backgroundColor), getComputedStyle($('.nb-deskbtn')).backgroundColor);
 $$('.nb-closed-book').find(b=>/Amaranthine/.test(b.textContent)).click(); await w(800);
 chk('clicking one opens it', !!$('#nb-book-open') && nbGet().activeNotebookId===b2 && $$('.nb-empty-page').length===2 && $$('.nb-book-open .nb-page').length===2);
 // switching views and the setting
 $('#nbModeBtn').click(); await w(600); chk('Normal view button switches', !!$('.nb-layout:not(.immersive)') && nbMode()==='normal');
 navigateTo('home'); await w(200); navigateTo('notebook'); await w(600); chk('a switch lasts for the session', !!$('.nb-layout:not(.immersive)'));
 openSettings(); await w(200); chk('Settings has the default view', !!$('#stgNbDefault') && $('#stgNbDefault').value==='immersive');
 $('#stgNbDefault').value='normal'; $('#stgNbDefault').dispatchEvent(new Event('change',{bubbles:true})); await w(150);
 chk('changing it stores the new default', nbDefaultMode()==='normal'); closeModal('settingsModal');
 setNbDefaultMode('normal');
 return out;
})()
