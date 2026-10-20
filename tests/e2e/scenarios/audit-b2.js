(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 lorebook={name:'sr',entries:rebuildEntries({0:{comment:'N',content:'a a a',key:['a1','a2']},1:{comment:'M',content:'x',key:['za']}})}; nextUid=2; navigateTo('editor'); switchMode('lore'); renderList();
 const set=(id,v)=>{ const e=document.getElementById(id); if(e.type==='checkbox') e.checked=v; else e.value=v; };
 set('srFind','a'); set('srReplace','b'); set('srScope','content'); set('srCase',true);
 doSearch(); chk('3 matches',searchResults.length===3);
 searchIdx=1; doReplaceOne(); await w(50); chk('replaced the 2nd occurrence only', lorebook.entries[0].content==='a b a', lorebook.entries[0].content); chk('re-searched', searchResults.length===2);
 searchIdx=1; doReplaceOne(); await w(50); chk('then the 3rd (now 2nd)', lorebook.entries[0].content==='a b b', lorebook.entries[0].content);
 // keywords
 set('srScope','keywords'); set('srFind','a'); set('srReplace','Q'); doSearch(); chk('kw matches', searchResults.length===3, searchResults.map(r=>r.field+':'+r.matchText).join()); // a1,a2 (primary joined), za
 searchIdx=1; doReplaceOne(); await w(50); chk('kw nth replaced (a2)', JSON.stringify(lorebook.entries[0].key)==='["a1","Q2"]', lorebook.entries[0].key);
 // $& and $1 expansion in replaceOne
 set('srScope','names'); set('srRegex',true); set('srFind','(N)'); set('srReplace','[$1|$&|$$]'); doSearch(); doReplaceOne(); await w(50); chk('$-patterns expand', lorebook.entries[0].comment==='[N|N|$]', lorebook.entries[0].comment);
 // empty-match regex must not hang
 set('srFind','x*'); set('srScope','content'); const t0=performance.now(); doSearch(); chk('empty-match regex terminates', performance.now()-t0<2000);
 // replace all counts correct
 set('srRegex',false); set('srFind','b'); set('srReplace','c'); set('srScope','content'); doSearch(); const n0=searchResults.length; const p=doReplaceAll(); await w(60); document.getElementById('confirmOkBtn').click(); await p; chk('replace-all ok', !/b/.test(lorebook.entries[0].content), lorebook.entries[0].content);
 chk('toast count matches', [...document.querySelectorAll('#notifs .notif')].some(t=>new RegExp('Replaced '+n0+' ').test(t.textContent)), [n0,[...document.querySelectorAll('#notifs .notif')].map(t=>t.textContent)]);
 return out;
})()
