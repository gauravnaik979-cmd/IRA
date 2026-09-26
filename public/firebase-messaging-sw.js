// Firebase Messaging & PWA Offline Service Worker for IRA Hostel
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase inside Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDuJDTtthc0y0zuxuOvpuQZDZmVzAF2YWQ",
  authDomain: "ira-hostel.firebaseapp.com",
  projectId: "ira-hostel",
  storageBucket: "ira-hostel.firebasestorage.app",
  messagingSenderId: "960894763161",
  appId: "1:960894763161:web:b56b4bf13cd96a1f5eb808"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background notification received:', payload);
  const title = payload.notification?.title || 'IRA Hostel Official Notice';
  const options = {
    body: payload.notification?.body || payload.data?.message || 'New official hostel notice released.',
    icon: '/pwa-192x192.png',
    badge: '/favicon.svg',
    data: payload.data || {},
    tag: payload.data?.noticeId || `notice_${Date.now()}`
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// PWA Offline Caching Engine
const CACHE_NAME = 'ira-hostel-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/favicon.svg',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor: SPA Navigation + Static Asset Cache Fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or external API calls (Firebase Firestore / Auth / GCP)
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // SPA Navigation: Network-First with Offline Cache Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/index.html') || caches.match(req);
      })
    );
    return;
  }

  // Static Assets (JS, CSS, Images, Fonts)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache freshness
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for missing images
        if (req.headers.get('accept')?.includes('image')) {
          return caches.match('/favicon.svg');
        }
      });
    })
  );
});
