/* LexaTrip service worker — app-shell caching + offline fallback. API calls are never cached. */
const CACHE = 'lexatrip-shell-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// ── Push notifications (Firebase Cloud Messaging data messages) ──
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json().data || {}; } catch { /* not JSON */ }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'LexaTrip', { body: d.body || '', icon: '/api/v1/public/brand/icon/192.png', data: { link: d.link || '/' } }),
    self.clients.matchAll({ type: 'window' }).then((list) => list.forEach((c) => c.postMessage({ type: 'lt-push' }))),
  ]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.link || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
    const open = list.find((c) => 'navigate' in c);
    if (!open) return self.clients.openWindow(url.href);
    await open.focus();
    return open.navigate(url.href).catch(() => self.clients.openWindow(url.href));
  }));
});

const DEV = self.location.search.includes('dev'); // development: push only, no caching
self.addEventListener('fetch', (e) => {
  if (DEV) return;
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
