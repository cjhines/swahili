// @vitest-environment node
import 'fake-indexeddb/auto';

import { State } from 'ts-fsrs';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import { DB_NAME, openSwahiliDb } from './db.ts';
import { ProgressStore } from './progress.ts';
import { createScheduler, type Scheduler } from '../scheduler/scheduler.ts';
import { later, minutes } from '../test/random.ts';

const NOW = new Date('2026-03-01T09:00:00Z');

let scheduler: Scheduler;
beforeAll(async () => {
  scheduler = await createScheduler({ fuzz: false });
});

// A fresh database per test, all closed afterwards.
const open: ProgressStore[] = [];
let dbName = '';
const openStore = async () => {
  const store = await ProgressStore.open({ scheduler, dbName });
  open.push(store);
  return store;
};
const reopen = async (store: ProgressStore) => {
  store.close();
  return openStore();
};
afterEach(() => {
  open.splice(0).forEach((store) => store.close());
});
let counter = 0;
const freshDb = () => {
  dbName = `swahili-test-${++counter}`;
};

describe('ProgressStore', () => {
  test('the real database is called "swahili", not something generic', () => {
    expect(DB_NAME).toBe('swahili');
  });

  test('a mark is saved and survives reopening, with its dates still Dates', async () => {
    freshDb();
    const store = await openStore();
    await store.mark({
      cardId: 'vocab-kesho',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });

    const reopened = await reopen(store);
    const state = reopened.stateOf('vocab-kesho:sw-en');
    expect(state?.reps).toBe(1);
    expect(state?.dueAt).toBeInstanceOf(Date);
    expect(state!.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  test('directions are tracked separately', async () => {
    freshDb();
    const store = await openStore();
    await store.mark({
      cardId: 'vocab-kesho',
      direction: 'sw-en',
      grade: 'missed',
      mode: 'practice',
      now: NOW,
    });
    expect(store.stateOf('vocab-kesho:sw-en')?.state).toBe(State.Learning);
    expect(store.stateOf('vocab-kesho:en-sw')).toBeUndefined();
  });

  test('every mark is logged with its grade and mode', async () => {
    freshDb();
    const store = await openStore();
    await store.mark({
      cardId: 'vocab-moja',
      direction: 'en-sw',
      grade: 'missed',
      mode: 'complete',
      now: NOW,
    });
    await store.mark({
      cardId: 'vocab-moja',
      direction: 'en-sw',
      grade: 'got',
      mode: 'complete',
      now: later(NOW, minutes(3)),
    });

    const reviews = await (await reopen(store)).reviewsOf('vocab-moja:en-sw');
    expect(reviews.map(({ grade, mode }) => [grade, mode])).toEqual([
      ['missed', 'complete'],
      ['got', 'complete'],
    ]);
    expect(reviews[0]!.id).toBe('vocab-moja:en-sw@2026-03-01T09:00:00.000Z');
    expect(reviews[0]!.log.rating).toBe(1);
  });

  test('marks fired without waiting are applied in order, each from the previous state', async () => {
    freshDb();
    const store = await openStore();
    const mark = (n: number) =>
      store.mark({
        cardId: 'vocab-a',
        direction: 'sw-en',
        grade: 'missed',
        mode: 'practice',
        now: later(NOW, minutes(n)),
      });
    const results = await Promise.all([mark(0), mark(1), mark(2)]);
    expect(results.map((record) => record.state.reps)).toEqual([1, 2, 3]);
    expect((await reopen(store)).stateOf('vocab-a:sw-en')?.reps).toBe(3);
  });

  test('orphans (progress for cards no longer in any deck) are kept, never deleted', async () => {
    freshDb();
    const store = await openStore();
    await store.mark({
      cardId: 'vocab-deleted-later',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });
    // Decks change between visits; the store doesn't know or care.
    const reopened = await reopen(store);
    expect([...reopened.all.keys()]).toEqual(['vocab-deleted-later:sw-en']);
  });

  test('records first launch once', async () => {
    freshDb();
    const store = await openStore();
    const db = await openSwahiliDb(dbName);
    const first = (await db.get('meta', 'firstLaunchAt'))?.value;
    db.close();
    expect(first).toBeInstanceOf(Date);

    await reopen(store);
    const again = await openSwahiliDb(dbName);
    expect((await again.get('meta', 'firstLaunchAt'))?.value).toEqual(first);
    again.close();
  });

  test('a mark that fails leaves memory unchanged, and later marks still work', async () => {
    freshDb();
    const store = await openStore();
    const bad = store.mark({
      cardId: 'vocab-a',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: new Date(Number.NaN), // toISOString() throws
    });
    await expect(bad).rejects.toThrow();
    expect(store.stateOf('vocab-a:sw-en')).toBeUndefined();

    await store.mark({
      cardId: 'vocab-a',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });
    expect(store.stateOf('vocab-a:sw-en')?.reps).toBe(1);
  });
});
