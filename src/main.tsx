import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './App.tsx';
import { fetchNewest, reportUpdateWaiting } from './pwa/updates.ts';
import './styles/global.css';

// The service worker (sw.js, scope /swahili/) caches the whole app for offline use. A new version
// waits until the setup screen's "Update now" is tapped, or until the app is next fully closed and
// reopened, so it can never interrupt a session.
let registration: ServiceWorkerRegistration | undefined;

/** "Update now": the newest version takes over and the page reloads (Workbox does the reload). */
const applyUpdate = async () => {
  if (registration) await fetchNewest(registration);
  await updateServiceWorker(true);
  // It should have reloaded by now. If it hasn't, reload anyway rather than seem to do nothing.
  setTimeout(() => window.location.reload(), 5000);
};

const updateServiceWorker = registerSW({
  onNeedRefresh: () => reportUpdateWaiting(applyUpdate),
  onRegisteredSW: (_url, registered) => {
    registration = registered;
    // A home-screen app can stay open for days without navigating: check for updates hourly too.
    if (registered) setInterval(() => registered.update(), 60 * 60 * 1000);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
