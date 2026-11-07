import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './App.tsx';
import { reportUpdateWaiting } from './pwa/updates.ts';
import './styles/global.css';

// The service worker (sw.js, scope /swahili/) caches the whole app for offline use. A new version
// waits until the setup screen's "Update now" is tapped, or until the app is next fully closed and
// reopened, so it can never interrupt a session.
const updateServiceWorker = registerSW({
  onNeedRefresh: () => reportUpdateWaiting(() => updateServiceWorker(true)),
  onRegisteredSW: (_url, registration) => {
    // A home-screen app can stay open for days without navigating: check for updates hourly too.
    if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
