// @vitest-environment node
//
// Chris's tutor reviewed the verbs deck (2026-11-11). Each point of that feedback is pinned here,
// against the real deck files and rules.yaml, so no later edit can quietly undo it.
import { beforeAll, describe, expect, test } from 'vitest';

import { indexCards } from './display.ts';
import { conjugate, verbInfo } from '../nani/conjugate.ts';
import { english } from '../nani/english.ts';
import { verbFacts } from '../nani/facts.ts';
import { patternId, type NaniTense, type Polarity } from '../nani/patterns.ts';
import type { NaniRules } from '../nani/schema.ts';
import { naniVerbs } from '../session/start.ts';
import { vocabView } from '../session/views.ts';
import { loadDeckSources, loadNaniRules } from './node/load.ts';
import type { Verb, VocabCard, VocabDeck } from './schema.ts';
import { parseDecks } from './validate.ts';

let rules: NaniRules;
let decks: VocabDeck[];
beforeAll(() => {
  rules = loadNaniRules(process.cwd()).data!;
  decks = parseDecks(loadDeckSources(process.cwd())).decks;
});

const card = (id: string): VocabCard => {
  const found = decks.flatMap((d) => d.cards).find((c) => c.id === id);
  if (!found) throw new Error(`no card ${id}`);
  return found;
};
const verb = (id: string) => card(id) as Verb;
const p = (subject: string, tense: NaniTense, polarity: Polarity) => ({
  id: patternId(subject, tense, polarity),
  subject,
  tense,
  polarity,
});
/** What the card's answer side shows, going English → Swahili. */
const answer = (id: string) =>
  vocabView(
    indexCards(decks),
    rules
  )({ key: `${id}:en-sw`, cardId: id, direction: 'en-sw' })!.answer;

