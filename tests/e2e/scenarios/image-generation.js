(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const pngBlob=async()=>{ const cv=document.createElement('canvas'); cv.width=64; cv.height=48; const x=cv.getContext('2d'); x.fillStyle='#c33'; x.fillRect(0,0,64,48); return new Promise(r=>cv.toBlob(r,'image/png')); };
 const b64=async()=>{ const u=await new Promise(async r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(await pngBlob()); }); return u.split(',')[1]; };
 const calls=[]; const realFetch=window.fetch;
 localStorage.removeItem(GEN_KEY); state.galleryLibrary={}; store.set('aet_gallery','{}');
 // ── settings ──
 chk('defaults are Pollinations, no key', loadGenSettings().provider==='pollinations' && loadGenSettings().apiKey==='');
 saveGenSettings({provider:'nope',size:99,apiKey:'k'}); chk('bad stored settings are corrected', loadGenSettings().provider==='pollinations' && loadGenSettings().size===0 && loadGenSettings().apiKey==='k');
 localStorage.removeItem(GEN_KEY);
 chk('the key is never in sync or backup', !SYNC_KEYS.includes(GEN_KEY));
 // ── request shapes (mocked network: not a live service) ──
 const blob=await pngBlob();
 const poll=async(url,opt)=>{ calls.push([url,opt]); return {ok:true,status:200,blob:async()=>blob}; };
 const url1=await generateImage({prompt:'a cathedral',settings:{...DEFAULTS,suffix:'oil painting'},fetchFn:poll,seed:7});
 chk('Pollinations: GET with prompt, size, model, seed', /^https:\/\/image\.pollinations\.ai\/prompt\/a%20cathedral%2C%20oil%20painting\?/.test(calls[0][0]) && /width=1024/.test(calls[0][0]) && /height=1024/.test(calls[0][0]) && /model=flux/.test(calls[0][0]) && /seed=7/.test(calls[0][0]), calls[0][0]);
 chk('returns a data URL picture', url1.startsWith('data:image/png'));
 calls.length=0;
 const oa=async(u,opt)=>{ calls.push([u,opt]); return {ok:true,status:200,json:async()=>({data:[{b64_json:await b64()}]})}; };
 const url2=await generateImage({prompt:'a court',settings:{...DEFAULTS,provider:'openai',apiKey:'sk-test',baseUrl:'https://example.test/v1/',openaiModel:'img-1',size:1},fetchFn:oa});
 const body=JSON.parse(calls[0][1].body);
 chk('OpenAI-compatible: POST /images/generations with bearer key', calls[0][0]==='https://example.test/v1/images/generations' && calls[0][1].method==='POST' && calls[0][1].headers.Authorization==='Bearer sk-test' && body.model==='img-1' && body.prompt==='a court' && body.size==='768x1024', [calls[0][0],body]);
 chk('b64 result becomes a data URL', url2.startsWith('data:image/png;base64,'));
 calls.length=0;
 const oaUrl=async(u,opt)=>{ calls.push([u,opt]); return u.includes('/images/')?{ok:true,status:200,json:async()=>({data:[{url:'https://cdn.example.test/x.png'}]})}:{ok:true,status:200,blob:async()=>blob}; };
 const url3=await generateImage({prompt:'p',settings:{...DEFAULTS,provider:'openai',apiKey:'k',baseUrl:'https://example.test/v1'},fetchFn:oaUrl});
 chk('a url result is downloaded', calls.length===2 && url3.startsWith('data:image/'));
 const rej=async(fn)=>{ try{ await fn(); return null; }catch(e){ return e.message; } };
 chk('empty prompt refused', /prompt/i.test(await rej(()=>generateImage({prompt:'  ',settings:DEFAULTS,fetchFn:poll}))));
 chk('missing key refused without a request', (calls.length=0, /key/i.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai'},fetchFn:oa})))) && calls.length===0);
 chk('non-http endpoint refused', /address/i.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai',apiKey:'k',baseUrl:'javascript:alert(1)'},fetchFn:oa}))));
 const bad=async()=>({ok:false,status:401,json:async()=>({error:{message:'Incorrect API key'}})});
 chk('API error message is shown', /Incorrect API key/.test(await rej(()=>generateImage({prompt:'x',settings:{...DEFAULTS,provider:'openai',apiKey:'k'},fetchFn:bad}))));
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
 chk('OpenAI-compatible fields show', document.getElementById('genOpenAi').style.display==='flex' && /API key are sent/.test(document.getElementById('genPrivacy').textContent));
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
