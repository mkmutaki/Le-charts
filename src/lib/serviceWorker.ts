
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);

          // Check for SW updates right away
          checkForSWUpdate(registration);

          // Re-check every 5 minutes so long-lived tabs pick up new deploys
          setInterval(() => checkForSWUpdate(registration), 5 * 60 * 1000);

          // Also re-check whenever the user switches back to this tab
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              checkForSWUpdate(registration);
            }
          });

          // Handle service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available - activate it immediately
                  console.log('New service worker available, activating...');
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });

      // Reload once the new service worker takes control.
      // The guard prevents an infinite reload loop.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('New service worker activated, reloading for fresh content...');
          window.location.reload();
        }
      });
    });
  }
}

/** Ask the browser to re-fetch the SW script and compare it byte-for-byte. */
function checkForSWUpdate(registration: ServiceWorkerRegistration) {
  registration.update().catch(err => {
    // update() fails when offline – that’s fine, we’ll try again later.
    console.debug('SW update check skipped (likely offline):', err);
  });
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
