// @vitest-environment node
//
// The everyday verbs added on 2026-11-11 (hear, ask, answer, think, talk, buy, …), pinned
// against the real deck files and rules.yaml.
import { beforeAll, describe, expect, test } from 'vitest';

import { indexCards } from './display.ts';
import { conjugate } from '../nani/conjugate.ts';
import { english } from '../nani/english.ts';
import { patternId, type NaniTense, type Polarity } from '../nani/patterns.ts';
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

const verbCards = () =>
  decks.flatMap((d) => d.cards).filter((c): c is Verb => c.kind === 'verb');
const verb = (sw: string) => {
  const found = verbCards().find((c) => c.sw === sw);
  if (!found) throw new Error(`no verb card ${sw}`);
  return found;
};
const view = (sw: string, direction: 'sw-en' | 'en-sw') =>
  vocabView(
    indexCards(decks),
    rules
  )({ key: `verb-${sw}:${direction}`, cardId: `verb-${sw}`, direction })!;
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
const say = (
  sw: string,
  subject: string,
  tense: NaniTense,
  polarity: Polarity
) => english(rules, p(subject, tense, polarity), { sw, en: verb(sw).en });

test.each([
  ['kusikia', 'to hear / to feel', 'sikia'],
  ['kuuliza', 'to ask', 'uliza'],
  ['kujibu', 'to answer', 'jibu'],
  ['kufikiri', 'to think', 'fikiri'],
  ['kuongea', 'to talk', 'ongea'],
  ['kununua', 'to buy', 'nunua'],
  ['kulipa', 'to pay', 'lipa'],
  ['kuleta', 'to bring', 'leta'],
  ['kuchukua', 'to take', 'chukua'],
  ['kuweka', 'to put / to place', 'weka'],
  ['kusaidia', 'to help', 'saidia'],
  ['kutafuta', 'to look for', 'tafuta'],
  ['kungoja', 'to wait', 'ngoja'],
  ['kusubiri', 'to wait', 'subiri'],
  ['kupiga', 'to hit / to strike', 'piga'],
  ['kuacha', 'to quit / to stop doing / to leave behind', 'acha'],
])('%s: "%s", stem %s, and used in Nani na Lini?', (sw, meaning, stem) => {
  expect(view(sw, 'sw-en').answer.text).toBe(meaning);
  expect(view(sw, 'en-sw').answer).toMatchObject({ text: sw, stem });
  expect(naniVerbs(decks, rules).some((v) => v.verb.sw === sw)).toBe(true);
});

describe('hear / feel: kusikia', () => {
  test('nasikia njaa = I feel hungry, explained as everyday speech for ninasikia', () => {
    const kusikia = verb('kusikia');
    expect(kusikia.example).toEqual({
      sw: 'Nasikia njaa.',
      en: 'I feel hungry.',
    });
    expect(kusikia.note).toMatch(/Nasikia is everyday speech for ninasikia/);
    expect(form('kusikia', 'i', 'present', 'pos')).toBe('ninasikia');
  });

  test('pairs with kusikiliza, both ways', () => {
    expect(verb('kusikia').note).toMatch(/Compare kusikiliza: to listen/);
    expect(verb('kusikiliza').note).toMatch(/Compare kusikia: to hear/);
  });

  test('stative: "He/she hears", not "is hearing"', () => {
    expect(say('kusikia', 'heshe', 'present', 'pos')).toBe('He/she hears');
  });
});

describe('talk: kuongea, more everyday in Kenya than kuzungumza', () => {
  test('both cards say so, and the English prompts can be told apart', () => {
    expect(verb('kuongea').note).toMatch(
      /More everyday in Kenya than kuzungumza/
    );
    expect(verb('kuzungumza').note).toMatch(/Compare kuongea/);
    expect(view('kuongea', 'en-sw').prompt).toEqual({
      text: 'to talk',
      lang: 'en',
      hint: '(everyday, especially in Kenya)',
    });
    expect(view('kuzungumza', 'en-sw').prompt.text).toBe('to talk / to chat');
  });
});

describe('wait: kungoja and kusubiri', () => {
  test('each accepts the other as an answer, and shows it', () => {
    expect(verb('kungoja').alt).toEqual(['kusubiri']);
    expect(verb('kusubiri').alt).toEqual(['kungoja']);
    expect(view('kungoja', 'en-sw').answer.alt).toEqual(['kusubiri']);
  });

  test('both conjugate on their own: ninangoja, sisubiri (ends in -i)', () => {
    expect(form('kungoja', 'i', 'present', 'pos')).toBe('ninangoja');
    expect(form('kusubiri', 'i', 'present', 'neg')).toBe('sisubiri');
  });
});

test('meet: kukutana is not added twice', () => {
  expect(verbCards().filter((c) => c.sw === 'kukutana')).toHaveLength(1);
});

test('hit: kupiga lists its fixed phrases', () => {
  const note = verb('kupiga').note!;
  expect(note).toMatch(/piga simu, phone someone/);
  expect(note).toMatch(/piga picha, take a photo/);
  expect(note).toMatch(/piga kelele, shout/);
});

test('think: kufikiri is stative and keeps its -i: sifikiri, "I don\'t think"', () => {
  expect(form('kufikiri', 'i', 'present', 'neg')).toBe('sifikiri');
  expect(say('kufikiri', 'i', 'present', 'neg')).toBe("I don't think");
});

test('vowel stems: siulizi, siachi, siongei', () => {
  expect(form('kuuliza', 'i', 'present', 'neg')).toBe('siulizi');
  expect(form('kuacha', 'i', 'present', 'neg')).toBe('siachi');
  expect(form('kuongea', 'i', 'present', 'neg')).toBe('siongei');
});

test('put: "We put" can only be the past, because the present is "We are putting"', () => {
  expect(say('kuweka', 'we', 'past', 'pos')).toBe('We put');
  expect(say('kuweka', 'we', 'present', 'pos')).toBe('We are putting');
});

test('no verb is on two cards', () => {
  const seen = verbCards().map((c) => c.sw);
  expect(seen.filter((sw, i) => seen.indexOf(sw) !== i)).toEqual([]);
});
