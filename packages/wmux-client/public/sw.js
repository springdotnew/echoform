// Minimal service worker for PWA installability.
// No caching — wmux is a dev tool that should always fetch fresh assets.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
