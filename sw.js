// ═══════════════════════════════════════════════════════
// LoreOS Service Worker — offline support
//
// Every path here is RELATIVE to this file, so the app works the same at the
// site root (loreos.net) and in a subfolder (bumyann.github.io/LoreOS/).
//
// Strategy
//   app files   stale-while-revalidate: the saved copy is served instantly (so
//               it works offline), and a fresh copy is fetched in the
//               background. Updates therefore show up without relying on the
//               build step bumping the cache name, which matters on hosts
//               that have no build step. When the fresh copy differs, open
//               pages are told so they can offer a reload.
//   fonts       Google Fonts files are cached the first time they are seen
//   precache    best effort: one file failing to download never stops the
//               service worker from installing
//
// The cache name below is stamped by build.sh on every deploy. Keep this line
// in exactly this shape: const CACHE = 'loreos-<digits>'
// ═══════════════════════════════════════════════════════
const CACHE = 'loreos-1785497644';
const FONT_CACHE = 'loreos-fonts-v1';

const ASSETS = [
  './',
  'index.html',
  'legal.html',
  'manifest.json',
  'css/base.css',
  'css/components.css',
  'js/tiptap-bundle.js',
  'js/util.js',
  'js/state.js',
  'js/storage.js',
  'js/history.js',
  'js/pronoun.js',
  'js/lorebook_model.js',
  'js/lorebook.js',
  'js/lorebook_io.js',
  'js/library.js',
  'js/search.js',
  'js/workshop.js',
  'js/character.js',
  'js/character_io.js',
  'js/avatar.js',
  'js/preset.js',
  'js/templates.js',
  'js/templates_data.js',
  'js/attach_lb.js',
  'js/fullscreen.js',
  'js/settings.js',
  'js/sync.js',
  'js/gdrive.js',
  'js/mobile.js',
  'js/header_fit.js',
  'js/dropimport.js',
  'js/trash.js',
  'js/kv.js',
  'js/prompt.js',
  'js/prompt_model.js',
  'js/router.js',
  'js/pwa.js',
  'js/help.js',
  'js/main.js',
  'vendor/lz-string.min.js',
  'vendor/jszip.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-pink-192.png',
  'icons/icon-pink-512.png',
  'icons/favicon.ico',
  'icons/favicon-32.png',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// The stylesheet index.html asks for, saved at install (opaque, no-cors) so the
// fonts also work the very first time the app is opened offline after a visit
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=VT323&family=Noto+Sans:wght@400;500;600&display=swap';
const INDEX_URL = new URL('index.html', self.location).href;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache:'reload' skips the browser's HTTP cache so a stale copy is never
    // frozen into the precache. allSettled: one miss must not fail the install.
    const results = await Promise.allSettled(
      ASSETS.map(a => cache.add(new Request(a, { cache: 'reload' })))
    );
    const failed = results.map((r, i) => (r.status === 'rejected' ? ASSETS[i] : null)).filter(Boolean);
    if (failed.length) console.warn('[LoreOS SW] could not precache:', failed.join(', '));
    try {
      const fonts = await caches.open(FONT_CACHE);
      const res = await fetch(FONT_CSS, { mode: 'no-cors' });
      await fonts.put(FONT_CSS, res);
    } catch (e) { /* offline during install, or blocked: they get cached on first use instead */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Did the fresh copy change compared to what we had saved?
function changed(oldRes, newRes) {
  const h = n => [oldRes.headers.get(n), newRes.headers.get(n)];
  for (const n of ['etag', 'last-modified', 'content-length']) {
    const [a, b] = h(n);
    if (a && b && a !== b) return true;
  }
  return false;
}

let updateNotified = false;
async function notifyUpdate() {
  if (updateNotified) return; // one prompt per update, not one per changed file
  updateNotified = true;
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(c => c.postMessage({ type: 'update-ready' }));
}

async function staleWhileRevalidate(event, request, cacheName, key, fallback) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(key);

  const refresh = fetch(request, { cache: 'no-cache' }).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      if (cached && res.ok && cacheName === CACHE && changed(cached, res)) event.waitUntil(notifyUpdate());
      cache.put(key, res.clone());
    }
    return res;
  }).catch(() => null);

  if (cached) { event.waitUntil(refresh); return cached; }

  const res = await refresh;
  if (res) return res;
  if (fallback) {
    const fb = await cache.match(fallback);
    if (fb) return fb;
  }
  return new Response('You are offline and this file has not been saved yet.', {
    status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: keep what has been seen so the fonts survive going offline
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req, FONT_CACHE, req, null));
    return;
  }

  // Everything else on another origin (Google sign-in, Drive API) is not ours
  if (url.origin !== self.location.origin) return;

  // Page loads: "/" and "/index.html?anything" are the same saved page, and
  // an unsaved page falls back to the app shell when offline
  if (req.mode === 'navigate') {
    const isRoot = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    const key = isRoot ? INDEX_URL : req.url.split('#')[0].split('?')[0];
    event.respondWith(staleWhileRevalidate(event, req, CACHE, key, INDEX_URL));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, req, CACHE, req, null));
});
