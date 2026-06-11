// TEMP: self-unregistering service worker — clears all caches and reloads clients.
// This replaces the old caching SW so the dev server bundle loads fresh.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: "window" }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});
