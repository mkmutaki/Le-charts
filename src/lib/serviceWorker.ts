
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
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
