// Service Worker for FORCE App Push Notifications
// Version: 1.0.0

const CACHE_NAME = 'force-push-v1';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'FORCE Reminder',
    body: 'You have a new reminder',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { url: '/dashboard' },
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload,
      };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    image: data.image,
    tag: data.tag || 'force-notification',
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const url = notificationData.url || '/dashboard';
  const notificationId = notificationData.notificationId;

  if (event.action === 'dismiss') {
    // Mark as dismissed on server
    if (notificationId) {
      fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      }).catch((err) => console.error('[SW] Dismiss error:', err));
    }
    return;
  }

  // Default action or 'view' action - open/focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          // Mark as read
          if (notificationId) {
            fetch(`/api/notifications/${notificationId}/read`, {
              method: 'POST',
              credentials: 'include',
            }).catch((err) => console.error('[SW] Mark read error:', err));
          }
          // Navigate to URL and focus
          client.navigate(url);
          return client.focus();
        }
      }
      // No window open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url).then((client) => {
          if (notificationId) {
            fetch(`/api/notifications/${notificationId}/read`, {
              method: 'POST',
              credentials: 'include',
            }).catch((err) => console.error('[SW] Mark read error:', err));
          }
          return client;
        });
      }
    })
  );
});

// Notification close event - handle dismissal without click
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  
  const notificationData = event.notification.data || {};
  const notificationId = notificationData.notificationId;

  // Optionally track dismissal
  if (notificationId) {
    fetch(`/api/notifications/${notificationId}/dismiss`, {
      method: 'POST',
      credentials: 'include',
    }).catch((err) => console.error('[SW] Dismiss error:', err));
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline actions (optional)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  // Sync any pending notification actions when back online
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('/api/notifications/')) {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
        }
      }
    }
  } catch (err) {
    console.error('[SW] Sync error:', err);
  }
}

// Periodic background sync for reminder checks (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders());
  }
});

async function checkReminders() {
  // Optional: Local reminder check for offline support
  console.log('[SW] Checking reminders...');
}
