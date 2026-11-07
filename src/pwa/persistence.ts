import { isStandalone } from './platform.ts';
import type { ProgressStore } from '../storage/progress.ts';

export type PersistStatus = 'granted' | 'not-granted' | 'unsupported';

/**
 * Asks the browser not to evict the app's storage. Asked once in a browser tab and once more
 * after installing to the home screen (where Safari is likelier to agree), never on every
 * launch: Firefox shows a prompt each time it's asked.
 */
export const requestPersistentStorage = async (
  store: ProgressStore
): Promise<PersistStatus> => {
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  if (await storage.persisted()) {
    await store.setMeta('persistGranted', true);
    return 'granted';
  }

  const where = isStandalone() ? 'standalone' : 'browser';
  const asked = ((await store.getMeta('persistAsked')) ?? {}) as Partial<
    Record<typeof where, boolean>
  >;
  if (asked[where]) return 'not-granted';

  const granted = await storage.persist();
  await store.setMeta('persistAsked', { ...asked, [where]: true });
  await store.setMeta('persistGranted', granted);
  return granted ? 'granted' : 'not-granted';
};

export const persistStatus = async (): Promise<PersistStatus> => {
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage?.persisted) return 'unsupported';
  return (await storage.persisted()) ? 'granted' : 'not-granted';
};
