(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 window.__x=0;
 const bad='<img src=x onerror="window.__x=1"><script>window.__x=2<\/script><a href="javascript:window.__x=3" id="jl">hi</a><svg onload="window.__x=4"></svg>';
 store.set('loreos_notebook',JSON.stringify({activePageId:'p1',pages:{p1:{id:'p1',title:'"><img src=x onerror=window.__x=5>',content:bad,html:bad,body:bad,updatedAt:new Date().toISOString()}}}));
 navigateTo('notebook'); await w(700);
 chk('no script ran', window.__x===0, window.__x);
 const ed=document.getElementById('nb-editor-inner');
 chk('no injected img/script/svg in DOM', !ed.querySelector('img[onerror],script,svg[onload]'));
 chk('no javascript: link', ![...document.querySelectorAll('#notebook-content a')].some(a=>/^javascript:/i.test(a.getAttribute('href')||'')));
 chk('title attr safe', !document.querySelector('#nb-page-list img'));
 out.ok=true; return out;
})()
