// @vitest-environment node
//
// The verbs deck as the app shows it: meanings, stems, kept ku- forms, notes and examples, and
// which verbs Nani na Lini? uses.
import { describe, expect, test } from 'vitest';

import { indexCards } from './display.ts';
import { realContent } from './node/real-content.ts';
import { conjugate, verbInfo } from '../nani/conjugate.ts';
import { pattern } from '../nani/patterns.ts';
import { vocabView } from '../session/views.ts';

const { decks, rules, cards, card, verb, naniVerbs } = realContent();
const verbCards = cards.filter((c) => c.kind === 'verb');

const view = (sw: string, direction: 'sw-en' | 'en-sw') =>
  vocabView(
    indexCards(decks),
    rules
  )({
    key: `${verb(sw).id}:${direction}`,
    cardId: verb(sw).id,
    direction,
  })!;

test.each([
  ['kwenda', 'to go', 'enda'],
  ['kuja', 'to come', 'ja'],
  ['kula', 'to eat', 'la'],
  ['kunywa', 'to drink', 'nywa'],
  ['kuwa', 'to be / to become', 'wa'],
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
  ['kusikia', 'to hear / to feel', 'sikia'],
  ['kuuliza', 'to ask', 'uliza'],
  ['kujibu', 'to answer', 'jibu'],
  ['kufikiri', 'to think', 'fikiri'],
  ['kuongea', 'to talk', 'ongea'],
  ['kuzungumza', 'to talk / to chat', 'zungumza'],
  ['kununua', 'to buy', 'nunua'],
  ['kulipa', 'to pay', 'lipa'],
  ['kuleta', 'to bring', 'leta'],
  ['kuchukua', 'to take', 'chukua'],
  ['kuweka', 'to put / to place', 'weka'],
  ['kusaidia', 'to help', 'saidia'],
  ['kutafuta', 'to look for / to search', 'tafuta'],
  ['kungoja', 'to wait', 'ngoja'],
  ['kusubiri', 'to wait', 'subiri'],
  ['kupiga', 'to hit / to strike', 'piga'],
  ['kuacha', 'to quit / to stop doing / to leave behind', 'acha'],
  ['kuoga', 'to bathe / to shower', 'oga'],
  ['kuita', 'to call / to call out', 'ita'],
  ['kuonana', 'to see each other', 'onana'],
  ['kukutana', 'to meet', 'kutana'],
])('%s: "%s", stem %s', (sw, meaning, stem) => {
  expect(view(sw, 'sw-en').answer.text).toBe(meaning);
  expect(view(sw, 'en-sw').answer).toMatchObject({ text: sw, stem });
});

test('every verb card shows its stem', () => {
  for (const v of verbCards)
    expect(view(v.sw, 'en-sw').answer.stem, v.sw).toBe(
      verbInfo(rules, v.sw).stem
    );
});

test('no verb is on two cards', () => {
  const seen = verbCards.map((c) => c.sw);
  expect(seen.filter((sw, i) => seen.indexOf(sw) !== i)).toEqual([]);
});

test('Nani na Lini? uses every verb but kuwa, kuonana and kupa', () => {
  expect(naniVerbs.map((v) => v.verb.sw).sort()).toEqual(
    verbCards
      .map((c) => c.sw)
      .filter((sw) => !['kuwa', 'kuonana', 'kupa'].includes(sw))
      .sort()
  );
});

describe('verbs that keep their ku- list the forms that show it', () => {
  test.each([
    ['kwenda', 'Keeps kw-: ninakwenda · nilikwenda · nitakwenda · nimekwenda'],
    [
      'kuja',
      'One syllable, so it keeps ku-: ninakuja · nilikuja · nitakuja · nimekuja',
    ],
    [
      'kula',
      'One syllable, so it keeps ku-: ninakula · nilikula · nitakula · nimekula',
    ],
    [
      'kunywa',
      'One syllable, so it keeps ku-: ninakunywa · nilikunywa · nitakunywa · nimekunywa',
    ],
    [
      'kuwa',
      'One syllable, so it keeps ku-: ninakuwa · nilikuwa · nitakuwa · nimekuwa',
    ],
  ])('%s', (sw, kept) => {
    expect(view(sw, 'en-sw').answer.kept).toBe(kept);
  });

  test('but not kupa, which never appears without a marker for who receives it', () => {
    expect(view('kupa', 'en-sw').answer.kept).toBeUndefined();
  });

  test('regular verbs list nothing', () => {
    expect(view('kufanya', 'en-sw').answer.kept).toBeUndefined();
  });
});

