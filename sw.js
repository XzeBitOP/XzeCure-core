
const CACHE_NAME = 'xzecure-offline-v3';

// Assets to cache immediately on installation for true background download
const PRE_CACHE_ASSETS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/constants.tsx',
  '/services/storageService.ts',
  '/services/pdfService.ts',
  '/services/notificationService.ts',
  '/manifest.json',
  // External Libraries from Import Map
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@^19.2.3',
  'https://esm.sh/react-dom@^19.2.3/',
  'https://esm.sh/lucide-react@^0.562.0',
  'https://esm.sh/html2canvas@^1.4.1',
  'https://esm.sh/jspdf@^3.0.4',
  'https://esm.sh/pdfjs-dist@^4.0.379',
  'https://esm.sh/pdfjs-dist@^4.0.379/build/pdf.worker.mjs',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
  // Static Clinical Assets (Logos & UI elements)
  'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR', // DEFAULT_LOGO
  'https://lh3.googleusercontent.com/d/1PVkL2iQhLYDTPXX0Od5M3Va0GMauwpN8', // DEFAULT_LETTERHEAD
  'https://lh3.googleusercontent.com/d/14Ax9aU31Gaja2kAvnLbIFLbhbbAiB4D5'  // PAYMENT_QR
];

self.addEventListener('install', (event) => {
  // Forces the waiting service worker to become the active service worker.
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('XzeCure: Building Offline Node - Downloading Assets...');
      return cache.addAll(PRE_CACHE_ASSETS).catch(err => {
        console.error('Pre-cache failed for some assets, but continuing...', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('XzeCure: Clearing Old Node Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim all clients immediately
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Bypass cache for WhatsApp and Telephone links - they need native handling
  if (url.includes('wa.me') || url.startsWith('tel:')) {
    return; 
  }

  // Strategy: Cache First, falling back to Network
  // This ensures the fastest possible offline experience
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Don't cache non-successful responses or cross-origin POST requests
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // Cache the newly fetched resource for future offline use
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // If both fail (offline and not in cache), return the index for the SPA to handle
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
