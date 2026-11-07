import { useEffect, useState } from 'react';
import decks from 'virtual:decks';

import { Study } from './Study.tsx';
import { requestPersistentStorage } from './pwa/persistence.ts';
import { createScheduler } from './scheduler/scheduler.ts';
import { ProgressStore } from './storage/progress.ts';

type Boot =
  | { status: 'loading' }
  | { status: 'ready'; store: ProgressStore }
  | { status: 'error'; message: string };

const useProgressStore = (): Boot => {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    let opened: ProgressStore | undefined;
    (async () => {
      try {
        const scheduler = await createScheduler();
        opened = await ProgressStore.open({ scheduler });
        if (cancelled) {
          opened.close();
          return;
        }
        setBoot({ status: 'ready', store: opened });
        // In the background: nothing waits on it, and a refusal isn't an error.
        requestPersistentStorage(opened).catch(() => undefined);
      } catch (error) {
        if (!cancelled)
          setBoot({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    })();
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, []);
  return boot;
};

export const App = () => {
  const boot = useProgressStore();
  switch (boot.status) {
    case 'loading':
      return (
        <div className="splash" aria-busy="true">
          Loading…
        </div>
      );
    case 'error':
      return (
        <main className="splash" role="alert">
          <h1>Can&apos;t save progress here</h1>
          <p>
            This browser won&apos;t let the app store your progress. Private
            browsing or blocked site data can cause this.
          </p>
          <p className="muted">{boot.message}</p>
        </main>
      );
    case 'ready':
      return <Study decks={decks} store={boot.store} />;
  }
};
