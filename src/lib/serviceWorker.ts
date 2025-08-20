
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
          
          // Handle service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available - automatically update
                  console.log('New service worker available, updating...');
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
      
      // Listen for service worker controller changes and reload
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker updated, reloading...');
        window.location.reload();
      });
    });
  }
}

// Helper to clear songs cache
export function clearSongsCache() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.active?.postMessage({
          type: 'CLEAR_SONGS_CACHE'
        });
      })
      .catch(error => {
        console.error('Error clearing songs cache:', error);
      });
  }
}

// Helper to clear all caches (for major updates)
export function clearAllCaches() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.active?.postMessage({
          type: 'CLEAR_ALL_CACHES'
        });
      })
      .catch(error => {
        console.error('Error clearing all caches:', error);
      });
  }
}
