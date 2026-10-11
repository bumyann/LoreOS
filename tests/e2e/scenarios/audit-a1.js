(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={diffs:[]};
 const mk=(uid,over)=>({...blankEntry(uid),comment:'E'+uid,content:'body '+uid,key:['k'+uid],...over});
 const entries={
  0:mk(0,{}),
  1:mk(1,{position:4,depth:6,role:1,probability:55,useProbability:true,sticky:2,cooldown:3,delay:4,group:'G',groupWeight:20,groupOverride:true,scanDepth:5,caseSensitive:true,matchWholeWords:false,useGroupScoring:true,automationId:'auto',triggers:['Normal','Swipe'],characterFilter:{isExclude:true,names:['Bob','Al'],tags:['t1']},excludeRecursion:true,preventRecursion:false,delayUntilRecursion:true,ignoreBudget:true,matchPersonaDescription:true,matchScenario:true,constant:false,vectorized:true,keysecondary:['s1','s2'],selectiveLogic:2}),
  2:mk(2,{position:7,outletName:'out1',constant:true,disable:false,order:42,displayIndex:9,addMemo:false,extensions:{foo:1},uid:2}),
  3:mk(3,{key:['/a,b/i','plain, with comma','x'],keysecondary:['/s1,s2/']}),
  4:mk(4,{disable:true,role:null,scanDepth:null,caseSensitive:null,matchWholeWords:true,useGroupScoring:null,probability:0,useProbability:false,depth:0,order:0}),
 };
 state.lorebook={name:'rt',entries:rebuildEntries(JSON.parse(JSON.stringify(entries)))};
 const before=JSON.parse(JSON.stringify(state.lorebook.entries));
 for(const uid of Object.keys(before)){
   openInTab(Number(uid)); await w(60); saveEntry(Number(uid)); await w(20);
 }
 const after=state.lorebook.entries;
 const keys=o=>Object.keys(o);
 for(const uid of Object.keys(before)){
   const A=before[uid],B=after[uid];
   for(const k of new Set([...keys(A),...keys(B)])){ if(JSON.stringify(A[k])!==JSON.stringify(B[k])) out.diffs.push(`#${uid}.${k}: ${JSON.stringify(A[k])} -> ${JSON.stringify(B[k])}`); }
 }
 return out;
})()