test.each([
  ['kwenda', /Ninaenda is common too/],
  ['kwenda', /nenda!/],
  ['kuja', /njoo!/],
  ['kupa', /marker for who receives it: nipe, give me/],
  ['kuwa', /mimi ni mwalimu/],
  ['kuwa', /Ninakuwa means I'm becoming/],
  ['kuita', /call someone by a name, as in the example/],
  ['kuita', /passive is kuitwa/],
  ['kuita', /kupiga kelele/],
  ['kuitwa', /passive of kuita/],
  ['kuonana', /kukutana/],
  ['kuishi', /be alive, or reside/],
  ['kuishi', /Compare kukaa/],
  ['kukaa', /stay or sit; also to reside/],
  ['kukaa', /Compare kuishi/],
  ['kusikia', /Nasikia is everyday speech for ninasikia/],
  ['kusikia', /Compare kusikiliza: to listen/],
  ['kusikiliza', /Compare kusikia: to hear/],
  ['kuongea', /More everyday in Kenya than kuzungumza/],
  ['kuzungumza', /Compare kuongea/],
  ['kupiga', /piga simu, phone someone/],
  ['kupiga', /piga picha, take a photo/],
  ['kupiga', /piga kelele, shout/],
  ['kuacha', /Needs an object: ninaacha kazi, I'm quitting my job/],
  ['kuacha', /"to let": mwache aende, let him\/her go/],
  ['kuacha', /To come to a halt \(like a car\) is kusimama/],
  ['kuacha', /"I'm leaving" \(going away\) is ninaondoka/],
])('%s note: %s', (sw, text) => {
  expect(verb(sw).note).toMatch(text);
});

test.each([
  ['kuelewa', 'Sielewi.', "I don't understand."],
  ['kuita', 'Wanamwita Chris.', 'They call him Chris.'],
  ['kuonana', 'Tuonane baadaye.', 'See you later.'],
  ['kukaa', 'Anakaa Nairobi.', 'He lives in Nairobi.'],
  ['kusikia', 'Nasikia njaa.', 'I feel hungry.'],
])('%s example: %s', (sw, swahili, en) => {
  expect(verb(sw).example).toEqual({ sw: swahili, en });
});

describe('verbs with the same English are told apart', () => {
  test('kuishi and kuongea have hints on the English side', () => {
    expect(view('kuishi', 'en-sw').prompt.hint).toBe('(be alive, or reside)');
    expect(view('kuongea', 'en-sw').prompt).toEqual({
      text: 'to talk',
      lang: 'en',
      hint: '(everyday, especially in Kenya)',
    });
  });

  test('kungoja and kusubiri accept each other, and show it', () => {
    expect(verb('kungoja').alt).toEqual(['kusubiri']);
    expect(verb('kusubiri').alt).toEqual(['kungoja']);
    expect(view('kungoja', 'en-sw').answer.alt).toEqual(['kusubiri']);
  });
});

describe('kuwa na (to have)', () => {
  test('has its own card', () => {
    expect(card('vocab-kuwa-na')).toMatchObject({
      kind: 'word',
      sw: 'kuwa na',
      en: 'to have',
    });
  });

  test('every form in its note is what the grammar engine produces', () => {
    const note = card('vocab-kuwa-na').note!;
    const kuwa = { sw: 'kuwa', en: { base: 'be' } };
    const forms = {
      nina: conjugate(rules, pattern('i', 'have', 'pos')).sw,
      sina: conjugate(rules, pattern('i', 'have', 'neg')).sw,
      'nilikuwa na': `${conjugate(rules, pattern('i', 'past', 'pos'), kuwa).sw} na`,
      'nitakuwa na': `${conjugate(rules, pattern('i', 'future', 'pos'), kuwa).sw} na`,
    };
    for (const [expected, actual] of Object.entries(forms)) {
      expect(actual).toBe(expected);
      expect(note).toContain(expected);
    }
  });
});
