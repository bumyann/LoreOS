// Apply saved custom fonts before first paint. settings.js applyFonts() used
// to be the first place they were applied, at the very end of init, so the
// default fonts flashed for a moment on every load.
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('aet_fonts') || '{}');
    var roles = { fp: '--fp', fx: '--fx', fb: '--fb' };
    var root = document.documentElement;
    Object.keys(roles).forEach(function (role) {
      var d = saved[role];
      if (!d || !d.name) return;
      if (d.type === 'gf') {
        var link = document.createElement('link');
        link.id = 'gf-font-' + role;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + d.name.trim().replace(/ /g, '+') + '&display=swap';
        document.head.appendChild(link);
        root.style.setProperty(roles[role], "'" + d.name.trim() + "', sans-serif");
      } else if (d.type === 'upload' && d.dataUrl) {
        var ext = d.name.split('.').pop().toLowerCase();
        var fmt = ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : 'truetype';
        var st = document.createElement('style');
        st.id = 'uploaded-font-' + role;
        st.textContent = "@font-face { font-family: 'CustomFont_" + role + "'; src: url('" + d.dataUrl + "') format('" + fmt + "'); }";
        document.head.appendChild(st);
        root.style.setProperty(roles[role], "'CustomFont_" + role + "', sans-serif");
      }
    });
  } catch (e) {}
})();
