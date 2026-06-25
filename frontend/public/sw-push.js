/**
 * sw-push.js
 * Service Worker script to receive and handle background Push Notifications.
 * This is loaded into the PWA Service Worker via workbox.importScripts.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Sezar Drive';
    const options = {
      body: data.body || '',
      icon: '/icon-192.png?v=5',
      badge: '/icon-192.png?v=5',
      tag: data.tag || 'sezar-notification',
      data: data.data || {},
      vibrate: [100, 50, 100],
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch {
    // If payload is not valid JSON, show text fallback
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Sezar Drive', {
        body: text,
        icon: '/icon-192.png?v=5',
        badge: '/icon-192.png?v=5',
      })
    );
  }
});

// Handle notification click (e.g. open/focus app and navigate to trips)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickAction = '/driver/trips';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(clickAction) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(clickAction);
      }
    })
  );
});
