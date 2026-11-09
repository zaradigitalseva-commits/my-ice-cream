self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Receive Web Push messages once a trusted push sender is configured.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof payload.title === "string" ? payload.title : "MY ICE CREAM";
  const options = {
    body: typeof payload.body === "string" && payload.body
      ? payload.body
      : "नए products और offers देखने के लिए MY ICE CREAM खोलें।",
    icon: "/my-ice-cream-app.svg",
    badge: "/my-ice-cream-app.svg",
    tag: typeof payload.tag === "string" ? payload.tag : "my-ice-cream-update",
    data: { url: typeof payload.url === "string" ? payload.url : "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/",
    self.location.origin
  ).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url === targetUrl && "focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }
  // Keep requests network-first so live shop, product and admin data are never served stale.
  event.respondWith(fetch(event.request));
});
