// ═══════════════════════════════════════════════════════
// PWA — offline support: registers the service worker and tells the user when
// a newer version has been downloaded or the connection changes.
// ═══════════════════════════════════════════════════════

import { toast } from './util.js';

export function setupOffline() {
  // Relative path so it also works when the app lives in a subfolder (GitHub
  // Pages: /LoreOS/). Not on file://, where service workers can't run.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const register = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    if (document.readyState === 'complete') register(); else window.addEventListener('load', register);

    // The service worker serves the saved copy first and refreshes it in the
    // background, so tell the user when a newer version has been downloaded
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'update-ready') {
        toast('A new version of LoreOS is ready. Reload the page to update.', 'info');
      }
    });
  }
  window.addEventListener('offline', () => toast("You're offline. Everything still works and is saved on this device.", 'info'));
  window.addEventListener('online',  () => toast('Back online.', 'ok'));
}
