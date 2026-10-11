(()=>{ const t=(s,exp)=>{ const g=JSON.stringify(splitKeywords(s)); return g===JSON.stringify(exp)?null:`${JSON.stringify(s)} -> ${g} expected ${JSON.stringify(exp)}`; };
 const fails=[
  t('a, b',['a','b']), t('/a,b/i, x',['/a,b/i','x']), t('/a/ , b',['/a/','b']), t('/unterminated, x',['/unterminated','x']), t('a/b, c',['a/b','c']),
  t('/https?:\\/\\/x,y/gi,z',['/https?:\\/\\/x,y/gi','z']), t('',[]), t(' , ,',[]), t('/a\\/b,c/',['/a\\/b,c/']), t('plain',['plain']), t('/one/,/two,2/',['/one/','/two,2/']), t('日本語, 🦊',['日本語','🦊']),
  t(null,[]), t('a,,b',['a','b']), t('/x/i',['/x/i']), t('/x/ig ,y',['/x/ig','y'])
 ].filter(Boolean);
 // parseKeywordField keeps untouched lists exactly
 const orig=['plain, with comma','/a,b/i']; const keep=parseKeywordField(joinKeywords(orig),orig)===orig; const edited=JSON.stringify(parseKeywordField('/a,b/i, new',orig));
 return {fails,keepUntouched:keep,edited};
})()
