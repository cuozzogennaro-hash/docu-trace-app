self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "DocuTrace HACCP", body: "Hai compiti in scadenza!" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title || "DocuTrace HACCP", {
      body: data.body || "Hai compiti in scadenza!",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [200, 100, 200],
      data: data.url || "/",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const url = event.notification.data || "/";
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});