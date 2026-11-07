// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest';

import { progressKey, type ProgressKey } from '../domain.ts';
import {
  completeQueue,
  practiceQueue,
  practiceSummary,
  reviewItems,
  shuffle,
} from './queue.ts';
import {
  createScheduler,
  type MemoryState,
  type Scheduler,
} from '../scheduler/scheduler.ts';
import { days, later, seededRandom } from '../test/random.ts';

const NOW = new Date('2026-03-01T09:00:00Z');

let scheduler: Scheduler;
beforeAll(async () => {
  scheduler = await createScheduler({ fuzz: false });
});

/** A state that falls due at `due` (reviewed once, then its due date moved). */
const dueAt = (key: ProgressKey, due: Date): MemoryState => ({
  ...scheduler.review(key, undefined, 'got', later(due, -days(5))).state,
  dueAt: due,
});

const keysOf = (items: { key: ProgressKey }[]) => items.map((item) => item.key);

describe('practiceQueue', () => {
  test('due cards come first, most overdue first, and not-yet-due cards are left out', () => {
    const items = reviewItems(
      ['vocab-a', 'vocab-b', 'vocab-c', 'vocab-d'],
      'sw-en'
    );
    const states = new Map<ProgressKey, MemoryState>([
      ['vocab-a:sw-en', dueAt('vocab-a:sw-en', later(NOW, -days(1)))],
      ['vocab-b:sw-en', dueAt('vocab-b:sw-en', later(NOW, -days(9)))],
      ['vocab-c:sw-en', dueAt('vocab-c:sw-en', later(NOW, days(3)))], // not due yet
      ['vocab-d:sw-en', dueAt('vocab-d:sw-en', NOW)], // due exactly now
    ]);
    const queue = practiceQueue(items, (key) => states.get(key), {
      now: NOW,
      newCap: 10,
    });
    expect(keysOf(queue)).toEqual([
      'vocab-b:sw-en',
      'vocab-a:sw-en',
      'vocab-d:sw-en',
    ]);
  });

  test('adds at most newCap new cards, picked at random', () => {
    const items = reviewItems(
      Array.from({ length: 30 }, (_, i) => `vocab-${i}`),
      'en-sw'
    );
    const a = practiceQueue(items, () => undefined, {
      now: NOW,
      newCap: 10,
      random: seededRandom(1),
    });
    const b = practiceQueue(items, () => undefined, {
      now: NOW,
      newCap: 10,
      random: seededRandom(2),
    });
    expect(a).toHaveLength(10);
    expect(new Set(keysOf(a)).size).toBe(10);
    expect(keysOf(a)).not.toEqual(keysOf(b));
    expect(keysOf(a)).not.toEqual(keysOf(items.slice(0, 10))); // not simply deck order
  });

  test('mixes new cards in among the due ones, keeping the due cards in order', () => {
    const due = reviewItems(
      ['vocab-d1', 'vocab-d2', 'vocab-d3', 'vocab-d4'],
      'sw-en'
    );
    const fresh = reviewItems(['vocab-n1', 'vocab-n2', 'vocab-n3'], 'sw-en');
    const states = new Map(
      due.map((item, i) => [
        item.key,
        dueAt(item.key, later(NOW, -days(10 - i))),
      ])
    );
    const queue = practiceQueue([...due, ...fresh], (key) => states.get(key), {
      now: NOW,
      newCap: 3,
      random: seededRandom(7),
    });

    expect(queue).toHaveLength(7);
    expect(keysOf(queue).filter((key) => states.has(key))).toEqual(keysOf(due));
    const newPositions = keysOf(queue).flatMap((key, i) =>
      states.has(key) ? [] : [i]
    );
    expect(newPositions).not.toEqual([4, 5, 6]); // not all tacked on the end
  });

  test('newCap 0 means due cards only', () => {
    const items = reviewItems(['vocab-a', 'vocab-b'], 'sw-en');
    const states = new Map<ProgressKey, MemoryState>([
      ['vocab-a:sw-en', dueAt('vocab-a:sw-en', NOW)],
    ]);
    expect(
      keysOf(
        practiceQueue(items, (key) => states.get(key), { now: NOW, newCap: 0 })
      )
    ).toEqual(['vocab-a:sw-en']);
  });

  test('directions are independent: progress one way leaves the other way new', () => {
    const swEn = progressKey('vocab-kesho', 'sw-en');
    const states = new Map([[swEn, dueAt(swEn, later(NOW, days(20)))]]); // learned, not due
    const stateOf = (key: ProgressKey) => states.get(key);

    expect(
      practiceQueue(reviewItems(['vocab-kesho'], 'sw-en'), stateOf, {
        now: NOW,
        newCap: 10,
      })
    ).toEqual([]);
    expect(
      keysOf(
        practiceQueue(reviewItems(['vocab-kesho'], 'en-sw'), stateOf, {
          now: NOW,
          newCap: 10,
        })
      )
    ).toEqual(['vocab-kesho:en-sw']);
  });

  test('orphaned progress (a card no longer in any deck) never appears', () => {
    const orphan = progressKey('vocab-deleted', 'sw-en');
    const states = new Map([[orphan, dueAt(orphan, later(NOW, -days(3)))]]);
    const queue = practiceQueue(
      reviewItems(['vocab-a'], 'sw-en'),
      (key) => states.get(key),
      {
        now: NOW,
        newCap: 10,
      }
    );
    expect(keysOf(queue)).toEqual(['vocab-a:sw-en']);
  });
});

describe('completeQueue', () => {
  test('every card exactly once, shuffled', () => {
    const items = reviewItems(
      Array.from({ length: 20 }, (_, i) => `vocab-${i}`),
      'sw-en'
    );
    const queue = completeQueue(items, seededRandom(3));
    expect([...keysOf(queue)].sort()).toEqual([...keysOf(items)].sort());
    expect(keysOf(queue)).not.toEqual(keysOf(items));
  });
});

test('shuffle does not modify its input', () => {
  const input = [1, 2, 3, 4, 5];
  shuffle(input, seededRandom(4));
  expect(input).toEqual([1, 2, 3, 4, 5]);
});

test('practiceSummary counts due and new cards and finds the next due date', () => {
  const items = reviewItems(
    ['vocab-a', 'vocab-b', 'vocab-c', 'vocab-d'],
    'sw-en'
  );
  const soon = later(NOW, days(2));
  const states = new Map<ProgressKey, MemoryState>([
    ['vocab-a:sw-en', dueAt('vocab-a:sw-en', later(NOW, -days(1)))],
    ['vocab-b:sw-en', dueAt('vocab-b:sw-en', later(NOW, days(6)))],
    ['vocab-c:sw-en', dueAt('vocab-c:sw-en', soon)],
  ]);
  expect(practiceSummary(items, (key) => states.get(key), NOW)).toEqual({
    due: 1,
    new: 1,
    nextDueAt: soon,
  });
});
