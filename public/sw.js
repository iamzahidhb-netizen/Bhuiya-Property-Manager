/**
 * Bhuiya Property Manager - Application Shell Service Worker
 *
 * CRITICAL FINANCIAL SAFETY POLICY:
 * 1. This service worker caches ONLY static shell assets (HTML, JS, CSS, icons, fonts)
 *    to provide instant app loading and offline shell availability.
 * 2. It NEVER intercepts, caches, or queues financial mutation requests
 *    (Cloud Functions, Firestore mutations, payment transactions).
 * 3. Financial writes are not intercepted here. The app's separate IndexedDB
 *    queue owns offline mutations and is never modified by this service worker.
 */

const CACHE_PREFIX = 'bhuiya-property-manager-';
const CACHE_NAME = `${CACHE_PREFIX}v6-hyperos`;

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Install: Pre-cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS);
    })
  );
});

// Activate: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // STRICT BYPASS: Firebase Auth, Firestore, and Cloud Functions are NEVER cached
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.includes('Callable') ||
    event.request.method !== 'GET'
  ) {
    // Direct network pass-through; never cache or replay
    return;
  }

  // Navigation requests: Network-First with fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.status === 200) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/index.html', response.clone());
          } catch (cacheError) {
            console.warn('[PWA] Could not update the cached application shell:', cacheError);
          }
        }
        return response;
      } catch (networkError) {
        const cache = await caches.open(CACHE_NAME);
        const cachedShell = await cache.match('/index.html') || await cache.match('/');
        if (cachedShell) return cachedShell;
        throw networkError;
      }
    })());
    return;
  }

  const isStaticAsset = /\.(js|css|svg|png|woff2)$/.test(url.pathname);
  if (!isStaticAsset) return;

  const isFingerprintAsset =
    /\/assets\/[^/]+-[\w-]{8,}\.(js|css)$/.test(url.pathname);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);

    if (isFingerprintAsset && cachedResponse) {
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse && networkResponse.status === 200) {
        try {
          await cache.put(event.request, networkResponse.clone());
        } catch (cacheError) {
          console.warn('[PWA] Could not cache a static asset:', cacheError);
        }
      }
      return networkResponse;
    } catch (networkError) {
      if (cachedResponse) return cachedResponse;
      throw networkError;
    }
  })());
});
