// @vitest-environment node
//
// fixtures.yaml: the known-correct forms rules.yaml is proven against, and how the file is kept.
import { describe, expect, test } from 'vitest';

import { verbInfo } from './conjugate.ts';
import { checkFixtures } from './fixtures.ts';
import { NANI_TENSES } from './patterns.ts';
import type { NaniFixtures } from './schema.ts';
import { realContent } from '../content/node/real-content.ts';

const { decks, rules, fixtures, fixturesFile } = realContent();

const noLines: typeof fixturesFile = { path: '', at: () => ({}) };
const check = (data: NaniFixtures, file = noLines) =>
  checkFixtures(rules, data, decks, file);
/** A full table by verb and tense, in a copy of the fixtures a test can tamper with. */
const tableIn = (data: NaniFixtures, verb: string, tense: string) => {
  const table = data.paradigms.find(
    (t) => t.verb === verb && t.tense === tense && t.pos && t.neg
  );
  if (!table) throw new Error(`no full ${verb} ${tense} table`);
  return table as typeof table & { pos: string[]; neg: string[] };
};

test('every fixture comes out of rules.yaml exactly', () => {
  expect(check(fixtures, fixturesFile).errors).toEqual([]);
});

describe('checkFixtures', () => {
  test('a wrong form is reported with its line', () => {
    const data = structuredClone(fixtures);
    tableIn(data, 'kusoma', 'present').neg[3] = 'hatusomu';
    expect(check(data, fixturesFile).errors).toEqual([
      expect.objectContaining({
        path: 'decks/nani-na-lini/fixtures.yaml',
        line: expect.any(Number),
        message:
          'kusoma present negative (we): fixture says hatusomu, rules give hatusomi',
      }),
    ]);
  });

  test('wrong English is reported', () => {
    const data = structuredClone(fixtures);
    data.english[0]!.en = 'I am writing';
    expect(check(data).errors[0]!.message).toMatch(
      /fixture says "I am writing", rules give "I am reading"/
    );
  });

  test('a table with the wrong number of forms is reported', () => {
    const data = structuredClone(fixtures);
    tableIn(data, 'kusoma', 'present').pos.pop();
    expect(check(data).errors[0]!.message).toMatch(/7 forms for 8 subjects/);
  });

  test('a second table for the same verb and tense is rejected', () => {
    const data = structuredClone(fixtures);
    data.paradigms.push(structuredClone(tableIn(data, 'kula', 'present')));
    expect(check(data).errors.map((e) => e.message)).toContain(
      "kula present: there's already a table for this verb and tense; merge them"
    );
  });

  test("a verb with a card can't have its own English under verbs:", () => {
    const data = structuredClone(fixtures);
    data.verbs.kula = {
      base: 'eat',
      past: 'ate',
      participle: 'eaten',
      ing: 'eating',
    };
    expect(check(data).errors.map((e) => e.message)).toContain(
      "kula has a card, so it uses the card's English; remove it from verbs:"
    );
  });

  test('a verb with no card and no English is rejected', () => {
    const data = structuredClone(fixtures);
    delete data.verbs.kusoma;
    expect(check(data).errors[0]!.message).toBe(
      'kusoma present: kusoma has no card; add its English under verbs:'
    );
  });

  test('lists the tables not yet confirmed', () => {
    const data = structuredClone(fixtures);
    data.paradigms.forEach((table) => (table.verified = true));
    tableIn(data, 'kusoma', 'past').verified = false;
    expect(check(data).unverified).toEqual(['kusoma past']);
  });
});

describe('the file', () => {
  const key = (t: NaniFixtures['paradigms'][number]) => t.verb ?? 'kuwa na';

  test("each verb's tables sit together, in tense order", () => {
    const verbs = fixtures.paradigms.map(key);
    const runs = verbs.filter((v, i) => v !== verbs[i - 1]);
    expect(runs.filter((v, i) => runs.indexOf(v) !== i)).toEqual([]);
    for (const v of new Set(verbs)) {
      const tenses = fixtures.paradigms
        .filter((t) => key(t) === v)
        .map((t) => t.tense);
      expect(tenses, v).toEqual(
        [...tenses].sort(
          (a, b) => NANI_TENSES.indexOf(a) - NANI_TENSES.indexOf(b)
        )
      );
    }
  });

  test.each([
    ['kula', 'perfect', 'sijala', 'sijakula'],
    ['kunywa', 'perfect', 'sijanywa', 'sijakunywa'],
    ['kuja', 'perfect', 'sijaja', 'sijakuja'],
    ['kwenda', 'past', 'sikwenda', 'sikuenda'],
  ])(
    '%s %s: the textbook %s, with a note that Nairobi often says %s',
    (sw, tense, textbook, everyday) => {
      const table = fixtures.paradigms.find(
        (t) => t.verb === sw && t.tense === tense
      )!;
      expect(table.neg).toContain(textbook);
      expect(table.note).toMatch(
        new RegExp(`you'll often hear ${everyday}\\b.*check with your tutor`)
      );
    }
  );

  test('every one-syllable perfect negative carries that note', () => {
    const tables = fixtures.paradigms.filter(
      (t) =>
        t.verb &&
        t.tense === 'perfect' &&
        t.neg &&
        verbInfo(rules, t.verb).oneSyllable
    );
    expect(tables.map((t) => t.verb)).toEqual(['kula', 'kunywa', 'kuja']);
    for (const table of tables) {
      // The everyday form puts the ku- back: sijala → sijakula, sijaja → sijakuja.
      const everyday = table.neg![0]!.replace('ja', 'jaku');
      expect(table.note, table.verb).toMatch(
        new RegExp(`you'll often hear ${everyday}\\b`)
      );
    }
  });
});
