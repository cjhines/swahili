import { beforeEach, describe, expect, test } from 'vitest';

import {
  defaultNaniSetup,
  defaultVocabSetup,
  loadLastKind,
  loadNaniSetup,
  loadVocabSetup,
  saveSetup,
  type NaniSetup,
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

describe('vocabulary', () => {
  test('defaults: every deck, Swahili → English, Practice, 10 new, repeat misses', () => {
    expect(loadVocabSetup(decks)).toEqual({
      kind: 'vocab',
      deckIds: ['numbers', 'time'],
      direction: 'sw-en',
      mode: 'practice',
      newCap: 10,
      repeatMisses: true,
    });
  });

  test('remembers the last choices, under a swahili: key', () => {
    const setup: VocabSetup = {
      kind: 'vocab',
      deckIds: ['time'],
      direction: 'en-sw',
      mode: 'complete',
      newCap: 5,
      repeatMisses: false,
    };
    saveSetup(setup);
    expect(loadVocabSetup(decks)).toEqual(setup);
    expect(Object.keys(localStorage)).toEqual(['swahili:setup']);
  });

  test('drops decks that no longer exist, falling back to all decks if none are left', () => {
    saveSetup({ ...defaultVocabSetup(decks), deckIds: ['time', 'deleted'] });
    expect(loadVocabSetup(decks).deckIds).toEqual(['time']);

    saveSetup({ ...defaultVocabSetup(decks), deckIds: ['deleted'] });
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

  test('choices saved before deck kinds existed are still read', () => {
    const old = {
      deckIds: ['time'],
      direction: 'en-sw',
      mode: 'complete',
      newCap: 5,
      repeatMisses: false,
    };
    localStorage.setItem('swahili:setup', JSON.stringify({ vocab: old }));
    expect(loadVocabSetup(decks)).toEqual({ kind: 'vocab', ...old });
  });
});

describe('Nani na Lini?', () => {
  test('defaults: every available tense, both, English → Swahili', () => {
    expect(loadNaniSetup(['present', 'past'])).toEqual({
      kind: 'nani',
      tenses: ['present', 'past'],
      polarity: 'both',
      direction: 'en-sw',
      mode: 'practice',
      newCap: 10,
      repeatMisses: true,
    });
  });

  test('remembers its own choices alongside the vocabulary ones', () => {
    const nani: NaniSetup = {
      ...defaultNaniSetup(['past']),
      polarity: 'neg',
      direction: 'sw-en',
    };
    saveSetup(defaultVocabSetup(decks));
    saveSetup(nani);
    expect(loadNaniSetup(['present', 'past'])).toEqual(nani);
    expect(loadVocabSetup(decks)).toEqual(defaultVocabSetup(decks));
  });

  test('only offers tenses that are available now', () => {
    saveSetup({
      ...defaultNaniSetup(['present', 'past', 'future']),
      tenses: ['past', 'future'],
    });
    expect(loadNaniSetup(['present', 'past']).tenses).toEqual(['past']);
    expect(loadNaniSetup(['present']).tenses).toEqual(['present']); // none left: all available
  });
});

test('remembers which kind of deck was used last', () => {
  expect(loadLastKind()).toBe('vocab');
  saveSetup(defaultNaniSetup([]));
  expect(loadLastKind()).toBe('nani');
  saveSetup(defaultVocabSetup(decks));
  expect(loadLastKind()).toBe('vocab');
});
