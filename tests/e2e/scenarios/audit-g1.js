(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d?' => '+JSON.stringify(d):'')); };
 const calls=[]; let mode='fail';
 window.google={accounts:{oauth2:{initTokenClient:cfg=>({requestAccessToken:o=>{ calls.push(o); setTimeout(()=>{ if(mode==='fail') cfg.error_callback({type:'popup_failed_to_open'}); else cfg.callback({access_token:'tok',expires_in:3600}); },10); }}),revoke:()=>{}}}};
 localStorage.setItem('loreos_gdrive_linked','1'); localStorage.setItem('loreos_gdrive_hint','me@x.com');
 await gdriveTrySilentReconnect(); await w(100);
 chk('link kept after silent failure', localStorage.getItem('loreos_gdrive_linked')==='1');
 chk('hint kept', localStorage.getItem('loreos_gdrive_hint')==='me@x.com');
 chk('silent used prompt empty + hint', calls[0] && calls[0].prompt==='' && calls[0].hint==='me@x.com', calls[0]);
 chk('btn says Reconnect', /Reconnect/.test(document.getElementById('gdriveConnectBtn')?.textContent||''), document.getElementById('gdriveConnectBtn')?.textContent);
 mode='ok'; window.fetch=async()=>({ok:true,status:200,json:async()=>({email:'me@x.com',files:[]})});
 gdriveConnect(); await w(200);
 chk('connect did not force consent', calls[calls.length-1].prompt==='', calls[calls.length-1]);
 out.calls=calls; return out;
})()
