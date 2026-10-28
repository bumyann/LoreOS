(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 // a card written on Windows: every line ends in \r\n (the way real cards from other tools often are)
 const card={spec:'chara_card_v3',spec_version:'3.0',data:{name:'Eol',description:'line one\r\nline two\r\n\r\nline three',personality:'p1\r\np2',scenario:'',first_mes:'hello\r\nthere',mes_example:'',creator_notes:'',system_prompt:'',post_history_instructions:'',tags:[],alternate_greetings:['alt\r\none','plain alt'],character_book:{name:'b',entries:[],extensions:{}},extensions:{}}};
 importCharCard(card,'eol.json'); await w(500);
 const dl=()=>{ const o=URL.createObjectURL; let blob; URL.createObjectURL=b=>{blob=b;return o(b)}; return ()=>{ URL.createObjectURL=o; return blob; }; };
 // 1. nothing touched: export keeps the card's own line endings
 let done=dl(); exportCharCharx(activeCharId); await w(900); let blob=done();
 let c=JSON.parse(await (await JSZip.loadAsync(blob)).file('card.json').async('string')).data;
 chk('untouched text keeps its \\r\\n', c.description==='line one\r\nline two\r\n\r\nline three' && c.personality==='p1\r\np2' && c.first_mes==='hello\r\nthere', [c.description,c.personality]);
 chk('untouched greeting keeps its \\r\\n', c.alternate_greetings[0]==='alt\r\none' && c.alternate_greetings[1]==='plain alt', c.alternate_greetings);
 // 2. a real edit still lands (and is plain \n, as typed in the box)
 const box=document.getElementById('chDesc'); chk('the description box exists', !!box);
 if(box){ box.value='line one\nline two CHANGED'; box.dispatchEvent(new Event('input',{bubbles:true})); }
 done=dl(); exportCharCharx(activeCharId); await w(900); blob=done();
 c=JSON.parse(await (await JSZip.loadAsync(blob)).file('card.json').async('string')).data;
 chk('an edited field takes the new text', c.description==='line one\nline two CHANGED', c.description);
 chk('other untouched fields still keep \\r\\n', c.personality==='p1\r\np2' && c.first_mes==='hello\r\nthere');
 return out;
})()
