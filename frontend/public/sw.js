// Service worker minimal: shell caching for offline-friendly experience.
// Critical: all /api/* requests bypass cache (always network) for clinical data correctness.

const CACHE_NAME = "clinimetria-v1";
const SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ALWAYS bypass cache for API and non-GET requests (medical data must be fresh).
  if (req.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Network-first with cache fallback for static assets.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => null);
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});
