/* LexaTrip service worker — app-shell caching + offline fallback. API calls are never cached. */
const CACHE = 'lexatrip-shell-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/^\/(api|uploads|hotels|blog|sitemap|sitemaps|robots)/.test(url.pathname)) return; // server-owned, always live
  if (req.mode === 'navigate') { // SPA pages: network first, cached shell when offline
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  if (/\/assets\/|\.(png|jpg|svg|webp|woff2?)$/.test(url.pathname)) { // hashed assets & images: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
  }
});
