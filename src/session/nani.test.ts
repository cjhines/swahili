// @vitest-environment node
import nani from 'virtual:nani';
import { describe, expect, test } from 'vitest';

import type { VocabDeck } from '../content/schema.ts';
import type { ProgressKey } from '../domain.ts';
import {
  assignVerbs,
  eligibleVerbs,
  MIN_REVIEWED_VERBS,
  naniItems,
  naniVerbs,
  type VerbCard,
} from './start.ts';
import { naniView } from './views.ts';
import { allPatterns } from '../nani/patterns.ts';
import { seededRandom } from '../test/random.ts';

const { rules } = nani;
const verb = (sw: string, base: string): VerbCard => ({
  id: `verb-${sw}`,
  verb: {
    sw,
    en: { base, past: `${base}ed`, participle: `${base}ed`, ing: `${base}ing` },
  },
});
const verbs = [
  verb('kusoma', 'read'),
  verb('kupika', 'cook'),
  verb('kucheza', 'play'),
];
const patterns = new Map(allPatterns(rules).map((p) => [p.id, p]));

describe('naniItems', () => {
  test('filters by tense and positive/negative, in the chosen direction', () => {
    const items = naniItems(rules, {
      tenses: ['past'],
      polarity: 'neg',
      direction: 'en-sw',
    });
    expect(items).toHaveLength(8);
    expect(
      items.every(
        (i) => i.cardId.endsWith('-past-neg') && i.key === `${i.cardId}:en-sw`
      )
    ).toBe(true);
    expect(
      naniItems(rules, {
        tenses: ['past', 'have'],
        polarity: 'both',
        direction: 'sw-en',
      })
    ).toHaveLength(32);
  });
});

describe('naniVerbs', () => {
  test('takes every verb card, except those rules.yaml excludes (kuwa)', () => {
    const decks: VocabDeck[] = [
      {
        id: 'v',
        title: 'V',
        cards: [
          {
            id: 'verb-kusoma',
            kind: 'verb',
            sw: 'kusoma',
            en: {
              base: 'read',
              past: 'read',
              participle: 'read',
              ing: 'reading',
            },
          },
          {
            id: 'verb-kuwa',
            kind: 'verb',
            sw: 'kuwa',
            en: { base: 'be', past: 'was', participle: 'been', ing: 'being' },
          },
          { id: 'vocab-kesho', kind: 'word', sw: 'kesho', en: 'tomorrow' },
        ],
      },
    ];
    expect(naniVerbs(decks, rules).map((v) => v.id)).toEqual(['verb-kusoma']);
  });
});

describe('eligibleVerbs', () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    verb(`kuverb${i}`, `verb${i}`)
  );
  const reviewed = (ids: string[]) => (key: ProgressKey) =>
    ids.some((id) => key.startsWith(`${id}:`)) ? ({} as never) : undefined;

  test('verbs met in Vocabulary (either direction), once there are enough of them', () => {
    const met = many.slice(0, MIN_REVIEWED_VERBS).map((v) => v.id);
    expect(eligibleVerbs(many, reviewed(met)).map((v) => v.id)).toEqual(met);
  });

  test('every verb while fewer than 5 have been met', () => {
    expect(eligibleVerbs(many, reviewed([many[0]!.id]))).toHaveLength(8);
  });
});

describe('assignVerbs', () => {
  const queue = naniItems(rules, {
    tenses: ['past', 'have'],
    polarity: 'both',
    direction: 'en-sw',
  });

  test('every verb pattern gets a verb, never the same one twice in a row; have gets none', () => {
    const assigned = assignVerbs(
      queue,
      verbs.map((v) => v.id),
      patterns,
      seededRandom(5)
    );
    const withVerb = assigned.filter((i) => !i.cardId.includes('-have-'));
    expect(withVerb.every((i) => i.verbId)).toBe(true);
    expect(
      assigned
        .filter((i) => i.cardId.includes('-have-'))
        .every((i) => i.verbId === undefined)
    ).toBe(true);
    const sequence = assigned.flatMap((i) => (i.verbId ? [i.verbId] : []));
    expect(sequence.every((id, i) => i === 0 || id !== sequence[i - 1])).toBe(
      true
    );
    expect(new Set(sequence).size).toBe(3);
  });

  test('with a single verb, repeats are unavoidable and fine', () => {
    expect(
      assignVerbs(queue, ['verb-kusoma'], patterns).every(
        (i) => i.cardId.includes('-have-') || i.verbId === 'verb-kusoma'
      )
    ).toBe(true);
  });
});

describe('naniView', () => {
  const view = naniView(rules, verbs);

  test('English → Swahili: the English prompt, the form as the answer, with parts and the verb', () => {
    const card = view({
      key: 'nani-we-past-neg:en-sw',
      cardId: 'nani-we-past-neg',
      direction: 'en-sw',
      verbId: 'verb-kusoma',
    });
    expect(card?.title).toBe('Nani na Lini?');
    expect(card?.prompt).toEqual({ text: "We didn't read", lang: 'en' });
    expect(card?.answer).toMatchObject({
      text: 'hatukusoma',
      lang: 'sw',
      gloss: 'kusoma: to read',
    });
    expect(card?.answer.breakdown?.map((p) => p.text)).toEqual([
      'ha',
      'tu',
      'ku',
      'soma',
    ]);
  });

  test('Swahili → English the other way round', () => {
    const card = view({
      key: 'nani-i-have-neg:sw-en',
      cardId: 'nani-i-have-neg',
      direction: 'sw-en',
    });
    expect(card?.prompt).toEqual({ text: 'sina', lang: 'sw' });
    expect(card?.answer).toMatchObject({
      text: "I don't have",
      lang: 'en',
      gloss: 'kuwa na: to have',
    });
  });

  test('nothing for a missing pattern or verb (e.g. a stale saved run)', () => {
    expect(
      view({ key: 'nani-x:en-sw', cardId: 'nani-x', direction: 'en-sw' })
    ).toBeUndefined();
    expect(
      view({
        key: 'nani-we-past-neg:en-sw',
        cardId: 'nani-we-past-neg',
        direction: 'en-sw',
        verbId: 'verb-gone',
      })
    ).toBeUndefined();
  });
});
