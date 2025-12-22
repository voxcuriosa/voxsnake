// Update cache version to force refresh
const CACHE_NAME = 'neon-snake-v49-network-first';

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
    self.skipWaiting(); // Force activation immediately
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activated');
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
    self.clients.claim(); // Take control immediately
});

// Fetch Event - NETWORK FIRST STRATEGY
// This ensures users always get the latest version if they are online.
// Cache is only used as a fallback if offline or network fails.
self.addEventListener('fetch', (e) => {
    // Skip cross-origin requests
    if (!e.request.url.startsWith(location.origin)) return;

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // IMPORTANT: Clone the response. A response is a stream
                // and because we want the browser to consume the response
                // as well as the cache consuming the response, we need
                // to clone it so we have two streams.
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(e.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                console.log('[Service Worker] Network failed, serving cache for:', e.request.url);
                return caches.match(e.request);
            })
    );
});
