import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully intercept and suppress benign HMR/WebSocket development errors so they don't trigger intrusive crash overlays
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = event.reason ? String(event.reason.message || event.reason) : '';
  if (reasonStr.includes('WebSocket') || reasonStr.includes('vite') || reasonStr.includes('hmr')) {
    event.preventDefault();
    console.debug('[Vite HMR] Benign development socket rejection suppressed:', reasonStr);
  }
});

// Register Service Worker for PWA (with auto-updating on load)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[Service Worker] Geregistreerd met scope:', registration.scope);
        
        // Auto-update check
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Service Worker] Nieuwe appversie beschikbaar! Herstarten...');
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[Service Worker] Registratiefout:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
