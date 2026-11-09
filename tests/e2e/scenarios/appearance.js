(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,240):'')); };
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const pixelOn=()=>$$('link[data-pixel-css]').every(l=>l.media==='all'), pixelOff=()=>$$('link[data-pixel-css]').every(l=>l.media==='not all');
 chk('the two pixel stylesheets are marked', $$('link[data-pixel-css]').length===2);
 chk('pixel is the default appearance', appearance()==='pixel' && pixelOn() && document.documentElement.dataset.appearance==='pixel');
 // a notebook to look at
 const d0=normalizeJournal({}); const b1=newNotebook(d0,{title:'Celestalis'}); const p1=newPage(d0,{notebook:b1,title:'One',content:'first page'}); d0.activeNotebookId=b1; d0.activePageId=p1; nbSet(d0);
 setNbDefaultMode('immersive');
 navigateTo('notebook'); await w(700); chk('pixel: the Journal opens as a notebook on a desk', !!$('#nb-book-open'));
 // the picker lives in the Theme tab
 navigateTo('theme'); await w(500);
 chk('the Theme page has an Appearance picker', !!$('#thAppearance [data-appearance="standard"]') && $('#thAppearance [data-appearance="pixel"]').classList.contains('on'));
 const dark0=getComputedStyle(document.body).getPropertyValue('--p'), pink0=document.body.classList.contains('pink');
 $('#thAppearance [data-appearance="standard"]').click(); await w(200);
 chk('standard: pixel stylesheets switched off, attribute set, choice stored', appearance()==='standard' && pixelOff() && document.documentElement.dataset.appearance==='standard' && localStorage.getItem('loreos_appearance')==='standard');
 chk('standard: the picker shows the choice', $('#thAppearance [data-appearance="standard"]').classList.contains('on') && !$('#thAppearance [data-appearance="pixel"]').classList.contains('on'));
 chk('the theme is untouched by an appearance change', getComputedStyle(document.body).getPropertyValue('--p')===dark0 && document.body.classList.contains('pink')===pink0);
 navigateTo('notebook'); await w(700);
 chk('standard: the Journal is the normal view even with immersive as the default', !$('#nb-book-open') && !!$('.nb-layout:not(.immersive)') && nbMode()==='normal');
 chk('standard: no Immersive button offered', !$('#nbModeBtn'));
 navigateTo('library'); await w(500);
 chk('standard: library spines hidden', $$('.libx-spine').every(s=>getComputedStyle(s).display==='none'));
 // icons keep their size without the pixel stylesheet
 const px=$('.px'); chk('standard: pixel icons keep their size', !px || px.getBoundingClientRect().width<=64, px&&px.getBoundingClientRect().width);
 // and back
 navigateTo('theme'); await w(400); $('#thAppearance [data-appearance="pixel"]').click(); await w(200);
 chk('pixel again: stylesheets back on', appearance()==='pixel' && pixelOn() && document.documentElement.dataset.appearance==='pixel');
 navigateTo('notebook'); await w(700); chk('pixel again: the notebook on the desk is back', !!$('#nb-book-open'));
 setNbDefaultMode('normal'); localStorage.removeItem('loreos_appearance');
 return out;
})()
