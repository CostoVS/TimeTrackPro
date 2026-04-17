const CACHE_NAME = 'timetrack-v4';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME + '-api').then(cache => cache.put(e.request, resClone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request).then(res => {
      const respClone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, respClone));
      return res;
    }).catch(() => new Response('Offline', { status: 503 })))
  );
});
