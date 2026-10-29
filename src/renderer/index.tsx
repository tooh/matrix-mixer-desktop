import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

// Service worker management:
// In Electron, clear caches and disable SW so local bundled code is always loaded fresh
if ('serviceWorker' in navigator) {
  if ((window as any).electronAPI || navigator.userAgent.includes('Electron')) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const k of keys) {
          caches.delete(k);
        }
      });
    }
  } else {
    // Mobile Safari / Chrome on iPad:
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
      }).catch((err) => {
        console.log('SW registration error:', err);
      });
    });
  }
}
