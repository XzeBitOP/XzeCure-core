
const CACHE_NAME = 'xzecure-v4';
const ASSETS = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// A simple in-memory store for background timers
const timers = new Map();

self.addEventListener('message', (event) => {
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay, tag, actions, data } = event.data;
    
    // Clear existing timer for this tag to prevent duplicates
    if (timers.has(tag)) {
      clearTimeout(timers.get(tag));
    }
    
    const timerId = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        tag,
        actions,
        data,
        icon: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
        badge: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        dir: 'ltr'
      });
      timers.delete(tag);
    }, delay);
    
    timers.set(tag, timerId);
  }

  if (event.data.type === 'CANCEL_ALL_NOTIFICATIONS') {
    for (const id of timers.values()) {
      clearTimeout(id);
    }
    timers.clear();
  }
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'inform_doctor' || action === 'inform_relative') {
    const phone = action === 'inform_doctor' ? data.doctorPhone : data.relativePhone;
    const message = data.shareMessage;
    
    if (phone) {
      // Clean phone number (remove non-digits)
      const cleanPhone = phone.replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          // Attempt to focus or open new tab for WhatsApp
          return self.clients.openWindow(waUrl);
        })
      );
    }
  } else {
    // Default click behavior: open/focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});
