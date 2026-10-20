(async()=>{
 const out={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 navigateTo('notebook'); await w(200);
 nbNewPage(); await w(300);
 _nbEditor.commands.insertContent('typed text that is not yet saved');
 await w(100);
 navigateTo('home'); await w(100);
 navigateTo('notebook'); await w(2500);
 const d=nbGet(); out.pages=Object.values(d.pages).map(p=>p.content);
 out.editorText = _nbEditor && _nbEditor.getText();
 return out;
})()
