// @vitest-environment node
//
// The core verbs added on 2026-11-11 (go, come, eat, do, say, …), pinned against the real deck
// files and rules.yaml: each card's meaning, stem, kept-ku forms and the notes it was given.
import { beforeAll, describe, expect, test } from 'vitest';

import { indexCards } from './display.ts';
import { conjugate, verbInfo } from '../nani/conjugate.ts';
import { english } from '../nani/english.ts';
import { verbFacts } from '../nani/facts.ts';
import {
  allPatterns,
  patternId,
  type NaniTense,
  type Polarity,
} from '../nani/patterns.ts';
import type { NaniRules } from '../nani/schema.ts';
import { naniVerbs } from '../session/start.ts';
import { vocabView } from '../session/views.ts';
import { loadDeckSources, loadNaniRules } from './node/load.ts';
import type { Verb, VocabDeck } from './schema.ts';
import { parseDecks } from './validate.ts';

let rules: NaniRules;
let decks: VocabDeck[];
beforeAll(() => {
  rules = loadNaniRules(process.cwd()).data!;
  decks = parseDecks(loadDeckSources(process.cwd())).decks;
});

const verb = (sw: string) => {
  const found = decks
    .flatMap((d) => d.cards)
    .find((c) => c.kind === 'verb' && c.sw === sw);
  if (!found) throw new Error(`no verb card ${sw}`);
  return found as Verb;
};
const answer = (sw: string) =>
  vocabView(
    indexCards(decks),
    rules
  )({ key: `verb-${sw}:en-sw`, cardId: `verb-${sw}`, direction: 'en-sw' })!
    .answer;
const p = (subject: string, tense: NaniTense, polarity: Polarity) => ({
  id: patternId(subject, tense, polarity),
  subject,
  tense,
  polarity,
});
const form = (
  sw: string,
  subject: string,
  tense: NaniTense,
  polarity: Polarity
) => conjugate(rules, p(subject, tense, polarity), { sw, en: verb(sw).en }).sw;
const inNani = (sw: string) =>
  naniVerbs(decks, rules).some((v) => v.verb.sw === sw);

test.each([
  ['kwenda', 'to go', 'enda'],
  ['kuja', 'to come', 'ja'],
  ['kula', 'to eat', 'la'],
  ['kufanya', 'to do / to make', 'fanya'],
  ['kusema', 'to say', 'sema'],
  ['kuona', 'to see', 'ona'],
  ['kupata', 'to get / to obtain', 'pata'],
  ['kupa', 'to give', 'pa'],
  ['kupenda', 'to like / to love', 'penda'],
  ['kuelewa', 'to understand', 'elewa'],
  ['kuhitaji', 'to need', 'hitaji'],
  ['kutoka', 'to go out / to come from / to leave', 'toka'],
  ['kurudi', 'to return / to come back', 'rudi'],
  ['kufika', 'to arrive', 'fika'],
  ['kulala', 'to sleep / to lie down', 'lala'],
])('%s: "%s", stem %s', (sw, meaning, stem) => {
  expect(answer(sw).text).toBe(sw);
  expect(answer(sw).stem).toBe(stem);
  const view = vocabView(
    indexCards(decks),
    rules
  )({ key: `verb-${sw}:sw-en`, cardId: `verb-${sw}`, direction: 'sw-en' });
  expect(view?.answer.text).toBe(meaning);
});

describe('go: kwenda is irregular', () => {
  test('it keeps kw- in the tenses: ninakwenda', () => {
    expect(form('kwenda', 'i', 'present', 'pos')).toBe('ninakwenda');
    expect(answer('kwenda').kept).toBe(
      'Keeps kw-: ninakwenda · nilikwenda · nitakwenda · nimekwenda'
    );
  });

  test('the card mentions ninaenda and the command nenda!', () => {
    expect(verb('kwenda').note).toMatch(/Ninaenda is common too/);
    expect(verb('kwenda').note).toMatch(/nenda!/);
  });
});

describe('come: kuja is one syllable', () => {
  test('it keeps ku-: nilikuja', () => {
    expect(form('kuja', 'i', 'past', 'pos')).toBe('nilikuja');
    expect(answer('kuja').kept).toMatch(
      /^One syllable, so it keeps ku-: ninakuja · nilikuja/
    );
  });

  test('the card has the command njoo!', () => {
    expect(verb('kuja').note).toMatch(/njoo!/);
  });
});

