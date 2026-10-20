// Test harness helpers for the module build.
// - ev(): run code in the page with every LoreOS export / state variable in scope, so tests can call
//   createChar(), read lorebook, assign charLibrary = {...} just as they could with classic globals.
// - init: records every file the app "downloads" in window.__dl (name + text) and exposes dl().
exports.ev=(pg,fnOrCode,arg)=>{
  const code=typeof fnOrCode==='function'?`(${fnOrCode.toString()})(${arg===undefined?'':JSON.stringify(arg)})`:`(${fnOrCode})`;
  return pg.evaluate(`(function(){ with(window.LoreOS||window){ return ${code}; } })()`);
};
exports.init=`(() => {
  window.__dl = []; const blobs = new Map();
  const oc = URL.createObjectURL.bind(URL);
  URL.createObjectURL = b => { const u = oc(b); blobs.set(u, b); return u; };
  const oclick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { const b = blobs.get(this.href); const rec = { name: this.download, blob: b, text: null }; window.__dl.push(rec); if (b && b.text) b.text().then(t => { rec.text = t; }); return; }
    return oclick.call(this);
  };
  window.dl = async () => { await new Promise(r => setTimeout(r, 60)); return window.__dl[window.__dl.length - 1]; };
})();`;
