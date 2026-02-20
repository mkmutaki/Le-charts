// Service Worker for Le-Charts
// __BUILD_VERSION__ is replaced at build time by the Vite plugin (see vite.config.ts).
// During development the placeholder stays as-is — the SW still works, it just
// won't benefit from versioned cache names.
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `le-charts-static-${BUILD_VERSION}`;
const RUNTIME_CACHE = `le-charts-runtime-${BUILD_VERSION}`;

// Only precache truly static, un-hashed assets.
// index.html is intentionally EXCLUDED — it must always be fetched from the
// network so users immediately see new deployments.
const PRECACHE_ASSETS = [
  '/favicon.ico',
  '/LJ-vote.jpeg',
];

// Regex that matches Vite content-hashed assets.
// e.g. /assets/index-a1b2c3d4.js  or  /assets/style-deadbeef.css
const HASHED_ASSET_RE = /\/assets\/.+\.[a-f0-9]{8,}\./;

// Supabase constants (kept for clearSongsCache helper)
const SCHEDULED_ALBUMS_URL = '/rest/v1/scheduled_albums';
const SCHEDULED_TRACKS_URL = '/rest/v1/scheduled_album_tracks';
const SONG_VOTES_URL = '/rest/v1/song_votes';

// Install event - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event – route each request to the appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;

  try {
    url = new URL(request.url);
  } catch (e) {
    // Malformed URL? just ignore it.
    return;
  }

  // Only intercept same-origin GET requests over HTTP(S)
  if (
    request.method !== 'GET' ||
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages) → Network-first
  //    Always fetch the latest index.html so new deployments appear immediately.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstForNavigation(request));
    return;
  }

  // 2. Vite content-hashed assets → Cache-first (immutable)
  //    e.g. /assets/index-a1b2c3d4.js – the hash changes when content changes,
  //    so a cached copy is always correct.
  if (HASHED_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirstForHashedAssets(request));
    return;
  }

  // 3. All other same-origin assets → Stale-while-revalidate
  //    Serve instantly from cache for speed, refresh in the background.
  event.respondWith(staleWhileRevalidate(request));
});

// ── Strategy 1: Network-first for navigation (HTML) ──────────────────────────
// The freshest index.html always wins. The cached copy is only a fallback when
// the user is offline.
async function networkFirstForNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || new Response('You are offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ── Strategy 2: Cache-first for immutable hashed assets ──────────────────────
// Vite embeds a content hash in every JS/CSS filename. When the source changes
// the filename changes, so a cached entry can never be stale.
async function cacheFirstForHashedAssets(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Asset unavailable offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ── Strategy 3: Stale-while-revalidate for other static assets ───────────────
// Serve immediately from cache for speed, then refresh the cached copy in the
// background so the *next* visit gets the updated file.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cached || (await networkFetch) || new Response('Unavailable', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_SONGS_CACHE') {
    clearSongsCache();
  }
  
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    clearAllCaches();
  }
});

// Function to clear the scheduled albums cache on demand
async function clearSongsCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  
  for (const request of keys) {
    const url = new URL(request.url);
    // Clear both scheduled_albums and scheduled_album_tracks caches, as well as RPC functions
    if (url.pathname.includes(SCHEDULED_ALBUMS_URL) || 
        url.pathname.includes(SCHEDULED_TRACKS_URL) ||
        url.pathname.includes('/rest/v1/rpc/')) {
      await cache.delete(request);
    }
  }
}

// Function to clear all caches (for major updates)
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}
