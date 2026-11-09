const SW_VERSION = "my-ice-cream-pwa-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }
  // Keep requests network-first so live shop, product and admin data are never served stale.
  event.respondWith(fetch(event.request));
});
