// ═══════════════════════════════════════════════════════
// LoreOS Service Worker — offline support
// ═══════════════════════════════════════════════════════
const CACHE = 'loreos-v0.1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/components.css',
  '/js/core.js',
  '/js/lorebook.js',
  '/js/character.js',
  '/js/preset.js',
  '/js/pronoun.js',
  '/js/templates.js',
  '/js/attach_lb.js',
  '/js/fullscreen.js',
  '/js/settings.js',
  '/js/sync.js',
  '/js/mobile.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-pink-192.png',
  '/icons/icon-pink-512.png',
  '/icons/favicon.ico',
  '/icons/favicon-32.png',
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first, fall back to network
self.addEventListener('fetch', e => {
  // Skip non-GET and cross-origin (fonts etc)
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      // Cache new assets on the fly
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
