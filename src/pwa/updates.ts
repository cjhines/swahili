import { useSyncExternalStore } from 'react';

// A new version waits until it's asked for. main.tsx reports a waiting update here; the setup
// screen offers it. Nothing ever reloads the app during a session.

let apply: (() => unknown) | undefined;
const listeners = new Set<() => void>();

export const reportUpdateWaiting = (applyUpdate: () => unknown) => {
  apply = applyUpdate;
  listeners.forEach((listener) => listener());
};

export const applyWaitingUpdate = async () => {
  await apply?.();
};

/** How long "Update now" waits for a newer version to download before using the one it has. */
export const NEWEST_TIMEOUT_MS = 15_000;

/**
 * Before switching to the waiting version, checks for an even newer one and waits for it to
 * download. Without this, a version that has sat waiting through later deploys is switched to,
 * the reloaded page finds the newer one at once, and "Update now" is back: the tap looks like it
 * did nothing. Offline, or past the timeout, the waiting version is used as it is.
 */
export const fetchNewest = async (
  registration: Pick<ServiceWorkerRegistration, 'update' | 'installing'>,
  timeoutMs = NEWEST_TIMEOUT_MS
) => {
  const downloaded = (async () => {
    try {
      await registration.update();
    } catch {
      return; // offline
    }
    const installing = registration.installing;
    if (!installing) return; // nothing newer
    await new Promise<void>((resolve) => {
      const check = () => {
        if (installing.state === 'installing') return;
        installing.removeEventListener('statechange', check);
        resolve();
      };
      installing.addEventListener('statechange', check);
      check();
    });
  })();
  await Promise.race([
    downloaded,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useUpdateWaiting = () =>
  useSyncExternalStore(
    subscribe,
    () => apply !== undefined,
    () => false
  );
