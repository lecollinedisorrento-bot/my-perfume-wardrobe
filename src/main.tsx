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
  // itself. An installed app can stay open for days, so also look for a new
  // version whenever it comes back to the foreground and every 30 minutes.
  void import('virtual:pwa-register').then(({ registerSW }) =>
    registerSW({
      immediate: true,
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        const check = () => {
          if (navigator.onLine) void reg.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        window.setInterval(check, 30 * 60 * 1000);
      },
    }),
  );
}
