(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 lorebook={name:'sr',entries:rebuildEntries({0:{comment:'Alpha foo',content:'foo and foo again',key:['foo','bar']},1:{comment:'Beta',content:'nothing here',key:['x']},2:{comment:'Gamma',content:'FOO caps',key:['y']}})}; nextUid=3;
 navigateTo('editor'); switchMode('lore'); renderList(); openInTab(0); await w(200);
 // user typed something unsaved in the open entry
 const ta=document.getElementById('eContent-0'); ta.value='foo and foo again PLUS typed'; ta.dispatchEvent(new Event('input',{bubbles:true}));
 const set=(id,v)=>{ const e=document.getElementById(id); if(e.type==='checkbox') e.checked=v; else e.value=v; };
 set('srFind','foo'); set('srReplace','baz'); set('srScope','all'); set('srCase',false); set('srWhole',false); set('srRegex',false);
 doSearch(); chk('search finds across fields (content x3+, name, keyword)', searchResults.length>=5, searchResults.length);
 // search should see the text the user typed (not stale)
 chk('search sees unsaved typed text', searchResults.some(r=>/PLUS typed/.test(r.fullText)));
 // replace one
 doReplaceOne(); await w(100);
 // replace all
 const p=doReplaceAll(); await w(100); document.getElementById('confirmOkBtn').click(); await p; await w(300);
 chk('data replaced everywhere', JSON.stringify(Object.values(lorebook.entries).map(e=>[e.comment,e.content,e.key.join()])).indexOf('foo')===-1&&!/foo/i.test(lorebook.entries[2].content), JSON.stringify(Object.values(lorebook.entries).map(e=>[e.comment,e.content,e.key.join()])));
 chk('typed text kept', /PLUS typed/.test(lorebook.entries[0].content), lorebook.entries[0].content);
 // editor shows replaced text, not the stale form
 const shown=document.getElementById('eContent-0')?.value; chk('open editor shows replacement', shown&&!/foo/i.test(shown)&&/baz/.test(shown), shown);
 // autosave must not undo it
 await w(1800); chk('autosave does not revert replacement', !/foo/i.test(lorebook.entries[0].content), lorebook.entries[0].content);
 // persisted
 chk('persisted to storage', !/foo/i.test(localStorage.aet_lorebook), (localStorage.aet_lorebook||'').slice(0,80));
 chk('no stale unsaved marks', unsaved.size===0, [...unsaved]);
 // regex + groups
 set('srFind','(ba)(z)'); set('srRegex',true); set('srReplace','$2$1'); doSearch(); const p2=doReplaceAll(); await w(100); document.getElementById('confirmOkBtn').click(); await p2; await w(200);
 chk('regex groups replace', /zba/.test(lorebook.entries[1].content+lorebook.entries[0].content), lorebook.entries[0].content);
 // invalid regex doesn't throw
 set('srFind','(unclosed'); doSearch(); chk('invalid regex handled', true);
 // unicode whole word
 lorebook.entries[1].content='日本語 テスト'; set('srRegex',false); set('srWhole',true); set('srFind','日本語'); doSearch(); chk('whole-word works for non-latin', searchResults.length===1, searchResults.length);
 return out;
})()
