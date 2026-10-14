(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const pngBlob=async()=>{ const cv=document.createElement('canvas'); cv.width=64; cv.height=48; const x=cv.getContext('2d'); x.fillStyle='#c33'; x.fillRect(0,0,64,48); return new Promise(r=>cv.toBlob(r,'image/png')); };
 const b64=async()=>{ const u=await new Promise(async r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(await pngBlob()); }); return u.split(',')[1]; };
 const calls=[]; const realFetch=window.fetch;
 localStorage.removeItem(GEN_KEY); state.galleryLibrary={}; store.set('aet_gallery','{}');
 // ── settings ──
 chk('defaults are Pollinations, and settings carry no key at all', loadGenSettings().provider==='pollinations' && !('apiKey' in loadGenSettings()));
 saveGenSettings({provider:'nope',size:99,steps:9999,cfg:-4}); chk('bad stored settings are corrected', loadGenSettings().provider==='pollinations' && loadGenSettings().size===0 && loadGenSettings().steps===150 && loadGenSettings().cfg===0);
 localStorage.removeItem(GEN_KEY);
 chk('settings are not in sync or backup', !SYNC_KEYS.includes(GEN_KEY) && !SYNC_KEYS.includes('loreos_secrets'));
 saveGenSettings({provider:'openai',apiKey:'sk-leak'}); chk('a key can never be written into the settings', !localStorage.getItem(GEN_KEY).includes('sk-leak')); localStorage.removeItem(GEN_KEY);
 // ── request shapes (mocked network: not a live service) ──
 const blob=await pngBlob();
 const poll=async(url,opt)=>{ calls.push([url,opt]); return {ok:true,status:200,blob:async()=>blob}; };
 const url1=await generateImage({prompt:'a cathedral',settings:{...DEFAULTS,suffix:'oil painting'},fetchFn:poll,seed:7});
 chk('Pollinations: GET with prompt, size, model, seed', /^https:\/\/image\.pollinations\.ai\/prompt\/a%20cathedral%2C%20oil%20painting\?/.test(calls[0][0]) && /width=1024/.test(calls[0][0]) && /height=1024/.test(calls[0][0]) && /model=flux/.test(calls[0][0]) && /seed=7/.test(calls[0][0]), calls[0][0]);
 chk('returns a data URL picture', url1.startsWith('data:image/png'));
 calls.length=0;
 const oa=async(u,opt)=>{ calls.push([u,opt]); return {ok:true,status:200,json:async()=>({data:[{b64_json:await b64()}]})}; };
 const url2=await generateImage({prompt:'a court',settings:{...DEFAULTS,provider:'openai',baseUrl:'https://example.test/v1/',openaiModel:'img-1',size:1},apiKey:'sk-test',fetchFn:oa});
 const body=JSON.parse(calls[0][1].body);
 chk('OpenAI-compatible: POST /images/generations with bearer key', calls[0][0]==='https://example.test/v1/images/generations' && calls[0][1].method==='POST' && calls[0][1].headers.Authorization==='Bearer sk-test' && body.model==='img-1' && body.prompt==='a court' && body.size==='768x1024', [calls[0][0],body]);
 chk('b64 result becomes a data URL', url2.startsWith('data:image/png;base64,'));
 calls.length=0;
 const oaUrl=async(u,opt)=>{ calls.push([u,opt]); return u.includes('/images/')?{ok:true,status:200,json:async()=>({data:[{url:'https://cdn.example.test/x.png'}]})}:{ok:true,status:200,blob:async()=>blob}; };
 const url3=await generateImage({prompt:'p',settings:{...DEFAULTS,provider:'openai',baseUrl:'https://example.test/v1'},apiKey:'k',fetchFn:oaUrl});
 chk('a url result is downloaded', calls.length===2 && url3.startsWith('data:image/'));
 const rej=async(fn)=>{ try{ await fn(); return null; }catch(e){ return e.message; } };
 chk('empty prompt refused', /prompt/i.test(await rej(()=>generateImage({prompt:'  ',settings:DEFAULTS,fetchFn:poll}))));
 chk('missing key refused without a request', (calls.length=0, /key/i.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai'},fetchFn:oa})))) && calls.length===0);
 chk('plain http to a public host is refused (the key would travel in the open)', /https/i.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai',baseUrl:'http://example.test/v1'},apiKey:'k',fetchFn:oa}))));
 chk('an address with a password in it is refused', /name or password/.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai',baseUrl:'https://u:p@example.test/v1'},apiKey:'k',fetchFn:oa}))));
 calls.length=0; await generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai',baseUrl:'https://example.test/v1'},apiKey:'k',fetchFn:oa});
 chk('the key request sends no cookies, no referrer, no redirects', calls[0][1].credentials==='omit' && calls[0][1].referrerPolicy==='no-referrer' && calls[0][1].redirect==='error' && calls[0][1].cache==='no-store', calls[0][1]);
 // ── SwarmUI ──
 { const log=[]; const sw=async(u,o)=>{ log.push([u,o]); if(u.endsWith('/API/GetNewSession')) return {ok:true,status:200,json:async()=>({session_id:'sess1'})}; if(u.endsWith('/API/GenerateText2Image')) return {ok:true,status:200,json:async()=>({images:['View/local/raw/2026/pic.png']})}; if(u.includes('/View/local/raw')) return {ok:true,status:200,blob:async()=>blob}; return {ok:false,status:404,json:async()=>({})}; };
   const st={...DEFAULTS,provider:'swarmui',swarmUrl:'http://localhost:7801',swarmModel:'sdxl.safetensors',negative:'blurry',steps:20,cfg:5,size:1};
   const u=await generateImage({prompt:'a tower',settings:st,fetchFn:sw,seed:5});
   const gen=JSON.parse(log.find(l=>l[0].endsWith('GenerateText2Image'))[1].body);
   chk('SwarmUI: new session, then generate with the settings', log[0][0]==='http://localhost:7801/API/GetNewSession' && gen.session_id==='sess1' && gen.prompt==='a tower' && gen.negativeprompt==='blurry' && gen.model==='sdxl.safetensors' && gen.width===768 && gen.height===1024 && gen.steps===20 && gen.cfgscale===5 && gen.seed===5 && gen.images===1, gen);
   chk('SwarmUI: picture fetched from the path it returned', log[log.length-1][0]==='http://localhost:7801/View/local/raw/2026/pic.png' && u.startsWith('data:image/'));
   log.length=0; const ed=await editImage({prompt:'make it night',image:u,strength:0.4,settings:st,fetchFn:sw,seed:1});
   const gen2=JSON.parse(log.find(l=>l[0].endsWith('GenerateText2Image'))[1].body);
   chk('SwarmUI edit: sends the picture and how much it may change', /^data:image\//.test(gen2.initimage) && gen2.initimagecreativity===0.4, Object.keys(gen2));
   let retried=0; const flaky=async(u2,o)=>{ if(u2.endsWith('GetNewSession')) return {ok:true,status:200,json:async()=>({session_id:'s'+(++retried)})}; if(u2.endsWith('GenerateText2Image')){ return JSON.parse(o.body).session_id==='s1'?{ok:false,status:200,json:async()=>({error_id:'invalid_session_id',error:'bad'})}:{ok:true,status:200,json:async()=>({images:['data:image/png;base64,AAAA']})}; } return {ok:true,blob:async()=>blob}; };
   chk('SwarmUI: an expired session is renewed once', (await generateImage({prompt:'x',settings:st,fetchFn:flaky})).startsWith('data:image/png') && retried===2);
   chk('SwarmUI: an error from the server is shown', /out of memory/.test(await rej(()=>generateImage({prompt:'x',settings:st,fetchFn:async(u3)=>u3.endsWith('GetNewSession')?{ok:true,json:async()=>({session_id:'q'})}:{ok:true,status:200,json:async()=>({error:'out of memory'})}}))));
   chk('SwarmUI: a public http address is refused', /https/.test(await rej(()=>generateImage({prompt:'x',settings:{...st,swarmUrl:'http://example.test:7801'},fetchFn:sw}))));
   const lm=await listSwarmModels(st,async(u4)=>u4.endsWith('GetNewSession')?{ok:true,json:async()=>({session_id:'z'})}:{ok:true,json:async()=>({files:[{name:'a.safetensors'},{name:'b.safetensors'}]})});
   chk('SwarmUI: model list', lm.join()==='a.safetensors,b.safetensors'); }
 // ── ComfyUI ──
 { const log=[]; let polls=0; const cf=async(u,o)=>{ log.push([u,o]); if(u.endsWith('/upload/image')) return {ok:true,status:200,json:async()=>({name:'loreos-input.png',subfolder:'',type:'input'})}; if(u.endsWith('/prompt')) return {ok:true,status:200,json:async()=>({prompt_id:'pid1'})}; if(u.includes('/history/')) { polls++; return {ok:true,status:200,json:async()=>polls<3?{}:({pid1:{status:{status_str:'success'},outputs:{'9':{images:[{filename:'out_1.png',subfolder:'',type:'output'}]}}}})}; } if(u.includes('/view?')) return {ok:true,status:200,blob:async()=>blob}; return {ok:false,status:404,json:async()=>({})}; };
   const st={...DEFAULTS,provider:'comfyui',comfyCkpt:'sdxl.safetensors',steps:12,cfg:4,negative:'ugly'};
   const u=await generateImage({prompt:'a moth',settings:st,fetchFn:cf,seed:9,sleep:async()=>{}});
   const graph=JSON.parse(log.find(l=>l[0].endsWith('/prompt'))[1].body).prompt;
   chk('ComfyUI: a text to picture graph with the settings', graph['4'].inputs.ckpt_name==='sdxl.safetensors' && graph['6'].inputs.text==='a moth' && graph['7'].inputs.text==='ugly' && graph['3'].inputs.seed===9 && graph['3'].inputs.steps===12 && graph['5'].inputs.width===1024 && graph['3'].inputs.denoise===1, graph['3']);
   chk('ComfyUI: waits for the result, then downloads it', polls===3 && /\/view\?filename=out_1.png/.test(log[log.length-1][0]) && u.startsWith('data:image/'));
   log.length=0; polls=0; await editImage({prompt:'night',image:u,strength:0.5,settings:st,fetchFn:cf,seed:2,sleep:async()=>{}});
   const g2=JSON.parse(log.find(l=>l[0].endsWith('/prompt'))[1].body).prompt;
   chk('ComfyUI edit: uploads the picture and builds a picture to picture graph', log[0][0].endsWith('/upload/image') && g2['10'].inputs.image==='loreos-input.png' && g2['11'].class_type==='VAEEncode' && g2['3'].inputs.denoise===0.5 && g2['3'].inputs.latent_image[0]==='11' && !g2['5'], Object.keys(g2));
   const wf=JSON.stringify({a:{class_type:'X',inputs:{text:'%prompt%',seed:'%seed%',w:'%width%',keep:'plain %prompt% text'}}});
   chk('custom workflow: placeholders replaced as whole values only', (()=>{ const o=fillWorkflow(wf,{prompt:'hi',seed:3,w:512}); return o.a.inputs.text==='hi' && o.a.inputs.seed===3 && o.a.inputs.w===512 && o.a.inputs.keep==='plain %prompt% text'; })());
   chk('custom workflow: bad JSON is explained', /valid JSON/.test(await rej(async()=>fillWorkflow('{nope',{}))));
   log.length=0; polls=0; await generateImage({prompt:'p',settings:{...st,comfyWorkflow:wf},fetchFn:cf,sleep:async()=>{}});
   chk('custom workflow is the one sent', JSON.parse(log.find(l=>l[0].endsWith('/prompt'))[1].body).prompt.a.inputs.text==='p');
   chk('ComfyUI: no checkpoint and no workflow is explained', /checkpoint/i.test(await rej(()=>generateImage({prompt:'x',settings:{...st,comfyCkpt:''},fetchFn:cf}))));
   chk('ComfyUI: rejected workflow shows why', /rejected/.test(await rej(()=>generateImage({prompt:'x',settings:st,fetchFn:async(u5)=>({ok:false,status:400,json:async()=>({node_errors:{4:'bad ckpt'}})})}))));
   const ck=await listComfyCheckpoints(st,async()=>({ok:true,json:async()=>({CheckpointLoaderSimple:{input:{required:{ckpt_name:[['m1.safetensors','m2.ckpt']]}}}})}));
   chk('ComfyUI: checkpoint list', ck.join()==='m1.safetensors,m2.ckpt'); }
 // ── a network failure is explained (CORS / server off) ──
 chk('a blocked request names CORS and the server', /CORS/.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'swarmui'},fetchFn:async()=>{ throw new TypeError('Failed to fetch'); }}))));
 // ── editing: who can, who cannot ──
 chk('Pollinations cannot edit, and says so', /cannot change a picture/.test(await rej(()=>editImage({prompt:'x',image:url1,settings:DEFAULTS,fetchFn:poll}))) && CAN_EDIT.openai && CAN_EDIT.swarmui && CAN_EDIT.comfyui && !CAN_EDIT.pollinations);
 chk('editing needs a prompt and a picture', /what to change/.test(await rej(()=>editImage({prompt:' ',image:url1,settings:{...DEFAULTS,provider:'swarmui'},fetchFn:poll}))) && /no picture/.test(await rej(()=>editImage({prompt:'x',image:'',settings:{...DEFAULTS,provider:'swarmui'},fetchFn:poll}))));
 { calls.length=0; const oa2=async(u,o)=>{ calls.push([u,o]); return {ok:true,status:200,json:async()=>({data:[{b64_json:await b64()}]})}; };
   await editImage({prompt:'make the dress red',image:url1,settings:{...DEFAULTS,provider:'openai',baseUrl:'https://example.test/v1',openaiModel:'img-1'},apiKey:'sk-t',fetchFn:oa2});
   chk('OpenAI-compatible edit: multipart to /images/edits with the picture', calls[0][0]==='https://example.test/v1/images/edits' && calls[0][1].body instanceof FormData && calls[0][1].body.get('prompt')==='make the dress red' && calls[0][1].body.get('image') instanceof Blob && calls[0][1].headers.Authorization==='Bearer sk-t' && !calls[0][1].headers['Content-Type'], [...calls[0][1].body.keys()]); }
 // ── secrets ──
 forgetAllSecrets(); localStorage.removeItem(SECRETS_KEY);
 { const box=await encryptText('sk-secret-123','correct horse battery',1000); chk('cipher round trip', await decryptText(box,'correct horse battery')==='sk-secret-123' && !JSON.stringify(box).includes('secret'));
   chk('wrong passphrase cannot decrypt', await rej(()=>decryptText(box,'wrong passphrase!'))!==null);
   const b2=await encryptText('sk-secret-123','correct horse battery',1000); chk('every encryption is different (fresh salt and iv)', b2.ct!==box.ct && b2.salt!==box.salt); }
 { chk('session mode: kept in memory, not on disk', (await setSecret('t1','sk-mem','session')).ok && (await getSecret('t1'))==='sk-mem' && !(localStorage.getItem(SECRETS_KEY)||'').includes('sk-mem') && secretInfo('t1').mode==='session');
   lockSecrets(); chk('session mode: gone once locked or reloaded', (await getSecret('t1',{ask:async()=>null}))==='' && !secretInfo('t1').has);
   const r=await setSecret('t2','sk-enc-value','encrypted','short'); chk('a short passphrase is refused', !r.ok && /8/.test(r.error));
   chk('encrypted: saved without the key in the clear', (await setSecret('t2','sk-enc-value','encrypted','a long passphrase')).ok && !localStorage.getItem(SECRETS_KEY).includes('sk-enc-value') && secretInfo('t2').mode==='encrypted');
   lockSecrets(); chk('encrypted: locked after a reload, asks for the passphrase', !secretInfo('t2').unlocked && (await getSecret('t2',{ask:async(m,d,o)=>{ chk('the passphrase box hides what is typed', o&&o.secret===true); return 'a long passphrase'; }}))==='sk-enc-value');
   lockSecrets(); chk('encrypted: a wrong passphrase gives nothing (and stops after three tries)', (await getSecret('t2',{ask:async()=>'not the passphrase'}))==='');
   chk('plain mode is labelled and stored', (await setSecret('t3','sk-plain','plain')).ok && JSON.parse(localStorage.getItem(SECRETS_KEY)).t3.mode==='plain');
   forgetSecret('t3'); chk('forget removes it everywhere', !secretInfo('t3').has && !JSON.parse(localStorage.getItem(SECRETS_KEY)||'{}').t3);
   chk('mask shows only the last four', maskSecret('sk-abcdef1234').endsWith('1234') && !maskSecret('sk-abcdef1234').includes('abcdef'));
   forgetAllSecrets(); chk('forget all clears the store', !localStorage.getItem(SECRETS_KEY)); }
 chk('private hosts', isPrivateHost('localhost') && isPrivateHost('192.168.1.5') && isPrivateHost('10.0.0.2') && isPrivateHost('172.20.1.1') && !isPrivateHost('172.40.1.1') && !isPrivateHost('example.com') && isPrivateHost('127.0.0.1'));
 chk('an old plain key in the settings is moved out of them', await (async()=>{ localStorage.setItem(GEN_KEY,JSON.stringify({provider:'openai',apiKey:'sk-old'})); await migrateOldKey(); return !localStorage.getItem(GEN_KEY).includes('sk-old') && (await getSecret(KEY_NAME))==='sk-old'; })());
 forgetAllSecrets(); localStorage.removeItem(GEN_KEY);
 { // the key must not appear in a backup
   await setSecret(KEY_NAME,'sk-must-not-leak','plain'); const bundle=JSON.stringify(syncBundleData()); chk('a saved key is not in a backup', !bundle.includes('sk-must-not-leak')); forgetAllSecrets(); }
 // ── the page itself: no way to run injected script ──
 { const meta=document.querySelector('meta[http-equiv="Content-Security-Policy"]'); chk('a Content Security Policy is set', !!meta && /script-src 'self'/.test(meta.content) && !/unsafe-inline[^;]*;[^]*script-src|script-src[^;]*unsafe-inline/.test(meta.content) && /object-src 'none'/.test(meta.content) && /base-uri 'self'/.test(meta.content));
   let violated=false; const onv=e=>{ if(e.violatedDirective.startsWith('script-src')) violated=true; }; document.addEventListener('securitypolicyviolation',onv);
   const s=document.createElement('script'); s.textContent='window.__csp_ran=1'; document.head.append(s); await w(150); document.removeEventListener('securitypolicyviolation',onv);
   chk('an injected inline script does not run', !window.__csp_ran && violated); }
 chk('non-http endpoint refused', /address/i.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai',baseUrl:'javascript:alert(1)'},apiKey:'k',fetchFn:oa}))));
 const bad=async()=>({ok:false,status:401,json:async()=>({error:{message:'Incorrect API key'}})});
 chk('API error message is shown', /Incorrect API key/.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai'},apiKey:'k',fetchFn:bad}))));
 chk('Pollinations HTTP error is reported', /502/.test(await rej(()=>generateImage({prompt:'x',settings:DEFAULTS,fetchFn:async()=>({ok:false,status:502})}))));
 chk('Pollinations non-image reply refused', /did not send a picture/.test(await rej(()=>generateImage({prompt:'x',settings:DEFAULTS,fetchFn:async()=>({ok:true,status:200,blob:async()=>new Blob(['<html>'],{type:'text/html'})})}))));
 // ── the dialog, driven by real clicks, with fetch mocked ──
 window.fetch=async(u,o)=>{ if(/pollinations/.test(String(u))) return {ok:true,status:200,blob:async()=>blob}; return realFetch(u,o); };
 showLibraryTab('gallery'); navigateTo('library'); await w(500);
 document.querySelector('.gal-bar .dd-btn, #galAdd, [data-galmenu]') ; 
 const addBtn=[...document.querySelectorAll('#library-content .dd-btn')].find(b=>/Add/.test(b.textContent)); chk('Gallery has an Add menu', !!addBtn);
 if(addBtn){ addBtn.click(); await w(150); }
 const genItem=document.querySelector('[data-galadd="generate"]'); chk('Add menu offers Generate', !!genItem);
 if(genItem){ genItem.click(); await w(250); }
 chk('dialog opens', document.getElementById('genModal').classList.contains('open'));
 chk('privacy note names Pollinations', /Pollinations/.test(document.getElementById('genPrivacy').textContent));
 chk('save buttons start disabled', document.getElementById('genSave').disabled);
 document.getElementById('genPrompt').value='a gothic window at dusk'; document.getElementById('genGo').click(); await w(900);
 chk('a result appears and can be saved', !!document.querySelector('#genResult img') && !document.getElementById('genSave').disabled, document.getElementById('genStatus').textContent);
 document.getElementById('genSave').click(); await w(900);
 const pics=Object.values(state.galleryLibrary);
 chk('saved to the Gallery as generated, with prompt and model', pics.length===1 && pics[0].source==='generated' && pics[0].prompt==='a gothic window at dusk' && pics[0].model==='pollinations/flux', pics[0]);
 chk('dialog closed', !document.getElementById('genModal').classList.contains('open'));
 // provider switch shows the key fields
 openGenerate(); await w(150);
 document.getElementById('genProvider').value='openai'; document.getElementById('genProvider').dispatchEvent(new Event('change')); await w(100);
 chk('OpenAI-compatible fields show', document.getElementById('genP-openai').style.display==='flex' && /API key/.test(document.getElementById('genPrivacy').textContent));
 chk('the key field hides what is typed', document.getElementById('genKey').type==='password');
 // failure leaves the dialog usable
 window.fetch=async()=>({ok:false,status:503});
 document.getElementById('genProvider').value='pollinations'; document.getElementById('genProvider').dispatchEvent(new Event('change'));
 document.getElementById('genPrompt').value='x'; document.getElementById('genGo').click(); await w(600);
 chk('a failed request shows a message and re-enables Generate', /503/.test(document.getElementById('genStatus').textContent) && !document.getElementById('genGo').disabled);
 window.fetch=realFetch;
 // editor hook
 chk('the editor can open the dialog', typeof hooks.generate==='function');
 return out;
})()
