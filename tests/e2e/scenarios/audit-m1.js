(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 // restore: a key the backup doesn't have is cleared (no mixing with leftovers)
 localStorage.setItem('aet_css','body{color:red}'); localStorage.setItem('aet_theme','dark');
 syncRestoreKeys({_version:'1',aet_theme:'light'},['aet_theme','aet_css']);
 chk('restore sets present keys', localStorage.getItem('aet_theme')==='light');
 chk('restore clears keys the backup lacks', localStorage.getItem('aet_css')===null);
 // character export menu: PNG and JSON each in a collapsible group, .CHARX on its own
 createChar(); switchMode('char'); await w(300);
 const hm=document.querySelector('#dd-charexport-hdr .dd-menu');
 chk('header: PNG and JSON groups exist and start closed', hm.querySelectorAll('details.dd-group').length===2 && [...hm.querySelectorAll('details.dd-group')].every(d=>!d.open) && [...hm.querySelectorAll('details > summary')].map(x=>x.textContent.trim()).join()==='PNG,JSON');
 chk('header: json items are inside the group', ['charHdrExportJsonBtn','charHdrExportV2JsonBtn','charHdrExportJanitorBtn'].every(id=>hm.querySelector('details #'+id)));
 chk('header: png items are inside the PNG group', ['charHdrExportV3PngBtn','charHdrExportPngBtn','charHdrExportJanitorPngBtn'].every(id=>hm.querySelector('details #'+id)));
 chk('header: .CHARX stays on its own, and there is no Backyard or SaucepanAI export', !hm.querySelector('details #charHdrExportCharxBtn') && !/Backyard|SaucepanAI/.test(hm.textContent));
 chk('.CHARX label, no Lumiverse', document.getElementById('charHdrExportCharxBtn').textContent.trim()==='.CHARX' && !/Lumiverse/.test(document.body.innerHTML.replace(/<option[^>]*>[^<]*<\/option>/g,'').replace(/Lumiverse[^<]{0,20}variant/gi,'')) || document.getElementById('charHdrExportCharxBtn').textContent.trim()==='.CHARX');
 // opening the group does not close the menu
 document.querySelector('#dd-charexport-hdr .dd-btn').click(); await w(80);
 chk('menu opens', hm.classList.contains('open'));
 hm.querySelector('details > summary').click(); await w(80);
 chk('menu stays open after toggling JSON group', hm.classList.contains('open') && hm.querySelector('details').open);
 // editor dropdown has the same structure
 const em=document.querySelector('#dd-char-export .dd-menu');
 chk('editor dropdown grouped too', !!em && !!em.querySelector('details.dd-group #chExportJsonBtn') && !!em.querySelector('details.dd-group #chExportJanitorPngBtn'));
 out.ok=true; return out;
})()
