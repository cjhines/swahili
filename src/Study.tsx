import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { indexCards } from './content/display.ts';
import type { VocabDeck } from './content/schema.ts';
import { EndScreen } from './screens/EndScreen.tsx';
import { SessionScreen } from './screens/SessionScreen.tsx';
import { SetupScreen } from './screens/SetupScreen.tsx';
import {
  clearResume,
  loadResume,
  type ResumableRun,
} from './session/resume.ts';
import type { SessionState } from './session/session.ts';
import type { VocabSetup } from './session/setup.ts';
import { buildVocabSession } from './session/start.ts';
import type { ProgressStore } from './storage/progress.ts';

type Screen =
  | { name: 'setup' }
  | { name: 'session'; setup: VocabSetup; state: SessionState; startedAt: Date }
  | { name: 'end'; state: SessionState };

/**
 * Setup → session → end, with no router (GitHub Pages can't rewrite URLs). Starting a session
 * pushes one history entry, so the browser's or Android's Back button returns to setup instead of
 * leaving the app, and the app's own exit buttons simply go back.
 */
export const Study = ({
  decks,
  store,
}: {
  decks: readonly VocabDeck[];
  store: ProgressStore;
}) => {
  const index = useMemo(() => indexCards(decks), [decks]);
  const [screen, setScreen] = useState<Screen>({ name: 'setup' });
  // Forces a re-render, which re-reads the saved run, after it's discarded.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const onPop = () => setScreen({ name: 'setup' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const begin = (setup: VocabSetup, state: SessionState, startedAt: Date) => {
    window.history.pushState({ swahili: 'session' }, '');
    setScreen({ name: 'session', setup, state, startedAt });
  };
  const leave = useCallback(() => window.history.back(), []);
  const finish = useCallback(
    (state: SessionState) => setScreen({ name: 'end', state }),
    []
  );

  // Study only re-renders when the screen changes or a run is discarded, so this is cheap.
  const resume =
    screen.name === 'setup'
      ? loadResume((id) => index.has(id), new Date())
      : undefined;

  switch (screen.name) {
    case 'setup':
      return (
        <SetupScreen
          decks={decks}
          stateOf={store.stateOf}
          resume={resume}
          onStart={(setup) => {
            const now = new Date();
            if (setup.mode === 'complete') clearResume(); // a new run replaces the unfinished one
            begin(
              setup,
              buildVocabSession(setup, decks, store.stateOf, { now }),
              now
            );
          }}
          onResume={(run: ResumableRun) =>
            begin(run.setup, run.state, run.startedAt)
          }
          onDiscardResume={() => {
            clearResume();
            rerender();
          }}
        />
      );
    case 'session':
      return (
        <SessionScreen
          index={index}
          store={store}
          setup={screen.setup}
          initial={screen.state}
          startedAt={screen.startedAt}
          onFinish={finish}
          onExit={leave}
        />
      );
    case 'end':
      return <EndScreen index={index} state={screen.state} onDone={leave} />;
  }
};
