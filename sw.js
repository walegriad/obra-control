const VERSION = 'obra-control-v1';
const LOCALES = [
  './', './index.html', './engine.js', './photos.js',
  './manifest.json', './icon-192.png', './icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(LOCALES)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(caches.match(req).then((enCache) => {
    const red = fetch(req).then((res) => {
      if (res && (res.status === 200 || res.type === 'opaque')) {
        const copia = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    }).catch(() => enCache);
    return enCache || red;
  }));
});
