import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker (offline + installable). Skipped in dev to avoid stale caches.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // autoUpdate: a new version installs in the background and the page reloads
  // itself. iOS home-screen apps can hold on to an old version, so we also compare
  // build ids with the server on start, on return to the foreground and every
  // 30 minutes, and refresh the app shell when they differ.
  void Promise.all([import('virtual:pwa-register'), import('./services/update')]).then(([{ registerSW }, { autoUpdate }]) => {
    let reg: ServiceWorkerRegistration | undefined;
    registerSW({
      immediate: true,
      onRegisteredSW(_url, r) {
        reg = r;
      },
    });
    const check = () => void autoUpdate(reg);
    check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.setInterval(check, 30 * 60 * 1000);
  });
}
