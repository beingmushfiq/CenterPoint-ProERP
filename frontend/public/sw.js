// ─────────────────────────────────────────────────────────────
// MULTI-ZONE SERVICE WORKER (ERP Console vs E-Commerce Storefront)
// ─────────────────────────────────────────────────────────────

const ERP_CACHE_NAME = 'slicemart-erp-cache-v3';
const STORE_CACHE_NAME = 'slicemart-storefront-cache-v3';

// Only pre-cache static immutable shell assets.
// Never pre-cache index.html or root navigation to prevent stale module chunk mismatches.
const STATIC_ASSETS = [
  '/favicon.svg',
  '/manifest.json',
];

// 1. Install event — pre-cache core immutable assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ERP_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate event — immediately purge ALL obsolete cache generations
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== ERP_CACHE_NAME && key !== STORE_CACHE_NAME) {
            console.log('[SW] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Allow client app to trigger immediate skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 3. Fetch event — route-aware caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle standard HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  const url = new URL(request.url);
  const isStorefront = url.pathname.startsWith('/store') || url.pathname.includes('/storefront');
  const targetCache = isStorefront ? STORE_CACHE_NAME : ERP_CACHE_NAME;

  // A. Navigation requests: Network First (strictly fresh from server) -> Cache Fallback (offline only)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(targetCache).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const indexCached = await caches.match('/index.html');
          if (indexCached) return indexCached;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // B. Static Assets (Scripts, CSS, Images, Fonts)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(targetCache).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 404, statusText: 'Not Found' }));
      })
    );
    return;
  }

  // C. Default: Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Request Timeout' });
      })
  );
});
