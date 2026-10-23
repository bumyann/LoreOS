(async()=>{
 const w=ms=>new Promise(r=>setTimeout(r,ms)); const out={fail:[]}; const chk=(n,c,d)=>{ if(!c) out.fail.push(n+(d!==undefined?' => '+JSON.stringify(d).slice(0,220):'')); };
 const type=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
 // the page and the nav
 chk('nav has Theme above Settings', (()=>{ const ids=[...document.querySelectorAll('.nav-bottom .nav-item')].map(b=>b.dataset.view||b.id); return ids.indexOf('theme')>=0&&ids.indexOf('theme')<ids.indexOf('settings'); })());
 chk('light/dark toggle renamed', /Light/.test(document.getElementById('navThemeBtn').textContent));
 navigateTo('theme'); await w(300);
 chk('theme view shows', document.getElementById('view-theme').classList.contains('view-active') && !!document.querySelector('.theme-page'));
 chk('colours, fonts, title, logo, css all live here', ['stgModeToggle','stgFontFP','stgTitleMain','stgLogoBody','thCssText'].every(id=>document.getElementById(id)));
 // settings no longer holds appearance
 openSettings(); await w(200);
 chk('settings dialog has no colour/font/title controls', !document.querySelector('#settingsModal #stgTitleMain, #settingsModal #stgFontFP, #settingsModal .stg-hex'));
 chk('settings still has storage + sync', !!document.querySelector('#settingsModal #stgStorageBody') && !!document.querySelector('#settingsModal #syncExportBtn'));
 closeModal('settingsModal'); navigateTo('theme'); await w(200);
 // preset colours
 chk('built-in palettes listed', document.querySelectorAll('.theme-preset[data-kind="colour-built"]').length>=6);
 const rose=document.querySelector('.theme-preset[data-id="rose"] [data-act="apply"]'); rose.click(); await w(200);
 chk('applying a palette saves both modes', settingsGet().colours.dark['--p']===PALETTES.find(p=>p.id==='rose').dark['--p'] && !!settingsGet().colours.pink['--bg']);
 chk('and shows live', getComputedStyle(document.body).getPropertyValue('--p').trim().toLowerCase()===PALETTES.find(p=>p.id==='rose').dark['--p']);
 chk('palette leaves css/fonts alone', !settingsGet().customCss);
 // save + delete own palette
 type(document.getElementById('thSaveColourName'),'Mine'); document.getElementById('thSaveColour').click(); await w(200);
 chk('own palette saved', !!settingsGet().savedThemes.Mine && !!document.querySelector('.theme-preset[data-id="Mine"]'));
 // preset themes include css
 document.querySelector('[data-thtab="themes"]').click(); await w(150);
 chk('built-in themes listed', document.querySelectorAll('.theme-preset[data-kind="theme-built"]').length>=3);
 document.querySelector('.theme-preset[data-id="terminal"] [data-act="apply"]').click(); await w(300);
 chk('theme sets css', /scanlines|repeating-linear-gradient/.test(settingsGet().customCss) && !!document.getElementById('loreos-custom-css'));
 chk('css box shows it', /Terminal/.test(document.getElementById('thCssText').value));
 chk('theme remembers fonts by name', settingsGet().savedThemes!==undefined && JSON.stringify(fontsGet().fx||{}).includes('VT323'), fontsGet());
 // custom css: typing saves, sanitizing
 type(document.getElementById('thCssText'),'@import url(https://evil.example/x.css);\nbody{background:url(https://evil.example/p.png)}\n.x{background:url(data:image/png;base64,AAAA)}\n.nav-item{outline:1px solid red}'); await w(1100);
 const css=document.getElementById('loreos-custom-css').textContent;
 chk('@import removed', !/@import/.test(css));
 chk('outside pictures removed', !/evil\.example/.test(css), css);
 chk('data pictures kept', /data:image\/png/.test(css));
 chk('rules still apply', getComputedStyle(document.querySelector('.nav-item')).outlineStyle==='solid');
 chk('what you typed is what is stored (cleaning is only at use)', /evil\.example/.test(settingsGet().customCss));
 document.getElementById('thCssOn').click(); await w(200);
 chk('switching it off removes the style', !document.getElementById('loreos-custom-css'));
 document.getElementById('thCssOn').click(); await w(200);
 chk('and back on', !!document.getElementById('loreos-custom-css'));
 // export/import round trip
 const t=themeFromCurrent('Round',settingsGet(),fontsGet()); const back=normalizeTheme(JSON.parse(JSON.stringify(t)));
 chk('theme file round trip', back&&back.css===t.css&&back.colours.dark['--p']===t.colours.dark['--p']);
 chk('junk is not a theme', normalizeTheme({hello:1})===null && normalizeTheme([1])===null && normalizeTheme({kind:'other',css:'x'})===null);
 chk('colours in a file are checked', normalizeTheme({css:'a{}',colours:{dark:{'--p':'javascript:1'}}}).colours.dark['--p']===PALETTES[0].dark['--p']);
 // unsaved edits go back when leaving
 const hex=document.querySelector('.stg-hex[data-var="--p"]'); hex.value='#ff0000'; hex.dispatchEvent(new Event('input',{bubbles:true}));
 const live=getComputedStyle(document.body).getPropertyValue('--p').trim();
 navigateTo('home'); await w(200);
 chk('unsaved colour edit previewed then dropped on leaving', live==='#ff0000' && getComputedStyle(document.body).getPropertyValue('--p').trim()!=='#ff0000', live);
 // reset
 document.querySelector('.theme-preset');
 settingsSet({...settingsGet(),customCss:'',colours:{dark:{},pink:{}}}); applyCustomTheme(); applyCustomCss();
 return out;
})()
