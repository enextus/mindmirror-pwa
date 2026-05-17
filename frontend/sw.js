// =====================================================================
// sw.js – Service Worker der Mind Mirror PWA
// =====================================================================

importScripts('./src/js/appVersion.js');

const CACHE_VERSION = self.MIND_MIRROR_APP_VERSION || 'dev';
const APP_CACHE = `mindmirror-app-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './src/js/appVersion.js',
  './src/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('mindmirror-app-') && key !== APP_CACHE)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match('./offline.html')))
  );
});

// Ende sw.js
