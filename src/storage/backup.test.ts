// @vitest-environment node
import 'fake-indexeddb/auto';

import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import {
  backupFileName,
  mergeProgress,
  parseBackup,
  serializeBackup,
} from './backup.ts';
import { ProgressStore } from './progress.ts';
import { createScheduler, type Scheduler } from '../scheduler/scheduler.ts';
import { days, later, minutes } from '../test/random.ts';

const NOW = new Date('2026-03-01T09:00:00Z');

let scheduler: Scheduler;
beforeAll(async () => {
  scheduler = await createScheduler({ fuzz: false });
});

const open: ProgressStore[] = [];
let n = 0;
const freshStore = async () => {
  const store = await ProgressStore.open({
    scheduler,
    dbName: `backup-test-${++n}`,
  });
  open.push(store);
  return store;
};
afterEach(() => open.splice(0).forEach((store) => store.close()));

/** A store with some history: kesho got, moja missed then got, kesho also reviewed en-sw. */
const withHistory = async () => {
  const store = await freshStore();
  await store.mark({
    cardId: 'vocab-kesho',
    direction: 'sw-en',
    grade: 'got',
    mode: 'practice',
    now: NOW,
  });
  await store.mark({
    cardId: 'vocab-moja',
    direction: 'sw-en',
    grade: 'missed',
    mode: 'complete',
    now: NOW,
  });
  await store.mark({
    cardId: 'vocab-moja',
    direction: 'sw-en',
    grade: 'got',
    mode: 'complete',
    now: later(NOW, minutes(2)),
  });
  await store.mark({
    cardId: 'vocab-kesho',
    direction: 'en-sw',
    grade: 'missed',
    mode: 'practice',
    now: NOW,
  });
  return store;
};

describe('serialize → parse', () => {
  test('round-trips every record, with dates back as Dates', async () => {
    const data = await (await withHistory()).exportData();
    const parsed = parseBackup(serializeBackup(data, NOW));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.exportedAt).toEqual(NOW);
    expect(parsed.backup.progress).toEqual(data.progress);
    expect(parsed.backup.reviews).toEqual(data.reviews);
    expect(parsed.backup.progress[0]!.state.dueAt).toBeInstanceOf(Date);
    expect(parsed.backup.reviews[0]!.log.reviewTime).toBeInstanceOf(Date);
  });

  test('restored state is accepted by the scheduler (ts-fsrs rejects date strings)', async () => {
    const data = await (await withHistory()).exportData();
    const parsed = parseBackup(serializeBackup(data, NOW));
    if (!parsed.ok) throw new Error(parsed.error);
    const record = parsed.backup.progress.find(
      (r) => r.key === 'vocab-moja:sw-en'
    )!;
    expect(() =>
      scheduler.review(record.key, record.state, 'got', record.state.dueAt)
    ).not.toThrow();
  });

  test('names the file by date', () => {
    expect(backupFileName(NOW)).toBe('swahili-progress-2026-03-01.json');
  });
});

describe('parseBackup rejects', () => {
  test.each([
    ['not JSON', '{oops', /isn't valid JSON/],
    [
      'some other JSON',
      '{"hello":"world"}',
      /isn't a Swahili flashcards backup/,
    ],
    [
      'a newer format',
      '{"app":"swahili","format":2,"exportedAt":"2026-03-01T09:00:00.000Z","progress":[],"reviews":[]}',
      /damaged/,
    ],
  ])('%s', (_, text, error) => {
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(error);
  });

  test('a record whose key does not match its card and direction', async () => {
    const data = await (await withHistory()).exportData();
    data.progress[0] = {
      ...data.progress[0]!,
      direction: data.progress[0]!.direction === 'sw-en' ? 'en-sw' : 'sw-en',
    };
    const parsed = parseBackup(serializeBackup(data, NOW));
    expect(parsed.ok).toBe(false);
  });

  test('an invalid date', async () => {
    const text = serializeBackup(
      await (await withHistory()).exportData(),
      NOW
    ).replace(/"dueAt":"[^"]+"/, '"dueAt":"not a date"');
    expect(parseBackup(text).ok).toBe(false);
  });
});

describe('importing', () => {
  test('replace: a fresh device ends up identical to the exported one', async () => {
    const source = await withHistory();
    const parsed = parseBackup(serializeBackup(await source.exportData(), NOW));
    if (!parsed.ok) throw new Error(parsed.error);

    const target = await freshStore();
    await target.mark({
      cardId: 'vocab-other',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });
    const result = await target.importData(parsed.backup, 'replace');

    expect(result).toEqual({
      mode: 'replace',
      written: 3,
      kept: 0,
      reviews: 4,
    });
    expect(await target.exportData()).toEqual(await source.exportData());
    expect(target.stateOf('vocab-other:sw-en')).toBeUndefined(); // replaced, not merged
    expect(target.stateOf('vocab-moja:sw-en')).toEqual(
      source.stateOf('vocab-moja:sw-en')
    );
  });

  test('merge: newer copies win in both directions, and review logs are combined', async () => {
    const phone = await freshStore();
    const laptop = await freshStore();
    // Both learned kesho; the laptop reviewed it again later.
    await phone.mark({
      cardId: 'vocab-kesho',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });
    await laptop.mark({
      cardId: 'vocab-kesho',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });
    const due = laptop.stateOf('vocab-kesho:sw-en')!.dueAt;
    await laptop.mark({
      cardId: 'vocab-kesho',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: due,
    });
    // Only the phone knows moja, and its copy of tatu is newer than the laptop's.
    await phone.mark({
      cardId: 'vocab-moja',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });
    await laptop.mark({
      cardId: 'vocab-tatu',
      direction: 'sw-en',
      grade: 'got',
      mode: 'practice',
      now: NOW,
    });
    await phone.mark({
      cardId: 'vocab-tatu',
      direction: 'sw-en',
      grade: 'missed',
      mode: 'practice',
      now: later(NOW, days(1)),
    });

    const phoneTatu = phone.stateOf('vocab-tatu:sw-en');
    const parsed = parseBackup(serializeBackup(await laptop.exportData(), NOW));
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await phone.importData(parsed.backup, 'merge');

    expect(result).toMatchObject({ mode: 'merge', written: 1, kept: 1 });
    expect(phone.stateOf('vocab-kesho:sw-en')).toEqual(
      laptop.stateOf('vocab-kesho:sw-en')
    ); // laptop's was newer
    expect(phone.stateOf('vocab-tatu:sw-en')).toEqual(phoneTatu); // the phone's was newer: kept
    expect(phone.stateOf('vocab-tatu:sw-en')).not.toEqual(
      laptop.stateOf('vocab-tatu:sw-en')
    );
    expect(phone.stateOf('vocab-moja:sw-en')).toBeDefined(); // untouched
    expect((await phone.reviewsOf('vocab-kesho:sw-en')).length).toBe(2); // NOW logged once, plus the laptop's second
  });

  test('importing the same backup twice changes nothing the second time', async () => {
    const parsed = parseBackup(
      serializeBackup(await (await withHistory()).exportData(), NOW)
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const target = await freshStore();
    await target.importData(parsed.backup, 'merge');
    const once = await target.exportData();
    expect(await target.importData(parsed.backup, 'merge')).toMatchObject({
      written: 0,
      kept: 3,
    });
    expect(await target.exportData()).toEqual(once);
  });
});

test('mergeProgress: a tie keeps the local copy', async () => {
  const record = (await (await withHistory()).exportData()).progress[0]!;
  expect(
    mergeProgress(new Map([[record.key, record]]), [{ ...record }])
  ).toEqual({ write: [], kept: 1 });
});