describe('kuwa: stem wa, one syllable, and not the present "am/is/are"', () => {
  test('its stem is wa, and the card shows it', () => {
    expect(verbFacts(rules, 'kuwa').stem).toBe('wa');
    expect(answer('verb-kuwa').stem).toBe('wa');
  });

  test('it keeps its ku- in the na/li/ta/me tenses, and the card says so', () => {
    expect(verbFacts(rules, 'kuwa').kept?.forms).toEqual([
      'ninakuwa',
      'nilikuwa',
      'nitakuwa',
      'nimekuwa',
    ]);
    expect(answer('verb-kuwa').kept).toBe(
      'One syllable, so it keeps ku-: ninakuwa · nilikuwa · nitakuwa · nimekuwa'
    );
  });

  test('the card explains that "I am" is ni, and ninakuwa is "I\'m becoming"', () => {
    const kuwa = verb('verb-kuwa');
    expect(kuwa.en.meaning).toBe('to be / to become');
    expect(kuwa.note).toMatch(/mimi ni mwalimu/);
    expect(kuwa.note).toMatch(/Ninakuwa means I'm becoming/);
    expect(
      english(rules, p('i', 'present', 'pos'), { sw: kuwa.sw, en: kuwa.en })
    ).toBe('I am becoming');
  });

  test('it stays out of Nani na Lini?, where its English would mislead', () => {
    expect(verbInfo(rules, 'kuwa').exclude).toBe(true);
    expect(naniVerbs(decks, rules).map((v) => v.id)).not.toContain('verb-kuwa');
  });
});

describe('kunywa: stem nywa, one syllable', () => {
  test('its stem is nywa, and the card shows it', () => {
    expect(answer('verb-kunywa').stem).toBe('nywa');
  });

  test('it keeps its ku-: ninakunywa, nilikunywa, nitakunywa', () => {
    expect(verbFacts(rules, 'kunywa').kept?.forms).toEqual([
      'ninakunywa',
      'nilikunywa',
      'nitakunywa',
      'nimekunywa',
    ]);
    expect(answer('verb-kunywa').kept).toMatch(
      /^One syllable, so it keeps ku-: ninakunywa · nilikunywa · nitakunywa/
    );
  });
});

test('kuoga: "to bathe / to shower", with the slash', () => {
  expect(verb('verb-kuoga').en.meaning).toBe('to bathe / to shower');
});

describe('kuita: to call, not to shout; its passive is kuitwa', () => {
  test('call / call out / name, and no "shout"', () => {
    const kuita = verb('verb-kuita');
    expect(kuita.en.meaning).toBe('to call / to call out / to name');
    expect(kuita.en.meaning).not.toMatch(/shout/);
  });

  test("with the tutor's example, and a pointer to kupiga kelele for shouting", () => {
    const kuita = verb('verb-kuita');
    expect(kuita.example).toEqual({
      sw: 'Wanamwita Chris.',
      en: 'They call him Chris.',
    });
    expect(kuita.note).toMatch(/kupiga kelele/);
  });

  test('the two cards point at each other', () => {
    expect(verb('verb-kuita').note).toMatch(/passive is kuitwa/);
    expect(verb('verb-kuitwa').note).toMatch(/passive of kuita/);
  });
});

describe('kuonana is "see each other"; kukutana is "meet"', () => {
  test('kuonana means to see each other, not to meet', () => {
    const kuonana = verb('verb-kuonana');
    expect(kuonana.en.meaning).toBe('to see each other');
    expect(kuonana.en.meaning).not.toMatch(/meet/);
    expect(kuonana.example).toEqual({
      sw: 'Tuonane baadaye.',
      en: 'See you later.',
    });
    expect(kuonana.note).toMatch(/kukutana/);
  });

  test('kukutana is its own card, "to meet", and it is used in Nani na Lini?', () => {
    const kukutana = verb('verb-kukutana');
    expect(answer('verb-kukutana').text).toBe('kukutana');
    expect(card('verb-kukutana').kind).toBe('verb');
    expect(naniVerbs(decks, rules).map((v) => v.id)).toContain('verb-kukutana');
    const we = { sw: kukutana.sw, en: kukutana.en };
    expect(conjugate(rules, p('we', 'past', 'pos'), we).sw).toBe('tulikutana');
    expect(english(rules, p('we', 'past', 'pos'), we)).toBe('We met');
  });

  test('kuonana stays out of Nani na Lini?: it is reciprocal ("I saw each other")', () => {
    expect(verbInfo(rules, 'kuonana').exclude).toBe(true);
    expect(naniVerbs(decks, rules).map((v) => v.id)).not.toContain(
      'verb-kuonana'
    );
  });
});

describe('optional: kuishi and kukaa both mean "live"', () => {
  test('each card says how it differs from the other', () => {
    expect(card('verb-kuishi').note).toMatch(/be alive, or reside/);
    expect(card('verb-kuishi').note).toMatch(/Compare kukaa/);
    expect(card('verb-kukaa').note).toMatch(/stay or sit; also to reside/);
    expect(card('verb-kukaa').note).toMatch(/Compare kuishi/);
  });

  test("kukaa has the tutor's example, and kuishi's English prompt is told apart", () => {
    expect(verb('verb-kukaa').example).toEqual({
      sw: 'Anakaa Nairobi.',
      en: 'He lives in Nairobi.',
    });
    expect(card('verb-kuishi').hint).toBe('(be alive, or reside)');
  });
});

describe('optional: kuwa na gets its own card', () => {
  test('"to have"', () => {
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
      nina: conjugate(rules, p('i', 'have', 'pos')).sw,
      sina: conjugate(rules, p('i', 'have', 'neg')).sw,
      'nilikuwa na': `${conjugate(rules, p('i', 'past', 'pos'), kuwa).sw} na`,
      'nitakuwa na': `${conjugate(rules, p('i', 'future', 'pos'), kuwa).sw} na`,
    };
    for (const [expected, actual] of Object.entries(forms)) {
      expect(actual).toBe(expected);
      expect(note).toContain(expected);
    }
  });
});

test('every verb card shows its stem', () => {
  for (const v of decks
    .flatMap((d) => d.cards)
    .filter((c): c is Verb => c.kind === 'verb')) {
    expect(answer(v.id).stem, v.sw).toBe(verbInfo(rules, v.sw).stem);
  }
});
