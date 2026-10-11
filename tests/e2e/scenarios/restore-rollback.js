// kv: ls
(async()=>{
 const o={}; const w=ms=>new Promise(r=>setTimeout(r,ms));
 createChar(); await w(150);
 saveCharLibrary(); const before=store.get('aet_charLibrary');
 store.set('aet_presetLibrary','{"keep":1}');
 // force the 2nd write to throw (quota) mid-restore
 const real=Storage.prototype.setItem; let n=0;
 Storage.prototype.setItem=function(k,v){ if(k==='aet_presetLibrary'&&v.includes('NEW')){ throw new DOMException('full','QuotaExceededError'); } return real.call(this,k,v); };
 openImportModal({_version:'1',aet_charLibrary:'{"X":1}',aet_presetLibrary:'{"NEW":1}'},'t');
 await syncImportConfirm();
 Storage.prototype.setItem=real;
 o.charsRolledBack = store.get('aet_charLibrary')===before;
 o.presetsRolledBack = store.get('aet_presetLibrary')==='{"keep":1}';
 o.flagReset = restoringBackup===false;
 // normal saves work again
 o.saveWorks = saveCharLibrary();
 return o;
})()
