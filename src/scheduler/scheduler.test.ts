// @vitest-environment node
import { State } from 'ts-fsrs';
import { beforeAll, describe, expect, test } from 'vitest';

import {
  createScheduler,
  isDue,
  isNew,
  type MemoryState,
  type Scheduler,
} from './scheduler.ts';
import { days, later, minutes } from '../test/random.ts';

const KEY = 'vocab-kesho:sw-en';
const START = new Date('2026-01-01T09:00:00Z');

let scheduler: Scheduler;
beforeAll(async () => {
  scheduler = await createScheduler({ fuzz: false });
});

/** Reviews a card on each due date with the given grades, returning the final state. */
const history = (grades: ('got' | 'missed')[]) => {
  let state: MemoryState | undefined;
  let now = START;
  for (const grade of grades) {
    if (state) now = state.dueAt;
    state = scheduler.review(KEY, state, grade, now).state;
  }
  return state!;
};

describe('review', () => {
  test('a new card marked "got" is scheduled days ahead and carries our key', () => {
    const { state, log } = scheduler.review(KEY, undefined, 'got', START);
    expect(state.cardId).toBe(KEY);
    expect(state.reps).toBe(1);
    expect(state.dueAt.getTime()).toBeGreaterThan(
      later(START, days(1)).getTime()
    );
    expect(log.rating).toBe(3); // Rating.Good
  });

  test('a new card marked "missed" comes back within minutes', () => {
    const { state, log } = scheduler.review(KEY, undefined, 'missed', START);
    expect(state.state).toBe(State.Learning);
    expect(state.dueAt.getTime()).toBeLessThanOrEqual(
      later(START, minutes(10)).getTime()
    );
    expect(log.rating).toBe(1); // Rating.Again
  });

  test('intervals grow while a card keeps being got', () => {
    const intervals: number[] = [];
    let state: MemoryState | undefined;
    let now = START;
    for (let i = 0; i < 4; i++) {
      if (state) now = state.dueAt;
      state = scheduler.review(KEY, state, 'got', now).state;
      intervals.push(state.dueAt.getTime() - now.getTime());
    }
    expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
    expect(new Set(intervals).size).toBe(4);
  });

  test('missing a learned card is a lapse and brings it back far sooner', () => {
    const learned = history(['got', 'got', 'got']);
    const { state } = scheduler.review(KEY, learned, 'missed', learned.dueAt);
    expect(state.lapses).toBe(1);
    expect(state.state).toBe(State.Relearning);
    expect(state.stability).toBeLessThan(learned.stability);
  });

  test('repeat misses in one session count one lapse, but each lowers stability', () => {
    const learned = history(['got', 'got', 'got']);
    const t = learned.dueAt;
    const first = scheduler.review(KEY, learned, 'missed', t).state;
    const second = scheduler.review(
      KEY,
      first,
      'missed',
      later(t, minutes(4))
    ).state;
    const third = scheduler.review(
      KEY,
      second,
      'missed',
      later(t, minutes(8))
    ).state;
    expect([first.lapses, second.lapses, third.lapses]).toEqual([1, 1, 1]);
    expect(second.stability).toBeLessThan(first.stability);
    expect(third.stability).toBeLessThan(second.stability);
  });

  test('getting a card before it is due still lengthens its interval, just by less', () => {
    const once = scheduler.review(KEY, undefined, 'got', START).state;
    const early = scheduler.review(
      KEY,
      once,
      'got',
      later(START, days(1))
    ).state;
    const onTime = scheduler.review(KEY, once, 'got', once.dueAt).state;
    expect(early.dueAt.getTime()).toBeGreaterThan(once.dueAt.getTime());
    expect(early.stability).toBeLessThan(onTime.stability);
  });

  test('never mutates the state it is given', () => {
    const state = scheduler.review(KEY, undefined, 'got', START).state;
    const copy = structuredClone(state);
    scheduler.review(KEY, state, 'missed', state.dueAt);
    expect(state).toEqual(copy);
  });
});

describe('isDue / isNew', () => {
  const state = () => scheduler.review(KEY, undefined, 'got', START).state;

  test('a card with no state is new, not due', () => {
    expect(isNew(undefined)).toBe(true);
    expect(isDue(undefined, START)).toBe(false);
  });

  test('due from its due date onwards', () => {
    const s = state();
    expect(isDue(s, later(s.dueAt, -1))).toBe(false);
    expect(isDue(s, s.dueAt)).toBe(true);
    expect(isDue(s, later(s.dueAt, days(30)))).toBe(true);
    expect(isNew(s)).toBe(false);
  });
});

test('fuzz spreads cards learned at the same moment over several days', async () => {
  const fuzzy = await createScheduler();
  const dues = new Set(
    Array.from({ length: 12 }, (_, i) =>
      fuzzy
        .review(`vocab-${i}:sw-en`, undefined, 'got', START)
        .state.dueAt.getTime()
    )
  );
  expect(dues.size).toBeGreaterThan(1);
});
