(async()=>{
 const out={};
 for(let i=0;i<4;i++){ createEntry(); lorebook.entries[i].comment='E'+i; }
 renderList(); openInTab(3);
 const show=()=>({tabs:[...openTabs],active:activeTabId,shows:lorebook.entries[activeTabId]?.comment,uiName:document.getElementById('eName-'+activeTabId)?.value});
 out.before=show();
 insertAbove(0); out.afterAbove=show();
 insertBelow(activeTabId); out.afterBelow=show();
 copyEntry(0); out.afterCopy=show();
 out.names=Object.values(lorebook.entries).map(e=>e.uid+':'+e.comment);
 out.stored=Object.keys(JSON.parse(localStorage.aet_lorebook).entries).length;
 return out;
})()
