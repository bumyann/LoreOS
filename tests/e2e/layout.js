// Layout check: no sideways scrolling and no JS errors in any view or editor mode at phone, tablet and desktop widths.
// Usage: node tests/e2e/layout.js
const { chromium } = require('playwright'); const { ev, init: HINIT } = require('./harness');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '../..');
const srv = http.createServer((q, s) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); s.end(d); }); }).listen(8087);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] }); let bad = 0;
  for (const [name, w, h] of [['phone', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: name !== 'desktop', isMobile: name === 'phone' }); const pg = await ctx.newPage(); await pg.addInitScript(HINIT);
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.route(/accounts.google|fonts/, r => r.abort());
    await pg.goto('http://localhost:8087/'); await pg.waitForTimeout(800);
    await ev(pg, async () => { createChar(); await new Promise(r => setTimeout(r, 150)); });
    for (const [view, mode] of [['home'], ['library'], ['notebook'], ['laboratory'], ['editor', 'lore'], ['editor', 'char'], ['editor', 'preset']]) {
      await ev(pg, async a => { navigateTo(a[0]); if (a[1]) { switchMode(a[1]); if (a[1] === 'lore' && !Object.keys(lorebook.entries).length) createEntry(); if (a[1] === 'preset' && !Object.keys(presetLibrary).length) createPreset(); } await new Promise(r => setTimeout(r, 250)); }, [view, mode || null]);
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) { bad++; console.log(`FAIL ${name} ${view}/${mode || ''}: scrolls sideways by ${over}px`); }
    }
    if (errs.length) { bad++; console.log(`FAIL ${name}: JS errors`, errs.slice(0, 3)); }
    await ctx.close();
  }
  await b.close(); srv.close(); console.log(bad ? `${bad} problem(s)` : 'layout ok at phone, tablet and desktop'); process.exit(bad ? 1 : 0);
})();
