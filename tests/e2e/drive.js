// Fake Google Drive test: two devices (browser contexts) share one in-memory Drive.
// Covers connect, first push, pull on a second device, conflict, expired token (401), failed search.
// Usage: node tests/e2e/drive.js   (same setup as run.js)
const { chromium } = require('playwright'); const { ev, init: HINIT } = require('./harness');
const http=require('http'),fs=require('fs'),path=require('path'); const root=path.resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; const f=path.join(root,p); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream'}); s.end(d);});}).listen(0);

// ── the fake Drive ──
const drive = { userinfo401: false, files: {}, nextId: 1, searchStatus: 200, force401: 0, version404: 0, log: [] };
function handle(route) {
  const req = route.request(); const u = new URL(req.url()); const m = req.method();
  const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
  drive.log.push(m + ' ' + u.pathname);
  if (u.pathname.endsWith('/userinfo')) return drive.userinfo401 ? json({ error: 'invalid_token' }, 401) : json({ email: 'yann@example.com' });
  if (drive.force401 > 0) { drive.force401--; return json({ error: 'unauthorized' }, 401); }
  const idm = u.pathname.match(/files\/([^/?]+)$/);
  if (u.pathname === '/drive/v3/files' && m === 'GET') {
    if (drive.searchStatus !== 200) return json({ error: 'boom' }, drive.searchStatus);
    const files = Object.values(drive.files).map(f => ({ id: f.id, name: f.name, version: String(f.version) }));
    return json({ files });
  }
  if (u.pathname === '/upload/drive/v3/files' && m === 'POST') {
    const body = req.postData() || ''; const parts = body.split(/--[^\r\n]+/).filter(p => /Content-Type/i.test(p));
    const media = parts[parts.length - 1].split(/\r?\n\r?\n/).slice(1).join('\n\n').replace(/\r?\n$/, '');
    const id = 'f' + drive.nextId++; drive.files[id] = { id, name: 'LoreOS-sync.json', version: 1, content: media };
    return json({ id, version: '1' });
  }
  if (idm && m === 'GET') {
    const f = drive.files[idm[1]]; if (!f) return json({ error: 'nf' }, 404);
    if (u.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, contentType: 'application/json', body: f.content });
    if (drive.version404 > 0) { drive.version404--; return json({ error: 'nf' }, 404); }
    return json({ version: String(f.version) });
  }
  if (idm && m === 'PATCH') {
    const f = drive.files[idm[1]]; if (!f) return json({ error: 'nf' }, 404);
    f.content = req.postData(); f.version++; return json({ version: String(f.version) });
  }
  return json({ error: 'unhandled ' + m + ' ' + u.pathname }, 500);
}
const GSI = `window.google={accounts:{oauth2:{initTokenClient:cfg=>({requestAccessToken:o=>{ window.__gsi=(window.__gsi||0)+1; setTimeout(()=>cfg.callback({access_token:'tok'+Date.now(),expires_in:3600}),5); }}),revoke:()=>{}}}};`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const fail = []; const chk = (n, c, d) => { if (!c) fail.push(n + (d ? ' => ' + JSON.stringify(d) : '')); else console.log('ok   ' + n); };
  const w = ms => new Promise(r => setTimeout(r, ms));
  async function device() {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
    await pg.addInitScript(HINIT); await pg.addInitScript(GSI);
    await pg.route(/accounts\.google|fonts\./, r => r.abort());
    await pg.route(/googleapis\.com/, handle);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(700);
    return { ctx, pg, ev: (c) => ev(pg, c) };
  }
  // regression: the account lookup answers 401 (token has no email scope). That must not log us out
  // or open a second sign-in popup.
  drive.userinfo401 = true;
  const Z = await device();
  await Z.ev(`gdriveConnect()`); await Z.pg.waitForTimeout(900);
  chk('connect survives a 401 on the account lookup', await Z.ev(`!!gdriveToken`));
  chk('exactly one sign-in popup', (await Z.pg.evaluate(() => window.__gsi)) === 1, await Z.pg.evaluate(() => window.__gsi));
  chk('UI shows connected, not Reconnect', await Z.pg.evaluate(() => document.getElementById('gdriveConnectBtn').style.display === 'none'));
  await Z.ctx.close(); for (const id of Object.keys(drive.files)) delete drive.files[id]; drive.userinfo401 = false;
  const A = await device();
  // device A: create some data, connect, first sync creates the file
  await A.ev(`(async()=>{ charLibrary.c1={id:'c1',name:'Alice',card:{spec:'chara_card_v3',spec_version:'3.0',data:{name:'Alice'}},imageData:null,savedAt:new Date().toISOString()}; saveCharLibrary&&saveCharLibrary(); })()`).catch(()=>{});
  await A.pg.evaluate(() => { window.LoreOS.store.set('aet_charLibrary', JSON.stringify({ c1: { id: 'c1', name: 'Alice', card: { spec: 'chara_card_v3', data: { name: 'Alice' } }, savedAt: new Date().toISOString() } })); });
  await A.ev(`gdriveConnect()`); await w(800);
  chk('A connected', await A.ev(`!!gdriveToken`));
  chk('Drive file created (exactly one)', Object.keys(drive.files).length === 1, Object.keys(drive.files));
  chk('A base version stored', (await A.pg.evaluate(() => localStorage.getItem('aet_gdrive_base'))) === '1');
  chk('file content has Alice', /Alice/.test(Object.values(drive.files)[0].content));
  // device B: empty, connect => finds data, opens import modal
  const B = await device();
  await B.ev(`gdriveConnect()`); await w(1200);
  chk('B sees import modal from Drive', await B.pg.evaluate(() => !!document.getElementById('syncImportChecks')?.querySelector('input')));
  chk('still exactly one Drive file', Object.keys(drive.files).length === 1);
  // A edits and pushes (v2). B then edits locally => conflict
  await A.pg.evaluate(() => { localStorage.setItem('aet_theme', 'light'); });
  await A.ev(`(async()=>{ const r=await gdrivePush({force:true}); return r; })()`);
  chk('A push bumps version', Object.values(drive.files)[0].version === 2, Object.values(drive.files)[0].version);
  // B is empty+unsynced: mark it as having local data and being dirty vs old base
  await B.pg.evaluate(() => { window.LoreOS.store.set('aet_charLibrary', JSON.stringify({ z: { id: 'z', name: 'Zed', card: {}, savedAt: 'x' } })); localStorage.setItem('aet_gdrive_base', '1'); localStorage.setItem('aet_gdrive_dirty', '1'); });
  await B.ev(`gdriveReconcile()`); await w(500);
  chk('B detects conflict', (await B.ev(`gdriveState`)) === 'conflict', await B.ev(`gdriveState`));
  chk('conflict shows a quiet dot on Settings, no pop-up', await B.pg.evaluate(() => document.querySelector('.nav-item[data-view="settings"]').classList.contains('sync-attn') && !/another device|both have changes/i.test(document.getElementById('notifs').textContent)));
  const r = await B.ev(`gdrivePush()`);
  chk('B normal push refused, nothing overwritten', r.ok === false && r.reason === 'conflict' && /Alice/.test(Object.values(drive.files)[0].content) && !/Zed/.test(Object.values(drive.files)[0].content), r);
  // clean device behind => 'behind', not overwritten
  await B.pg.evaluate(() => { localStorage.removeItem('aet_gdrive_dirty'); });
  await B.ev(`(gdriveState='ok', 0)`);
  const r2 = await B.ev(`gdrivePush()`);
  chk('B clean but behind refuses push', r2.ok === false && r2.reason === 'behind', r2);
  // 401 once => silent refresh and retry succeeds
  // ten minutes later the token is still valid by the clock but Drive rejects it once (revoked/rotated): refresh + retry
  await A.pg.evaluate(() => { const real = Date.now.bind(Date); Date.now = () => real() + 600000; });
  drive.force401 = 1;
  const A2 = await A.ev(`(async()=>{ gdriveState='ok'; const r=await gdrivePush({force:true}); return r; })()`);
  chk('A survives one 401 (refresh + retry)', A2.ok === true, A2);
  // search failure must not create another file
  drive.searchStatus = 500; const before = Object.keys(drive.files).length;
  drive.version404 = 1; // the cached file id looks stale, so the app searches again, and the search fails
  const A3 = await A.ev(`(async()=>{ gdriveState='ok'; return await gdrivePush(); })()`);
  chk('failed search => error, no duplicate file', A3.ok === false && Object.keys(drive.files).length === before, { A3, n: Object.keys(drive.files).length });
  chk('state is error', (await A.ev(`gdriveState`)) === 'error');
  drive.searchStatus = 200;
  // persistent 401 => expired state, local data kept
  drive.force401 = 99;
  const A4 = await A.ev(`(async()=>{ gdriveState='ok'; return await gdrivePush({force:true}); })()`);
  drive.force401 = 0;
  chk('persistent 401 => auth failure', A4.ok === false && A4.reason === 'auth', A4);
  chk('state expired, local data intact', (await A.ev(`gdriveState`)) === 'expired' && (await A.pg.evaluate(() => !!window.LoreOS.store.get('aet_charLibrary'))));
  await b.close(); srv.close();
  console.log(fail.length ? '\nFAIL\n' + fail.join('\n') : '\nall drive checks passed'); process.exit(fail.length ? 1 : 0);
})();
