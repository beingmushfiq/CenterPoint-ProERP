// ─────────────────────────────────────────────────────────────
// MULTI-ZONE SERVICE WORKER (ERP Operations Console vs Storefront)
// ─────────────────────────────────────────────────────────────

const ERP_CACHE_NAME = 'slicemart-erp-cache-v4';
const STORE_CACHE_NAME = 'slicemart-storefront-cache-v4';

const STATIC_ASSETS = [
  '/favicon.svg',
  '/pwa-icon.svg',
];

// Offline fallback HTML template
const OFFLINE_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>Offline Mode</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0F172A;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      max-width: 420px;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 36px 28px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(16px);
    }
    .icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: rgba(37, 99, 235, 0.15);
      border: 1px solid rgba(37, 99, 235, 0.3);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon-badge svg {
      width: 32px;
      height: 32px;
      stroke: #60A5FA;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 10px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 13.5px;
      line-height: 1.6;
      color: #94A3B8;
      margin: 0 0 24px;
    }
    button {
      background: #2563EB;
      color: #FFFFFF;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    button:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <h1>Working in Offline Mode</h1>
    <p>You are currently offline. Locally cached production runs and storefront data remain accessible. Your active session will reconnect automatically once network returns.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`;

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
  const path = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  const isExplicitErp =
    path.startsWith('/dashboard') ||
    path.startsWith('/production') ||
    path.startsWith('/inventory') ||
    path.startsWith('/sales') ||
    path.startsWith('/pos') ||
    path.startsWith('/finance') ||
    path.startsWith('/hr') ||
    path.startsWith('/settings') ||
    path.startsWith('/login') ||
    path.startsWith('/platform');

  const isStorefront =
    path.startsWith('/store') ||
    path.startsWith('/products') ||
    path.startsWith('/collections') ||
    path.startsWith('/checkout') ||
    path.startsWith('/order-confirmed') ||
    path.startsWith('/track') ||
    path.includes('storefront') ||
    (!isExplicitErp && (hostname.includes('store') || (!hostname.startsWith('admin') && !hostname.startsWith('proerp'))));

  const targetCache = isStorefront ? STORE_CACHE_NAME : ERP_CACHE_NAME;

  // A. Navigation requests: Network First -> Cache Fallback -> Branded Offline Screen
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
          return new Response(OFFLINE_PAGE_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // B. Manifests & Dynamic PWA icons: Network First with cache fallback
  if (path.includes('manifest') || path.includes('/pwa/icon')) {
    event.respondWith(
      fetch(request)
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
          return new Response('', { status: 408, statusText: 'Offline' });
        })
    );
    return;
  }

  // C. Static Assets (Scripts, CSS, Images, Fonts)
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

  // D. Default: Network with Cache Fallback
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