test('eat: kula is one syllable: ninakula', () => {
  expect(form('kula', 'i', 'present', 'pos')).toBe('ninakula');
  expect(answer('kula').kept).toMatch(/ninakula/);
});

describe('give: kupa needs a marker for who receives it', () => {
  test('the card says so, with nipe', () => {
    expect(verb('kupa').note).toMatch(
      /marker for who receives it: nipe, give me/
    );
  });

  test('it is left out of Nani na Lini?, and its card lists no kept-ku forms', () => {
    expect(verbInfo(rules, 'kupa')).toMatchObject({
      needsObject: true,
      exclude: true,
    });
    expect(inNani('kupa')).toBe(false);
    expect(verbFacts(rules, 'kupa').kept).toBeUndefined();
    expect(answer('kupa').kept).toBeUndefined();
    expect(answer('kupa').stem).toBe('pa');
  });
});

test('have: the kuwa na card is there, with nina and nilikuwa na', () => {
  const card = decks
    .flatMap((d) => d.cards)
    .find((c) => c.id === 'vocab-kuwa-na');
  expect(card).toMatchObject({ sw: 'kuwa na', en: 'to have' });
  expect(card?.note).toMatch(/nina/);
  expect(card?.note).toMatch(/nilikuwa na/);
});

describe('understand: sielewi = I don’t understand', () => {
  test('the engine gives sielewi, and its English', () => {
    expect(form('kuelewa', 'i', 'present', 'neg')).toBe('sielewi');
    const kuelewa = verb('kuelewa');
    expect(
      english(rules, p('i', 'present', 'neg'), {
        sw: 'kuelewa',
        en: kuelewa.en,
      })
    ).toBe("I don't understand");
  });

  test('the card uses it as its example', () => {
    expect(verb('kuelewa').example).toEqual({
      sw: 'Sielewi.',
      en: "I don't understand.",
    });
  });
});

test('stems ending in -i keep it in the present negative: sihitaji, sirudi', () => {
  expect(form('kuhitaji', 'i', 'present', 'neg')).toBe('sihitaji');
  expect(form('kurudi', 'i', 'present', 'neg')).toBe('sirudi');
});

test('stative verbs take the simple present: I see, he/she likes, he/she needs', () => {
  const say = (sw: string, subject: string, polarity: Polarity) =>
    english(rules, p(subject, 'present', polarity), { sw, en: verb(sw).en });
  expect(say('kuona', 'i', 'pos')).toBe('I see');
  expect(say('kupenda', 'heshe', 'pos')).toBe('He/she likes');
  expect(say('kuhitaji', 'heshe', 'pos')).toBe('He/she needs');
  expect(say('kupenda', 'we', 'neg')).toBe("We don't like");
});

test('every new verb but kupa is used in Nani na Lini?', () => {
  for (const sw of [
    'kwenda',
    'kuja',
    'kula',
    'kufanya',
    'kusema',
    'kuona',
    'kupata',
    'kupenda',
    'kuelewa',
    'kuhitaji',
    'kutoka',
    'kurudi',
    'kufika',
    'kulala',
  ]) {
    expect(inNani(sw), sw).toBe(true);
  }
});

test('every Nani na Lini? verb in the decks gives a Swahili form and English for every pattern', () => {
  for (const { verb: v } of naniVerbs(decks, rules)) {
    for (const pattern of allPatterns(rules).filter(
      (pat) => pat.tense !== 'have'
    )) {
      expect(conjugate(rules, pattern, v).sw, `${v.sw} ${pattern.id}`).toMatch(
        /^[a-z]+$/
      );
      const en = english(rules, pattern, v);
      // Letters, spaces, / ( ) ' and - (for "(N-class)"); never a leftover {placeholder}.
      expect(en, `${v.sw} ${pattern.id}`).toMatch(/^[A-Z][A-Za-z/ ()'-]+$/);
      expect(en, `${v.sw} ${pattern.id}`).not.toMatch(/undefined|\{/);
    }
  }
});
