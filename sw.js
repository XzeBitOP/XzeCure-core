
const CACHE_NAME = 'xzecure-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html']);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'medication-sync') {
    event.waitUntil(checkAndNotifyMedications());
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'XzeCure Reminder', body: 'Time for your medication' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
      badge: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
      vibrate: [200, 100, 200]
    })
  );
});

async function checkAndNotifyMedications() {
  // This logic runs in background when sync is triggered
  // In a real app, this would check IndexedDB for scheduled meds
  console.log('Syncing medication reminders...');
}