import { z } from 'zod/mini';

import type { ReviewItem } from './queue.ts';
import { isDone, type SessionState } from './session.ts';
import { SessionSetup, withKind } from './setup.ts';
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
  setup: SessionSetup,
  state: z.object({
    queue: z.array(
      z.object({
        key: Key,
        cardId: z.string(),
        direction: z.enum(['sw-en', 'en-sw']),
        verbId: z.optional(z.string()),
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
  setup: SessionSetup;
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
 * naming a card (or verb) that no longer exists, are deleted rather than offered.
 */
export const loadResume = (
  itemExists: (item: ReviewItem) => boolean,
  now: Date
): ResumableRun | undefined => {
  const raw = readLocal(KEY);
  // Runs saved before deck kinds existed were vocabulary runs with no `kind`.
  const migrated =
    raw && typeof raw === 'object'
      ? { ...raw, setup: withKind((raw as { setup?: unknown }).setup) }
      : raw;
  const parsed = Saved.safeParse(migrated);
  if (!parsed.success) {
    if (raw !== undefined) clearResume();
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
  const broken = state.queue.some((item) => !itemExists(item));
  if (stale || broken || isDone(state) || setup.mode !== 'complete') {
    clearResume();
    return undefined;
  }
  return run;
};
