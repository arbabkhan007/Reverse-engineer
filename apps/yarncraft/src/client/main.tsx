import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { StoreProvider } from './store.tsx';
import { ToastProvider } from './components/ui.tsx';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

/*
 * Register the offline shell. Only in a production build: a service worker in
 * front of the Vite dev server would serve cached modules and make edits look
 * like they did nothing.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Offline support is a bonus; the app still works without it.
    });
  });
}

createRoot(container).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
