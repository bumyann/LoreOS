(async()=>{
 const o={fail:[]}; const w=ms=>new Promise(r=>setTimeout(r,ms)); const chk=(n,c,d)=>{ if(!c) o.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const key=(k,opts={})=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,...opts}));
 // --- mode-aware shortcuts
 navigateTo('editor'); switchMode('char'); await w(100);
 const loreBefore=Object.keys(lorebook.entries).length, chBefore=Object.keys(charLibrary).length;
 key('n',{ctrlKey:true}); await w(200);
 chk('ctrl+N in char mode makes a character not a lore entry', Object.keys(charLibrary).length===chBefore+1 && Object.keys(lorebook.entries).length===loreBefore, {chars:Object.keys(charLibrary).length,lore:Object.keys(lorebook.entries).length});
 const el=document.getElementById('chName'); el.value='Saved by shortcut'; el.dispatchEvent(new Event('input',{bubbles:true}));
 let toasts=()=>[...document.querySelectorAll('#notifs .notif')].map(n=>n.textContent);
 key('s',{ctrlKey:true}); await w(100);
 chk('ctrl+S saves the character', charLibrary[activeCharId].card.data.name==='Saved by shortcut', charLibrary[activeCharId].card.data.name);
 let cap=[]; const dlN=()=>__dl.map(d=>d.name);
 key('e',{ctrlKey:true}); await w(100); cap=dlN(); chk('ctrl+E exports the character, not a lorebook', cap.length===1 && /Saved by shortcut\.json$/.test(cap[0]), cap);
 switchMode('preset'); await w(100); const pb=Object.keys(presetLibrary).length; key('n',{ctrlKey:true}); await w(200); chk('ctrl+N in preset mode makes a preset',Object.keys(presetLibrary).length===pb+1);
 key('s',{ctrlKey:true}); await w(100); chk('ctrl+S in preset mode saves', toasts().some(t=>/Preset saved/.test(t)), toasts());
 switchMode('lore'); await w(100); const lb=Object.keys(lorebook.entries).length; key('n',{ctrlKey:true}); await w(200); chk('ctrl+N in lore mode makes an entry',Object.keys(lorebook.entries).length===lb+1);
 // F1 / ? open help, not search&replace
 key('F1'); chk('F1 opens help', document.getElementById('helpModal').classList.contains('open') && !document.getElementById('srModal').classList.contains('open')); closeModal('helpModal');
 // --- Escape
 openModal('helpModal'); key('Escape'); chk('Escape closes dialog', !document.getElementById('helpModal').classList.contains('open'));
 // escape on a confirm resolves false
 const p=askConfirm('sure?'); await w(50); key('Escape'); const res=await Promise.race([p,w(300).then(()=>'hung')]); chk('Escape cancels confirm', res===false, res); chk('confirm closed', !document.getElementById('confirmModal').classList.contains('open'));
 // stacked: confirm over history modal closes only the top one
 openItemHistory('char',activeCharId||Object.keys(charLibrary)[0]); await w(100); const p2=askConfirm('x'); await w(50); key('Escape'); await p2;
 chk('only top dialog closed', !!document.getElementById('itemHistoryModal') && !document.getElementById('confirmModal').classList.contains('open')); key('Escape'); chk('then history closes', !document.getElementById('itemHistoryModal'));
 // fullscreen editor exempt
 openModal('fullscreenModal'); key('Escape'); chk('fullscreen editor ignores Escape', document.getElementById('fullscreenModal').classList.contains('open')); closeModal('fullscreenModal');
 // dialog semantics + focus
 openModal('helpModal'); chk('role=dialog', document.getElementById('helpModal').getAttribute('role')==='dialog'&&document.getElementById('helpModal').getAttribute('aria-modal')==='true'); chk('focus moved into dialog', document.getElementById('helpModal').contains(document.activeElement));
 const trigger=document.getElementById('helpBtn'); closeModal('helpModal');
 // typing Escape in a text input with no dialog open does nothing harmful
 key('Escape');
 // --- filenames
 chk('jp name', safeFileName('日本語 🦊')==='日本語 🦊'); chk('forbidden chars', safeFileName('a/b:c*?"<>|')==='a_b_c______'||safeFileName('a/b:c*?"<>|').indexOf('/')<0, safeFileName('a/b:c*?"<>|'));
 chk('empty fallback', safeFileName('   ','x')==='x' && safeFileName(null,'y')==='y' && safeFileName('...hidden')==='hidden');
 chk('long', safeFileName('x'.repeat(300)).length===80);
 const dlBase=__dl.length; charLibrary.j={id:'j',name:'日本語 🦊',card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:'日本語 🦊',tags:[],alternate_greetings:[],extensions:{}}},savedAt:new Date().toISOString()};
 exportCharJson('j'); exportCharJsonV2('j'); await w(60); cap=__dl.slice(dlBase).map(d=>d.name); chk('char export names', cap.join()==='日本語 🦊.json,日本語 🦊_v2.json', cap);
 // --- home "New Preset" actually creates one
 navigateTo('home'); await w(100); localStorage.clear(); charLibrary={}; presetLibrary={}; lorebook={entries:{}}; renderHomeView(); await w(100);
 const pc=Object.keys(presetLibrary).length; [...document.querySelectorAll('.home-cta')].find(b=>/New Preset/.test(b.textContent)).click(); await w(400);
 chk('home New Preset creates a preset', Object.keys(presetLibrary).length===pc+1, Object.keys(presetLibrary).length);
 return o;
})()
