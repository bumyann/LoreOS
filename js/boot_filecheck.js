// The app is built from ES modules, which browsers refuse to load from a file://
// page (double-clicking index.html). Say so instead of leaving a blank screen.
if (location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', function () {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#080b16;color:#e2e7f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;line-height:1.6';
    d.innerHTML = '<div style="max-width:30rem"><h2 style="margin:0 0 .75rem">LoreOS needs a local server</h2>' +
      '<p>Browsers block this kind of app when it is opened straight from a file.</p>' +
      '<p><b>Windows:</b> double-click <code>start.bat</code><br><b>Mac / Linux:</b> run <code>bash start.sh</code><br>' +
      'or just use <a href="https://loreos.net" style="color:#8a9bd2">loreos.net</a>.</p></div>';
    document.body.appendChild(d);
  });
}
