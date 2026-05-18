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

  './src/css/app.css',

  './src/js/appVersion.js',
  './src/js/app.js',

  './src/js/core/scoringEngine.js',
  './src/js/core/profileBuilder.js',
  './src/js/core/profileComparator.js',
  './src/js/core/lifeSimulationEngine.js',
  './src/js/core/difficulty.js',
  './src/js/core/labels.js',
  './src/js/core/geometry.js',

  './src/js/data/realms.js',
  './src/js/data/scoreTables.js',
  './src/js/data/scales.js',
  './src/js/data/sampleEvents.js',
  './src/js/data/presets.js',

  './src/js/db/db.js',
  './src/js/db/migrations.js',
  './src/js/db/repositories.js',

  './src/js/canvas/mindMapGeometry.js',
  './src/js/canvas/mindMapRenderer.js',
  './src/js/canvas/labelLayout.js',
  './src/js/canvas/markerRenderer.js',

  './src/js/ui/dom.js',
  './src/js/ui/screens.js',
  './src/js/ui/profileScreen.js',
  './src/js/ui/mindMapScreen.js',
  './src/js/ui/ratingScreen.js',
  './src/js/ui/retroTheme.js',
  './src/js/ui/keyboard.js',
  './src/js/ui/retroTextScreen.js',
  './src/js/ui/retroMenuScreen.js',
  './src/js/ui/router.js',
  './src/js/ui/comparisonScreen.js',
  './src/js/ui/exportScreen.js',
  './src/js/ui/simulationScreen.js',
  './src/js/ui/subjectForm.js',
  './src/js/ui/toast.js'
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
