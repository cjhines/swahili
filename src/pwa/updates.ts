import { useSyncExternalStore } from 'react';

// A new version waits until it's asked for. main.tsx reports a waiting update here; the setup
// screen offers it. Nothing ever reloads the app during a session.

let apply: (() => void) | undefined;
const listeners = new Set<() => void>();

export const reportUpdateWaiting = (applyUpdate: () => void) => {
  apply = applyUpdate;
  listeners.forEach((listener) => listener());
};

export const applyWaitingUpdate = () => apply?.();

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
