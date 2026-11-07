import {
  DefaultScheduler,
  Rating,
  type DefaultSchedulerCard,
  type DefaultSchedulerRevlog,
} from 'ts-fsrs';

import type { Grade, ProgressKey } from '../domain.ts';

// A thin, pure wrapper around ts-fsrs: memory state + grade + time in, new memory state out.
// No storage, no clock: callers pass `now`. That keeps it trivially testable and lets the
// storage layer wrap it.

/** ts-fsrs's per-card memory state (due date, stability, difficulty, reps, lapses…), stored as-is. */
export type MemoryState = DefaultSchedulerCard;
export type ReviewLog = DefaultSchedulerRevlog;

// Two buttons, mapped onto FSRS's ratings. Hard and Easy are never used: FSRS learns how hard
// a card is from the history of Got it / Missed it.
const RATING = { got: Rating.Good, missed: Rating.Again } as const;

export type Scheduler = {
  /** `state` is undefined for a card never reviewed in this direction. */
  review(
    key: ProgressKey,
    state: MemoryState | undefined,
    grade: Grade,
    now: Date
  ): { state: MemoryState; log: ReviewLog };
};

export type SchedulerOptions = {
  /** Spreads cards learned together over neighbouring days. Off only in tests that need exact dates. */
  fuzz?: boolean;
};

export const createScheduler = async ({
  fuzz = true,
}: SchedulerOptions = {}): Promise<Scheduler> => {
  const fsrs = await DefaultScheduler({
    // Pinned rather than left to the library default: stored memory state is model-specific
    // (FSRS-7 adds `stabilityFast`), so a silent model change on upgrade would misread it.
    version: 'FSRS-7',
    desiredRetention: 0.9,
    enableFuzz: fuzz,
  });

  return {
    review(key, state, grade, now) {
      const card = state ?? fsrs.newCard({ now, cardId: key });
      const { card: next, revlog } = fsrs.review({
        card,
        grade: RATING[grade],
        now,
      });
      return { state: next, log: revlog };
    },
  };
};

/** Never-reviewed cards are "new", not due. */
export const isNew = (state: MemoryState | undefined): state is undefined =>
  state === undefined;

// Deliberately a plain boolean, not a type guard: "not due" doesn't mean "no state", and a guard
// would make TypeScript narrow the not-due branch to `never`.
export const isDue = (state: MemoryState | undefined, now: Date): boolean =>
  state !== undefined && state.dueAt.getTime() <= now.getTime();
