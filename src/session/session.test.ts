// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { reviewItems } from './queue.ts';
import {
  currentItem,
  isDone,
  requeueOffset,
  sessionReducer,
  startSession,
  type SessionAction,
  type SessionState,
} from './session.ts';
import { seededRandom } from '../test/random.ts';

const items = reviewItems(
  ['vocab-a', 'vocab-b', 'vocab-c', 'vocab-d', 'vocab-e', 'vocab-f'],
  'sw-en'
);
const flip: SessionAction = { type: 'flip' };
const got: SessionAction = { type: 'mark', grade: 'got', requeueOffset: 3 };
const missed = (requeueOffset = 3): SessionAction => ({
  type: 'mark',
  grade: 'missed',
  requeueOffset,
});

const run = (state: SessionState, ...actions: SessionAction[]) =>
  actions.reduce(sessionReducer, state);
const shown = (state: SessionState) => currentItem(state)?.cardId;

test('flip, mark, next card, until the queue runs out', () => {
  let state = startSession(items.slice(0, 2), { repeatMisses: true });
  expect(shown(state)).toBe('vocab-a');
  state = run(state, flip);
  expect(state.flipped).toBe(true);
  state = run(state, got);
  expect([shown(state), state.flipped]).toEqual(['vocab-b', false]);
  state = run(state, flip, got);
  expect(isDone(state)).toBe(true);
  expect(state.finished).toEqual(['vocab-a:sw-en', 'vocab-b:sw-en']);
});

test('marking before the answer has been shown is ignored', () => {
  const state = startSession(items, { repeatMisses: true });
  expect(run(state, got)).toBe(state);
});

test('flipping twice changes nothing', () => {
  const flipped = run(startSession(items, { repeatMisses: true }), flip);
  expect(run(flipped, flip)).toBe(flipped);
});

describe('repeat missed cards: on', () => {
  test('a missed card comes back after `requeueOffset` other cards', () => {
    const state = run(
      startSession(items, { repeatMisses: true }),
      flip,
      missed(3)
    );
    expect(state.queue.map((item) => item.cardId)).toEqual([
      'vocab-a', // the miss, already shown
      'vocab-b',
      'vocab-c',
      'vocab-d',
      'vocab-a', // back after three other cards
      'vocab-e',
      'vocab-f',
    ]);
    expect(state.finished).toEqual([]);
    expect(state.missed).toEqual(['vocab-a:sw-en']);
  });

  test('near the end, it simply comes last', () => {
    let state = startSession(items.slice(0, 2), { repeatMisses: true });
    state = run(state, flip, got, flip, missed(5));
    expect(shown(state)).toBe('vocab-b');
    expect(isDone(state)).toBe(false);
  });

  test('the session only ends once every card has been got', () => {
    let state = startSession(items.slice(0, 1), { repeatMisses: true });
    state = run(state, flip, missed(), flip, missed(), flip, missed());
    expect([shown(state), isDone(state)]).toEqual(['vocab-a', false]);
    state = run(state, flip, got);
    expect(isDone(state)).toBe(true);
    expect(state.finished).toEqual(['vocab-a:sw-en']);
    expect(state.missed).toEqual(['vocab-a:sw-en']); // listed once, however many misses
  });
});

describe('repeat missed cards: off', () => {
  test('a missed card is done for this session', () => {
    let state = startSession(items.slice(0, 2), { repeatMisses: false });
    state = run(state, flip, missed(), flip, got);
    expect(isDone(state)).toBe(true);
    expect(state.queue).toHaveLength(2);
    expect(state.finished).toEqual(['vocab-a:sw-en', 'vocab-b:sw-en']);
    expect(state.missed).toEqual(['vocab-a:sw-en']);
  });
});

test('total counts distinct cards and progress never exceeds it', () => {
  let state = startSession(items.slice(0, 3), { repeatMisses: true });
  expect(state.total).toBe(3);
  state = run(state, flip, missed(0), flip, got, flip, got, flip, got);
  expect(isDone(state)).toBe(true);
  expect(state.finished).toHaveLength(3);
});

test('state survives a JSON round trip, for resuming a Complete deck run', () => {
  const state = run(
    startSession(items, { repeatMisses: true }),
    flip,
    missed(4),
    flip,
    got
  );
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
});

test('marks after the end are ignored', () => {
  const done = run(
    startSession(items.slice(0, 1), { repeatMisses: false }),
    flip,
    got
  );
  expect(run(done, flip, got)).toBe(done);
});

test('requeueOffset is 3, 4 or 5', () => {
  const random = seededRandom(11);
  const offsets = new Set(
    Array.from({ length: 200 }, () => requeueOffset(random))
  );
  expect([...offsets].sort()).toEqual([3, 4, 5]);
});
