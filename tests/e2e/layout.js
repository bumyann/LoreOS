// Layout check: no sideways scrolling and no JS errors in any view or editor mode at phone, tablet and desktop widths.
// Usage: node tests/e2e/layout.js
const { chromium } = require('playwright'); const { ev, init: HINIT } = require('./harness');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '../..');
const srv = http.createServer((q, s) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); s.end(d); }); }).listen(8087);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] }); let bad = 0;
  // 'wide font' phones widen every letter, like the real pixel fonts do (they are not loaded in these tests)
  for (const [name, w, h, wide] of [['phone', 390, 844], ['small phone', 320, 640], ['wide-font phone', 390, 844, true], ['wide-font small phone', 340, 700, true], ['tablet', 820, 1180], ['desktop', 1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: name !== 'desktop', isMobile: /phone/.test(name) }); const pg = await ctx.newPage(); await pg.addInitScript(HINIT);
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.route(/accounts.google|fonts/, r => r.abort());
    await pg.goto('http://localhost:8087/'); await pg.waitForTimeout(800);
    if (wide) await pg.addStyleTag({ content: '*{font-family:"DejaVu Sans Mono",monospace !important;letter-spacing:.06em !important}' });
    await ev(pg, async () => { createChar(); await new Promise(r => setTimeout(r, 150)); createPersona('A persona with a rather long name indeed'); { const d = normalizeJournal({ pages: {} }); const a = newPage(d, { title: 'A journal page with a rather long title indeed', content: '## Heading\n\n- [ ] a to-do item with quite a lot of words in it\n\n<details open=""><summary>A toggle</summary><div data-type="detailsContent"><p>inside</p></div></details>' }); const k = newPage(d, { parent: a, title: 'A subpage with an equally long name for the tree' }); newPage(d, { parent: k, title: 'Deeper' }); d.activePageId = a; nbSet(d); } createPrompt('A prompt pack with a long name'); createRegex('A regex set name'); const m = metaGet(); const wid = addWorld(m, 'A world'); metaSet(m); homeSet({ board: [{ id: 'a', type: 'note', title: 'A note title that is long', text: 'text '.repeat(20) }, { id: 'b', type: 'link', title: 'link', url: 'https://example.com/a/very/long/path/that/keeps/going/and/going' }] }); });
    for (const [view, mode] of [['home'], ['library'], ['notebook'], ['laboratory'], ['editor', 'lore'], ['editor', 'char'], ['editor', 'preset']]) {
      await ev(pg, async a => { navigateTo(a[0]); if (a[1]) { switchMode(a[1]); if (a[1] === 'lore' && !Object.keys(lorebook.entries).length) createEntry(); if (a[1] === 'preset' && !Object.keys(presetLibrary).length) createPreset(); } await new Promise(r => setTimeout(r, 250)); }, [view, mode || null]);
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) { bad++; console.log(`FAIL ${name} ${view}/${mode || ''}: scrolls sideways by ${over}px`); }
      // the views scroll inside their own panel, so the page itself never shows it: look inside the panel too
      if (/home|library|notebook|laboratory/.test(view)) {
        const inner = await pg.evaluate(() => { const els = [...document.querySelectorAll('.view-panel.view-active, .view-panel.view-active .view-scroll')]; const worst = els.map(e => ({ n: e.id || e.className, o: e.scrollWidth - e.clientWidth })).sort((a, b) => b.o - a.o)[0]; return worst || { o: 0 }; });
        if (inner.o > 1) { bad++; console.log(`FAIL ${name} ${view}: the panel scrolls sideways by ${inner.o}px (${inner.n})`); }
      }
    }
    if (errs.length) { bad++; console.log(`FAIL ${name}: JS errors`, errs.slice(0, 3)); }
    await ctx.close();
  }
  await b.close(); srv.close(); console.log(bad ? `${bad} problem(s)` : 'layout ok at phone, tablet and desktop'); process.exit(bad ? 1 : 0);
})();
