import { z } from 'zod/mini';

import { isDone, type SessionState } from './session.ts';
import { VocabSetup } from './setup.ts';
import { readLocal, removeLocal, writeLocal } from '../storage/local.ts';

// An unfinished Complete deck run, saved after every mark so it can be resumed from the setup
// screen. Practice needs nothing like this: reopening it just shows whatever is still due.

const KEY = 'resume';
export const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const Key = z.custom<SessionState['finished'][number]>(
  (value) => typeof value === 'string' && /:(sw-en|en-sw)$/.test(value)
);

const Saved = z.object({
  version: z.literal(1),
  setup: VocabSetup,
  state: z.object({
    queue: z.array(
      z.object({
        key: Key,
        cardId: z.string(),
        direction: z.enum(['sw-en', 'en-sw']),
      })
    ),
    position: z.int().check(z.minimum(0)),
    flipped: z.boolean(),
    repeatMisses: z.boolean(),
    total: z.int().check(z.minimum(0)),
    finished: z.array(Key),
    missed: z.array(Key),
  }),
  startedAt: z.iso.datetime(),
  /** Last activity. The run expires a day after this, not a day after it started. */
  savedAt: z.iso.datetime(),
});

export type ResumableRun = {
  setup: VocabSetup;
  state: SessionState;
  startedAt: Date;
  savedAt: Date;
};

export const saveResume = (
  { setup, state, startedAt }: Omit<ResumableRun, 'savedAt'>,
  now: Date
) => {
  if (setup.mode !== 'complete') return;
  if (isDone(state)) {
    removeLocal(KEY);
    return;
  }
  writeLocal(KEY, {
    version: 1,
    setup,
    // A run is always resumed showing the front of the card.
    state: { ...state, flipped: false },
    startedAt: startedAt.toISOString(),
    savedAt: now.toISOString(),
  });
};

export const clearResume = () => removeLocal(KEY);

/**
 * The saved run, if there is one worth offering. Expired, finished, unreadable runs, and runs
 * naming a card that no longer exists, are deleted rather than offered.
 */
export const loadResume = (
  cardExists: (cardId: string) => boolean,
  now: Date
): ResumableRun | undefined => {
  const parsed = Saved.safeParse(readLocal(KEY));
  if (!parsed.success) {
    if (readLocal(KEY) !== undefined) clearResume();
    return undefined;
  }
  const { setup, state, startedAt, savedAt } = parsed.data;
  const run: ResumableRun = {
    setup,
    state,
    startedAt: new Date(startedAt),
    savedAt: new Date(savedAt),
  };

  const stale = now.getTime() - run.savedAt.getTime() > RESUME_MAX_AGE_MS;
  const broken = state.queue.some((item) => !cardExists(item.cardId));
  if (stale || broken || isDone(state) || setup.mode !== 'complete') {
    clearResume();
    return undefined;
  }
  return run;
};
