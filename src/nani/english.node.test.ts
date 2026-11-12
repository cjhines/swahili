// @vitest-environment node
//
// Nani na Lini?'s English, built from the real verb cards and rules.yaml.
import { describe, expect, test } from 'vitest';

import { english } from './english.ts';
import {
  allPatterns,
  pattern,
  type NaniTense,
  type Polarity,
} from './patterns.ts';
import { realContent } from '../content/node/real-content.ts';
import { naniView } from '../session/views.ts';

const { rules, verb, naniVerbs } = realContent();

const say = (
  sw: string,
  subject: string,
  tense: NaniTense,
  polarity: Polarity
) => english(rules, pattern(subject, tense, polarity), { sw, en: verb(sw).en });

test.each([
  // Regular verbs: "-ing" in the present.
  ['kula', 'i', 'present', 'pos', 'I am eating'],
  ['kula', 'it', 'present', 'pos', 'It (N-class) is eating'],
  ['kukutana', 'we', 'past', 'pos', 'We met'],
  ['kuacha', 'i', 'present', 'pos', 'I am quitting'],
  ['kuacha', 'heshe', 'past', 'neg', "He/she didn't quit"],
  // Stative verbs: the simple present.
  ['kuona', 'i', 'present', 'pos', 'I see'],
  ['kupenda', 'heshe', 'present', 'pos', 'He/she likes'],
  ['kupenda', 'we', 'present', 'neg', "We don't like"],
  ['kuhitaji', 'heshe', 'present', 'pos', 'He/she needs'],
  ['kuelewa', 'i', 'present', 'neg', "I don't understand"],
  ['kusikia', 'heshe', 'present', 'pos', 'He/she hears'],
  ['kufikiri', 'i', 'present', 'neg', "I don't think"],
  // Perfects with their own English.
  ['kujua', 'i', 'perfect', 'neg', "I don't know yet"],
  ['kujua', 'heshe', 'perfect', 'pos', 'He/she knows now'],
  ['kupenda', 'i', 'perfect', 'pos', 'I like it (now)'],
  ['kupenda', 'heshe', 'perfect', 'pos', 'He/she likes it (now)'],
  ['kufikiri', 'i', 'perfect', 'pos', 'I have thought about it'],
  ['kufikiri', 'heshe', 'perfect', 'neg', "He/she hasn't thought about it yet"],
  ['kuishi', 'i', 'perfect', 'pos', 'I have lived (there)'],
  ['kuelewa', 'i', 'perfect', 'pos', 'I understand now'],
  ['kuelewa', 'heshe', 'perfect', 'neg', "He/she doesn't understand yet"],
  ['kusikia', 'i', 'perfect', 'pos', 'I have heard (got it)'],
  ['kukaa', 'i', 'perfect', 'neg', "I haven't sat down yet"],
  ['kukaa', 'heshe', 'perfect', 'pos', 'He/she has sat down'],
  ['kupata', 'i', 'perfect', 'pos', 'I have got it'],
  ['kupata', 'i', 'perfect', 'neg', "I haven't got it yet"],
  ['kuweza', 'i', 'perfect', 'pos', 'I have managed'],
  ['kuweza', 'heshe', 'perfect', 'neg', "He/she hasn't managed yet"],
  ['kuweza', 'i', 'future', 'pos', 'I will be able to'],
  // English that needs an object, or would be ambiguous without one.
  ['kutafuta', 'i', 'present', 'pos', 'I am searching'],
  ['kutafuta', 'we', 'perfect', 'neg', "We haven't searched yet"],
  ['kutunza', 'i', 'present', 'pos', 'I am looking after (something)'],
  ['kuweka', 'we', 'present', 'pos', 'We are putting (something)'],
  ['kuweka', 'we', 'past', 'pos', 'We put (something)'],
  ['kuweka', 'i', 'perfect', 'neg', "I haven't put (something) yet"],
  ['kuchukua', 'i', 'present', 'pos', 'I am taking'],
  ['kuleta', 'i', 'present', 'pos', 'I am bringing'],
  // A second clause with its own subject.
  ['kutoka', 'i', 'present', 'pos', 'I am going out / I come from'],
  [
    'kutoka',
    'heshe',
    'present',
    'pos',
    'He/she is going out / he/she comes from',
  ],
  [
    'kutoka',
    'heshe',
    'present',
    'neg',
    "He/she is not going out / he/she doesn't come from",
  ],
  ['kutoka', 'i', 'past', 'pos', 'I went out'],
  // kuwa isn't in Nani na Lini?, but its card's English is still right.
  ['kuwa', 'i', 'present', 'pos', 'I am becoming'],
] as const)('%s %s %s %s: "%s"', (sw, subject, tense, polarity, en) => {
  expect(say(sw, subject, tense, polarity)).toBe(en);
});

test('every verb gives clean English for every pattern', () => {
  for (const { verb: v } of naniVerbs) {
    for (const p of allPatterns(rules).filter((pat) => pat.tense !== 'have')) {
      const en = english(rules, p, v);
      expect(en, `${v.sw} ${p.id}`).toMatch(/^[A-Z][A-Za-z/ ()'-]+$/);
      expect(en, `${v.sw} ${p.id}`).not.toMatch(/undefined|\{/);
    }
  }
});

test('kuacha never says "stop" (a halt) or "leave" (going away)', () => {
  const kuacha = { sw: 'kuacha', en: verb('kuacha').en };
  for (const p of allPatterns(rules).filter((pat) => pat.tense !== 'have'))
    expect(english(rules, p, kuacha), p.id).not.toMatch(/stop|leav|left/);
});

describe('it / they (N-class)', () => {
  test('are labelled N-class, not the general "it" and "they"', () => {
    const label = (id: string) => rules.subjects.find((s) => s.id === id)?.en;
    expect(label('it')).toBe('it (N-class)');
    expect(label('things')).toBe('they (N-class)');
  });

  test('their answers explain the N class, and other subjects get no note', () => {
    const view = naniView(rules, naniVerbs);
    const note = (subject: string) =>
      view({
        key: `nani-${subject}-have-pos:en-sw`,
        cardId: `nani-${subject}-have-pos`,
        direction: 'en-sw',
      })?.answer.note;
    for (const subject of ['it', 'things']) {
      expect(note(subject)).toMatch(
        /N-class nouns like nyumba \(nyumba ina vyumba vitatu/
      );
      expect(note(subject)).toMatch(
        /animals usually take a-\/wa- \(mbwa anakula/
      );
    }
    for (const subject of ['i', 'you', 'heshe', 'we', 'youpl', 'they'])
      expect(note(subject), subject).toBeUndefined();
  });
});
