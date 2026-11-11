import { beforeEach, expect, test } from 'vitest';

import { reviewItems } from './queue.ts';
import {
  clearResume,
  loadResume,
  RESUME_MAX_AGE_MS,
  saveResume,
} from './resume.ts';
import { sessionReducer, startSession, type SessionState } from './session.ts';
import type { VocabSetup } from './setup.ts';

const START = new Date('2026-03-01T09:00:00Z');
const complete: VocabSetup = {
  kind: 'vocab',
  deckIds: ['numbers'],
  direction: 'sw-en',
  mode: 'complete',
  newCap: 10,
  repeatMisses: true,
};
const allExist = () => true;

const midRun = (): SessionState => {
  const state = startSession(
    reviewItems(['vocab-moja', 'vocab-mbili', 'vocab-tatu'], 'sw-en'),
    {
      repeatMisses: true,
    }
  );
  return [
    { type: 'flip' } as const,
    { type: 'mark', grade: 'got', requeueOffset: 3 } as const,
    { type: 'flip' } as const,
  ].reduce(sessionReducer, state);
};

beforeEach(() => localStorage.clear());

test('an unfinished Complete deck run round-trips, always resuming on the front of the card', () => {
  const state = midRun();
  expect(state.flipped).toBe(true);
  saveResume({ setup: complete, state, startedAt: START }, START);

  const run = loadResume(allExist, START);
  expect(run?.setup).toEqual(complete);
  expect(run?.state).toEqual({ ...state, flipped: false });
  expect(run?.startedAt).toEqual(START);
});

test('Practice runs are never saved', () => {
  saveResume(
    {
      setup: { ...complete, mode: 'practice' },
      state: midRun(),
      startedAt: START,
    },
    START
  );
  expect(localStorage.length).toBe(0);
});

test('a finished run clears the saved one', () => {
  saveResume({ setup: complete, state: midRun(), startedAt: START }, START);
  const finished = { ...midRun(), position: 3 };
  saveResume({ setup: complete, state: finished, startedAt: START }, START);
  expect(loadResume(allExist, START)).toBeUndefined();
  expect(localStorage.length).toBe(0);
});

test('expires a day after the last mark, not after the start', () => {
  const lastMark = new Date(START.getTime() + 20 * 60 * 60 * 1000);
  saveResume({ setup: complete, state: midRun(), startedAt: START }, lastMark);

  expect(
    loadResume(
      allExist,
      new Date(lastMark.getTime() + RESUME_MAX_AGE_MS - 1000)
    )
  ).toBeDefined();
  expect(
    loadResume(
      allExist,
      new Date(lastMark.getTime() + RESUME_MAX_AGE_MS + 1000)
    )
  ).toBeUndefined();
  expect(localStorage.length).toBe(0); // deleted, not just hidden
});

test('a run naming a card that no longer exists is dropped', () => {
  saveResume({ setup: complete, state: midRun(), startedAt: START }, START);
  expect(
    loadResume((item) => item.cardId !== 'vocab-tatu', START)
  ).toBeUndefined();
  expect(localStorage.length).toBe(0);
});

test('unreadable data is dropped', () => {
  localStorage.setItem(
    'swahili:resume',
    JSON.stringify({ version: 1, state: 'nope' })
  );
  expect(loadResume(allExist, START)).toBeUndefined();
  expect(localStorage.length).toBe(0);
});

test('clearResume removes it', () => {
  saveResume({ setup: complete, state: midRun(), startedAt: START }, START);
  clearResume();
  expect(loadResume(allExist, START)).toBeUndefined();
});

test('a Nani na Lini? run keeps the verb of each card', () => {
  const nani = {
    kind: 'nani',
    tenses: ['past'],
    polarity: 'neg',
    direction: 'en-sw',
    mode: 'complete',
    newCap: 10,
    repeatMisses: true,
  } as const;
  const state = startSession(
    [
      {
        key: 'nani-we-past-neg:en-sw',
        cardId: 'nani-we-past-neg',
        direction: 'en-sw',
        verbId: 'verb-kusoma',
      },
      {
        key: 'nani-i-past-neg:en-sw',
        cardId: 'nani-i-past-neg',
        direction: 'en-sw',
        verbId: 'verb-kula',
      },
    ],
    { repeatMisses: true }
  );
  saveResume(
    { setup: { ...nani, tenses: [...nani.tenses] }, state, startedAt: START },
    START
  );
  expect(
    loadResume(allExist, START)?.state.queue.map((item) => item.verbId)
  ).toEqual(['verb-kusoma', 'verb-kula']);
  // A verb that's since been removed makes the run unresumable.
  expect(
    loadResume((item) => item.verbId !== 'verb-kula', START)
  ).toBeUndefined();
});

test('a vocabulary run saved before deck kinds existed still resumes', () => {
  saveResume({ setup: complete, state: midRun(), startedAt: START }, START);
  const saved = JSON.parse(localStorage.getItem('swahili:resume')!);
  delete saved.setup.kind;
  localStorage.setItem('swahili:resume', JSON.stringify(saved));
  expect(loadResume(allExist, START)?.setup).toEqual(complete);
});
