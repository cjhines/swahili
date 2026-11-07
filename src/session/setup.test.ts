import { beforeEach, expect, test } from 'vitest';

import {
  defaultVocabSetup,
  loadVocabSetup,
  saveVocabSetup,
  type VocabSetup,
} from './setup.ts';
import type { VocabDeck } from '../content/schema.ts';

const decks: VocabDeck[] = [
  {
    id: 'numbers',
    title: 'Numbers',
    cards: [{ id: 'vocab-moja', kind: 'word', sw: 'moja', en: 'one' }],
  },
  {
    id: 'time',
    title: 'Time',
    cards: [{ id: 'vocab-kesho', kind: 'word', sw: 'kesho', en: 'tomorrow' }],
  },
];

beforeEach(() => localStorage.clear());

test('defaults: every deck, Swahili → English, Practice, 10 new, repeat misses', () => {
  expect(loadVocabSetup(decks)).toEqual({
    deckIds: ['numbers', 'time'],
    direction: 'sw-en',
    mode: 'practice',
    newCap: 10,
    repeatMisses: true,
  });
});

test('remembers the last choices, under a swahili: key', () => {
  const setup: VocabSetup = {
    deckIds: ['time'],
    direction: 'en-sw',
    mode: 'complete',
    newCap: 5,
    repeatMisses: false,
  };
  saveVocabSetup(setup);
  expect(loadVocabSetup(decks)).toEqual(setup);
  expect(Object.keys(localStorage)).toEqual(['swahili:setup']);
});

test('drops decks that no longer exist, falling back to all decks if none are left', () => {
  saveVocabSetup({ ...defaultVocabSetup(decks), deckIds: ['time', 'deleted'] });
  expect(loadVocabSetup(decks).deckIds).toEqual(['time']);

  saveVocabSetup({ ...defaultVocabSetup(decks), deckIds: ['deleted'] });
  expect(loadVocabSetup(decks).deckIds).toEqual(['numbers', 'time']);
});

test('corrupt or outdated storage falls back to the defaults', () => {
  localStorage.setItem('swahili:setup', '{not json');
  expect(loadVocabSetup(decks)).toEqual(defaultVocabSetup(decks));

  localStorage.setItem(
    'swahili:setup',
    JSON.stringify({ vocab: { direction: 'sideways' } })
  );
  expect(loadVocabSetup(decks)).toEqual(defaultVocabSetup(decks));
});
