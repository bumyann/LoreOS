(async()=>{
 const o={fail:[]}; const chk=(n,c,d)=>{ if(!c) o.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 // ---- noun table: every word resolves to an entry that contains it
 NOUN_TABLE.forEach(row=>row.filter(Boolean).forEach(w=>{ const e=NOUN_MAP[w.toLowerCase()]; chk('exists '+w,!!e); if(e) chk('self '+w,[e.masc,e.fem,e.neutral].map(x=>x&&x.toLowerCase()).includes(w.toLowerCase()),e); }));
 const exp={ lady:['lord','lady',null], person:['man','woman','person'], people:['men','women','people'], parent:['father','mother','parent'], gentleman:['gentleman','lady','person'], ladies:['lords','ladies',null], dad:['dad','mom','parent'], man:['man','woman','person'], woman:['man','woman','person'], mom:['dad','mom','parent'] };
 Object.entries(exp).forEach(([w,[m,f,n]])=>{ const e=NOUN_MAP[w]; chk('row '+w, e&&e.masc===m&&e.fem===f&&(e.neutral||null)===n, e); });
 // ---- nouns convert via the UI path
 document.body.insertAdjacentHTML('beforeend','<div id="ptNounDisplay"></div><div id="ptManualDisplay"></div>');
 const nounConv=(text,tgt)=>{ PT_nounTgt=tgt; PT_nounTokens=tokenizeForNouns(text); renderNounDisplay(PT_nounTokens); document.querySelectorAll('#ptNounDisplay .pt-token').forEach(s=>s.click()); return getNounResult(PT_nounTokens); };
 o.nouns=[ nounConv('The person and the parent met a Lady.','masc'), nounConv('The brother and his father.','fem'), nounConv('The waitress, the actor.','neutral'), nounConv('Sir, the king.','fem') ];
 // ---- pronouns: click every token, all src/tgt combos
 const run=(src,tgt,text)=>{ PT.src=src; PT.tgt=tgt; PT.manualTokens=tokenizeForManual(text,src); renderManualDisplay(PT.manualTokens); // re-query each time: clicking re-renders
   const n=PT.manualTokens.filter(t=>t.type!=='text').length; for(let i=0;i<n;i++){ const spans=document.querySelectorAll('#ptManualDisplay .pt-token'); const sp=[...spans].find(x=>!x.className.includes('converted')); if(sp) sp.click(); } return getManualResult(PT.manualTokens); };
 o.p={
  he_macro: run('he','macro',"He took his book. The book is his. He told him that he's right, and he'll bring himself."),
  she_macro: run('she','macro',"She took her book. The book is hers. He met her. She's here; she'll stay and herself too."),
  they_macro: run('they','macro',"They are late and they don't know. Their friend told them. They're sure it's theirs. They've done it themselves."),
  he_to_she: run('he','she',"He took his book. The book is his. He told him."),
  she_to_he: run('she','he',"She took her book. The book is hers. I told her."),
  she_to_they: run('she','they',"She is late and she was told. Her friend gave it to her. It's hers."),
  they_to_he: run('they','he',"They are late and they don't know. Their friend told them."),
  he_to_they: run('he','they',"He is late and he doesn't know. His friend told him. He has it."),
 };
 return o;
})()
