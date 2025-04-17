
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeTheme } from './lib/theme'
import { registerServiceWorker } from './lib/serviceWorker'

// Initialize theme on app load
initializeTheme();

// Register service worker for production mode
if (import.meta.env.PROD) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);
