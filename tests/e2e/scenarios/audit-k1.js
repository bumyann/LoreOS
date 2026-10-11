(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 createChar(); await w(100);
 document.getElementById('cName') && (document.getElementById('cName').value='RT Char');
 try{ saveChar({silent:true}); }catch(e){}
 localStorage.setItem('loreos_notebook',JSON.stringify({activePageId:'p1',pages:{p1:{id:'p1',title:'T',content:'<p>x</p>',updatedAt:'2026-01-01'}}}));
 localStorage.setItem('aet_theme','dark');
 const b=syncBundleData(); const snap={}; Object.keys(b).forEach(k=>{ if(k[0]!=='_') snap[k]=b[k]; });
 chk('bundle has keys', Object.keys(snap).length>=3, Object.keys(snap));
 // JSON file import path
 syncExport(); const f=await dl(); const parsed=JSON.parse(f.text);
 chk('export parses', parsed._version==='1');
 Object.keys(snap).forEach(k=>localStorage.removeItem(k));
 const file=new File([f.text],'b.json'); syncImportFile(file); await w(300);
 chk('modal open', !!document.getElementById('syncImportChecks')?.querySelector('input'));
 // restore without reload
 syncRestoreKeys(parsed,Object.keys(snap));
 const bad=Object.keys(snap).filter(k=>localStorage.getItem(k)!==snap[k]);
 chk('roundtrip identical', bad.length===0, bad);
 // hostile
 syncImportFile(new File(['{"_version":"1","__proto__":{"x":1},"aet_lorebook":"{not json"}'],'h.json')); await w(200);
 chk('proto not polluted', ({}).x===undefined);
 out.keys=Object.keys(snap); return out;
})()
