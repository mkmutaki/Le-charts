// Service Worker for Le-Charts
const CACHE_NAME = 'le-charts-v2';
const RUNTIME_CACHE = 'le-charts-runtime';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/LJ-vote.jpeg',
];

// Cache specific Supabase API paths
const SUPABASE_API_CACHE_DURATION = 120 * 60 * 1000; // 120 minutes (2 hours) in milliseconds
const SONGS_QUERY_URL = '/rest/v1/LeSongs';

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

// Helper function to determine if a request is for the Supabase API
function isSupabaseRequest(url) {
  return url.hostname.includes('supabase.co') && 
         url.pathname.includes('/rest/v1/');
}

// Helper function to determine if a request is specifically for songs
function isSongsRequest(url) {
  return url.pathname.includes(SONGS_QUERY_URL);
}

// Helper to serialize headers for cache keys
function serializeHeaders(headers) {
  const headersObj = {};
  for (let [key, value] of headers.entries()) {
    headersObj[key] = value;
  }
  return JSON.stringify(headersObj);
}

// Create a unique cache key for a request
function createCacheKey(request) {
  const url = new URL(request.url);
  // Include query params and headers in the cache key
  return `${url.origin}${url.pathname}${url.search}__${request.method}__${serializeHeaders(request.headers)}`;
}

// Fetch event - apply caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;

  try {
    url = new URL(request.url);
  } catch (e) {
    // Malformed URL? just ignore it.
    return;
  }

  // 1) Only handle GET
  // 2) Only handle http: or https:
  // 3) Only handle requests to _your_ origin (skip extensions, analytics, etc.)
  if (
    request.method !== 'GET' ||
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.origin !== self.location.origin
  ) {
    return; 
  }
  
  // Special handling for Supabase API requests
  if (isSupabaseRequest(url)) {
    // For songs data, we use a cache-first strategy with time-based expiration
    if (isSongsRequest(url)) {
      event.respondWith(cacheThenNetworkWithExpiration(event.request));
      return;
    }
    
    // For other Supabase requests, use network-first with fallback to cache
    event.respondWith(networkFirstWithCacheFallback(event.request));
    return;
  }

  // For all other requests (static assets, etc.), use a cache-first strategy
  event.respondWith(cacheFirstWithNetworkFallback(event.request));
});

// Strategy 1: Cache-First with Network Fallback (for static resources)
async function cacheFirstWithNetworkFallback(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    // Only cache valid responses
    if (networkResponse.ok) {
      // Clone the response before caching it
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // If fetch fails, provide a fallback
    return new Response('Network request failed', { 
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Strategy 2: Network-First with Cache Fallback (for other API requests)
async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Clone before caching
      await cache.put(createCacheKey(request), networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(createCacheKey(request));
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Network request failed and no cache available', {
      status: 504,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Strategy 3: Cache-Then-Network with Time-Based Expiration (for songs data)
async function cacheThenNetworkWithExpiration(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cacheKey = createCacheKey(request);
  
  // Try to get from cache first
  const cachedResponse = await cache.match(cacheKey);
  
  if (cachedResponse) {
    // Check if the cache is fresh using the Last-Modified header
    const cacheDate = new Date(cachedResponse.headers.get('sw-cache-date'));
    const now = new Date();
    
    if ((now - cacheDate) < SUPABASE_API_CACHE_DURATION) {
      // Cache is fresh, return it
      return cachedResponse;
    }
    // Otherwise cache is stale, proceed to fetch a new one
  }

  // If cache miss or stale, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Create a modified response with our cache date
      const responseToCache = new Response(networkResponse.clone().body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: new Headers(networkResponse.headers)
      });
      
      // Add a header with the cache date
      responseToCache.headers.set('sw-cache-date', new Date().toISOString());
      
      // Save to cache
      await cache.put(cacheKey, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    // If fetch fails but we have a cached response (even if stale), return it
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Otherwise, return an error response
    return new Response('Failed to fetch songs and no cache available', {
      status: 504,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_SONGS_CACHE') {
    clearSongsCache();
  }
});

// Function to clear the songs cache on demand
async function clearSongsCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  
  for (const request of keys) {
    const url = new URL(request.url);
    if (url.pathname.includes(SONGS_QUERY_URL)) {
      await cache.delete(request);
    }
  }
}
