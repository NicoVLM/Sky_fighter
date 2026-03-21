// Sky Fighter — Service worker (non-caching)
// Registers for PWA installability without caching files
// This avoids black screens caused by stale cached JS

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.map((name) => caches.delete(name)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(fetch(e.request));
});
