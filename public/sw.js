const CACHE_NAME = 'timetrack-v2.3.2';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== CACHE_NAME + '-api') {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  // Network First, Fallback to Cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(e.request.url.includes('/api/') ? CACHE_NAME + '-api' : CACHE_NAME)
          .then(cache => cache.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
