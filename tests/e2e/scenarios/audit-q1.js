// kv: ls
(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 // Pretend this browser only has ~1.2M characters of localStorage (like a tight iPad)
 const LIMIT=1200000; const realSet=Storage.prototype.setItem;
 const used=()=>{ let n=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); n+=k.length+(localStorage.getItem(k)||'').length; } return n; };
 Storage.prototype.setItem=function(k,v){ const old=this.getItem(k); const delta=(k.length+String(v).length)-(old===null?0:k.length+old.length); if(used()+delta>LIMIT){ const e=new Error('quota'); e.name='QuotaExceededError'; throw e; } return realSet.call(this,k,v); };
 const junk=n=>'x'.repeat(n);
 const open=async b=>{ openImportModal(b,'t'); await w(50); };
 // device already holds: some characters, a trash bin and three old backup snapshots
 localStorage.clear();
 store.set('aet_charLibrary',JSON.stringify({a:{id:'a',name:'Old',card:{data:{name:'Old',description:junk(50000)}},savedAt:'x'}}));
 store.set('aet_trash',JSON.stringify([{id:'t1',kind:'char',label:'x',at:'x',data:{d:junk(250000)}}]));
 store.set('aet_backup_history',JSON.stringify([{ts:'1',data:junk(250000)},{ts:'2',data:junk(250000)},{ts:'3',data:junk(250000)}]));
 // restoring ~700k of characters cannot fit until the bin and snapshots go
 const big={_version:'1',aet_charLibrary:JSON.stringify({b:{id:'b',name:'New',card:{data:{name:'New',description:junk(700000)}},savedAt:'y'}})};

 const huge={_version:'1',aet_charLibrary:JSON.stringify({z:{id:'z',card:{data:{description:junk(1300000)}}}})};
 await open(big); syncImportConfirm(); await w(150);
 chk('restore succeeded after making room', /"b"/.test(store.get('aet_charLibrary')||''), (store.get('aet_charLibrary')||'').length);
 chk('bin was cleared to make room', store.get('aet_trash')===null);
 // (2) impossible restore: bigger than the whole budget -> rolled back, clear message, libraries untouched
 document.getElementById('notifs').innerHTML='';
 await open(huge); const before=store.get('aet_charLibrary'); syncImportConfirm(); await w(200);
 chk('impossible restore changes nothing', store.get('aet_charLibrary')===before);
 chk('state unfrozen again', !state.restoringBackup);
 const msg=[...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent).join(' | ');
 chk('message explains the storage problem with numbers', /Not enough room/.test(msg) && /MB/.test(msg) && /fewer items|Settings/.test(msg), msg);
 // the note about what was cleared survives the reload that follows a restore
 chk('note saved for after the reload', /short on storage/.test(localStorage.getItem(NOTICE_KEY)||''), localStorage.getItem(NOTICE_KEY));
 document.getElementById('notifs').innerHTML=''; showPostRestoreNotice();
 chk('note shown once, then cleared', !!document.querySelector('#notifs .notif') && localStorage.getItem(NOTICE_KEY)===null);
 // (3) the snapshot budget: saving a snapshot never lets the history exceed its cap
 Storage.prototype.setItem=realSet; localStorage.clear();
 store.set('aet_charLibrary',JSON.stringify({a:{id:'a',name:'A',card:{data:{description:junk(400000)}},savedAt:'x'}}));
 for(let i=0;i<10;i++) historySave();
 const hist=store.get('aet_backup_history')||'';
 chk('backup snapshots stay under their budget', hist.length<=HISTORY_MAX_CHARS, hist.length);
 out.ok=true; return out;
})()
