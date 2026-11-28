// Saarepagar offline cache (installed web app). The page itself comes from the network first, so a new build shows as
// soon as the app opens online, and from the cache when offline. Icons and the manifest are cache-first.
// Bump V to drop old caches.
const V = 'saarepagar-1', FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const page = r.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(r.url).pathname);
  e.respondWith(caches.open(V).then(async c => {
    if (page) {
      try { const res = await fetch(r, { cache: 'no-store' }); if (res.ok) c.put('./index.html', res.clone()); return res; }
      catch (err) { return (await c.match('./index.html')) || (await c.match('./')) || Response.error(); }
    }
    const hit = await c.match(r, { ignoreSearch: true });
    return hit || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; });
  }));
});
