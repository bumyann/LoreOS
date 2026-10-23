(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,240):'')); };
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const d0=normalizeJournal({}); const bk=newNotebook(d0,{title:'Lore'}); const pid=newPage(d0,{notebook:bk,title:'Editor test',content:'First paragraph\n\nSecond paragraph\n\nThird paragraph'}); d0.activePageId=pid; nbSet(d0);
 navigateTo('notebook'); await w(700);
 chk('there is a formatting toolbar', !!$('.nb-toolbar') && $$('.nb-toolbar [data-tb]').length>=15);
 // bold via the toolbar
 _nbEditor.chain().focus().selectAll().run(); $('[data-tb="bold"]').click(); await w(150);
 chk('bold works from the toolbar and shows as on', _nbEditor.isActive('bold') && $('[data-tb="bold"]').classList.contains('on'));
 $('[data-tb="bold"]').click(); _nbEditor.chain().focus().setTextSelection(3).run(); await w(100);
 const sel=$('.nb-tb-block'); sel.value='2'; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(150);
 chk('block type menu makes a heading', _nbEditor.isActive('heading',{level:2}) && /^## /.test(_nbEditor.storage.markdown.getMarkdown()));
 sel.value='p'; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(100);
 $('[data-tb="bullet"]').click(); await w(150); chk('bullet list from the toolbar', _nbEditor.isActive('bulletList')); $('[data-tb="bullet"]').click(); await w(100);
 $('[data-tb="todo"]').click(); await w(150); chk('to-do from the toolbar', _nbEditor.isActive('taskList')); $('[data-tb="todo"]').click(); await w(100);
 $('[data-tb="undo"]').click(); await w(100);
 // handles on every block
 const nBlocks=_nbEditor.state.doc.childCount; chk('every block has a handle and a +', $$('.nb-blk-tools').length===nBlocks && $$('.nb-blk-grip[draggable="true"]').length===nBlocks, [$$('.nb-blk-tools').length,nBlocks]);
 // + adds a block below
 $$('.nb-blk-add')[0].click(); await w(200);
 chk('+ adds a block with a slash ready', _nbEditor.state.doc.childCount===nBlocks+1 && _nbEditor.state.doc.child(1).textContent==='/');
 _nbEditor.commands.setContent('One\n\nTwo\n\nThree'); await w(100);
 // moving a block with the keyboard
 _nbEditor.chain().focus().setTextSelection(_nbEditor.state.doc.child(0).nodeSize+2).run(); // inside "Two"
 _nbEditor.view.dom.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true})); await w(150);
 chk('Alt+Up moves a block up', _nbEditor.state.doc.child(0).textContent==='Two' && _nbEditor.state.doc.child(1).textContent==='One', _nbEditor.getText());
 _nbEditor.view.dom.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true})); await w(150);
 chk('Alt+Down moves it back', _nbEditor.state.doc.child(0).textContent==='One' && _nbEditor.state.doc.child(1).textContent==='Two');
 // dragging by the handle: the same drop ProseMirror does for any dragged block
 { const grip=$$('.nb-blk-grip')[2]; const dt=new DataTransfer(); grip.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt})); const had=!!_nbEditor.view.dragging;
   chk('dragging a handle picks the block up', had && _nbEditor.view.dragging.slice.content.firstChild.textContent==='Three'); _nbEditor.view.dragging=null; }
 // pictures
 const mk=()=>{ const cv=document.createElement('canvas'); cv.width=40; cv.height=30; cv.getContext('2d').fillStyle='#c33'; cv.getContext('2d').fillRect(0,0,40,30); return new Promise(r=>cv.toBlob(b=>r(new File([b],'red.png',{type:'image/png'}))));};
 const before=Object.keys(state.galleryLibrary).length; const n=await insertPictures(_nbEditor,[await mk()]); await w(500);
 chk('a picture is added to the Gallery and the page', n===1 && Object.keys(state.galleryLibrary).length===before+1 && !!$('.ProseMirror img.nb-img'));
 const md=_nbEditor.storage.markdown.getMarkdown(); chk('it is stored as a small link, not the picture itself', /!\[red\]\(loreos:\/\/image\/[^)]+\)/.test(md) && md.length<400, md);
 chk('and it really shows (resolved from the Gallery)', /^data:image\//.test($('.ProseMirror img.nb-img').getAttribute('src')));
 $('#nbSaveBtn').click(); await w(300); nbOpenBook(bk); await w(300); nbOpenPage(pid); await w(600);
 chk('the picture survives leaving and coming back', !!$('.ProseMirror img.nb-img') && /^data:image\//.test($('.ProseMirror img.nb-img').getAttribute('src')));
 chk('pasted web pictures are not turned into images', (()=>{ _nbEditor.commands.setContent('<p>x</p><img src="https://evil.example/p.png">'); return !_nbEditor.getHTML().includes('evil.example'); })());
 // covers
 chk('a page can have a cover: button is there', !!$('[data-cover="set"]'));
 $('[data-cover="set"]').click(); await w(250); chk('the cover chooser lists patterns', $$('.nb-cover-opt[data-preset]').length===COVER_PRESETS.length);
 $('.nb-cover-opt[data-preset="night"]').click(); await w(600);
 chk('choosing one saves it and shows it on the page', nbGet().pages[pid].cover.v==='night' && !!$('.nb-cover-wrap.has .nb-cv-night'));
 $('[data-cover="remove"]').click(); await w(500); chk('and it can be removed', !nbGet().pages[pid].cover && !$('.nb-cover-wrap.has'));
 nbOpenBook(bk); await w(300); $('[data-cover="set"]').click(); await w(250); $('.nb-cover-opt[data-preset="forest"]').click(); await w(500);
 chk('notebooks have covers too', nbGet().notebooks[bk].cover.v==='forest' && !!$('.nb-cover-wrap.has .nb-cv-forest'));
 return out;
})()
