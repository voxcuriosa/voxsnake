const CACHE_NAME = 'neon-snake-v40';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './game_v9.js',
    './manifest.json',
    './icon_192.png',
    './icon_512.png',
    './scores.json'
];

// Install Event
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all: app shell and content');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// Fetch Event (Network First, fall back to Cache)
self.addEventListener('fetch', (e) => {
    // Skip cross-origin requests (like Google Fonts or API) for now, or handle them
    if (!e.request.url.startsWith(location.origin)) return;

    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});
