// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { answerFor, englishOf, indexCards, promptFor } from './display.ts';
import type { Noun, Verb, VocabDeck, Word } from './schema.ts';

const elfu: Word = {
  id: 'vocab-elfu-moja',
  kind: 'word',
  sw: 'elfu moja',
  alt: ['alfu moja'],
  en: 'one thousand',
};
const kitabu: Noun = {
  id: 'vocab-kitabu',
  kind: 'noun',
  sw: 'kitabu',
  en: 'book',
  plural: 'vitabu',
  hint: '(to read)',
  note: 'ki-/vi- class',
};
const kusoma: Verb = {
  id: 'verb-kusoma',
  kind: 'verb',
  sw: 'kusoma',
  en: { base: 'read', past: 'read', participle: 'read', ing: 'reading' },
  example: { sw: 'Ninasoma kitabu.', en: 'I am reading a book.' },
};

describe('promptFor', () => {
  test('Swahili → English shows the Swahili, never the hint', () => {
    expect(promptFor(kitabu, 'sw-en')).toEqual({ text: 'kitabu', lang: 'sw' });
  });

  test('English → Swahili shows the English, with the hint', () => {
    expect(promptFor(kitabu, 'en-sw')).toEqual({
      text: 'book',
      lang: 'en',
      hint: '(to read)',
    });
  });

  test('verbs are shown as "to …"', () => {
    expect(englishOf(kusoma)).toBe('to read');
    expect(promptFor(kusoma, 'en-sw')).toEqual({ text: 'to read', lang: 'en' });
  });
});

describe('answerFor', () => {
  test('the other language, plus plural and note, in both directions', () => {
    expect(answerFor(kitabu, 'sw-en')).toEqual({
      text: 'book',
      lang: 'en',
      plural: 'vitabu',
      note: 'ki-/vi- class',
    });
    expect(answerFor(kitabu, 'en-sw')).toMatchObject({
      text: 'kitabu',
      lang: 'sw',
      plural: 'vitabu',
    });
  });

  test('alternative spellings and examples are shown', () => {
    expect(answerFor(elfu, 'en-sw')).toEqual({
      text: 'elfu moja',
      lang: 'sw',
      alt: ['alfu moja'],
    });
    expect(answerFor(kusoma, 'sw-en')).toEqual({
      text: 'to read',
      lang: 'en',
      example: { sw: 'Ninasoma kitabu.', en: 'I am reading a book.' },
    });
  });
});

test('indexCards finds every card and its deck', () => {
  const decks: VocabDeck[] = [
    { id: 'numbers', title: 'Numbers', cards: [elfu] },
    { id: 'misc', title: 'Misc', cards: [kitabu, kusoma] },
  ];
  const index = indexCards(decks);
  expect(index.size).toBe(3);
  expect(index.get('verb-kusoma')?.deck.id).toBe('misc');
});
