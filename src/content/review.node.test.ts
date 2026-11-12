// @vitest-environment node
//
// Review of forms.md and the verbs (2026-11-11). Each point is pinned here against the real
// deck files, rules.yaml and fixtures.yaml, so no later edit can quietly undo it.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';

import { english } from '../nani/english.ts';
import { checkFixtures, VERIFIED_SOURCE } from '../nani/fixtures.ts';
import {
  allPatterns,
  patternId,
  type NaniTense,
  type Polarity,
} from '../nani/patterns.ts';
import type { NaniFixtures, NaniRules } from '../nani/schema.ts';
import { naniVerbs } from '../session/start.ts';
import { naniView } from '../session/views.ts';
import {
  loadDeckSources,
  loadNaniFixtures,
  loadNaniRules,
} from './node/load.ts';
import type { Verb, VocabDeck } from './schema.ts';
import { parseDecks } from './validate.ts';

let rules: NaniRules;
let fixtures: NaniFixtures;
let decks: VocabDeck[];
beforeAll(() => {
  rules = loadNaniRules(process.cwd()).data!;
  fixtures = loadNaniFixtures(process.cwd()).data!;
  decks = parseDecks(loadDeckSources(process.cwd())).decks;
});

const verb = (sw: string) =>
  decks
    .flatMap((d) => d.cards)
    .find((c): c is Verb => c.kind === 'verb' && c.sw === sw)!;
const p = (subject: string, tense: NaniTense, polarity: Polarity) => ({
  id: patternId(subject, tense, polarity),
  subject,
  tense,
  polarity,
});
const noErrors = { path: '', at: () => ({}) };

describe('kuacha: leaving something behind, or stopping; not going away', () => {
  test('the meaning says "(behind)"', () => {
    expect(verb('kuacha').en.meaning).toBe(
      'to leave (behind) / to stop / to let'
    );
  });

  test('the note: it needs an object (ninaacha kazi), and going away is ninaondoka', () => {
    expect(verb('kuacha').note).toMatch(
      /Needs an object: ninaacha kazi, I'm quitting my job/
    );
    expect(verb('kuacha').note).toMatch(
      /"I'm leaving" \(going away\) is ninaondoka/
    );
  });

  test('Nani na Lini? sentences say "stop", never "leaving"', () => {
    const kuacha = { sw: 'kuacha', en: verb('kuacha').en };
    expect(english(rules, p('i', 'present', 'pos'), kuacha)).toBe(
      'I am stopping'
    );
    for (const pattern of allPatterns(rules).filter(
      (pat) => pat.tense !== 'have'
    )) {
      expect(english(rules, pattern, kuacha)).not.toMatch(/leav|left/);
    }
  });
});

describe('i-/zi- are N-class only, not the general "it"', () => {
  test('the subjects are labelled N-class', () => {
    const label = (id: string) => rules.subjects.find((s) => s.id === id)?.en;
    expect(label('it')).toBe('it (N-class)');
    expect(label('things')).toBe('they (N-class)');
    expect(
      english(rules, p('it', 'present', 'pos'), {
        sw: 'kusoma',
        en: verb('kusoma')?.en ?? {
          base: 'read',
          past: 'read',
          participle: 'read',
          ing: 'reading',
        },
      })
    ).toBe('It (N-class) is reading');
  });

  test('their answers explain the N class, with nyumba, and that animals take a-/wa-', () => {
    const view = naniView(rules, naniVerbs(decks, rules));
    for (const subject of ['it', 'things']) {
      const card = view({
        key: `nani-${subject}-have-pos:en-sw`,
        cardId: `nani-${subject}-have-pos`,
        direction: 'en-sw',
      });
      expect(card?.answer.note).toMatch(
        /N-class nouns like nyumba \(nyumba ina vyumba vitatu/
      );
      expect(card?.answer.note).toMatch(
        /animals usually take a-\/wa- \(mbwa anakula/
      );
    }
  });

  test('other subjects get no such note', () => {
    const view = naniView(rules, naniVerbs(decks, rules));
    for (const subject of ['i', 'you', 'heshe', 'we', 'youpl', 'they']) {
      const card = view({
        key: `nani-${subject}-have-pos:en-sw`,
        cardId: `nani-${subject}-have-pos`,
        direction: 'en-sw',
      });
      expect(card?.answer.note, subject).toBeUndefined();
    }
  });
});

describe('✅ means the tutor or the grammar sheets, nothing else', () => {
  test('every verified table says it was confirmed by the tutor or checked against the sheets', () => {
    const verified = fixtures.paradigms.filter((t) => t.verified);
    expect(verified.length).toBeGreaterThan(0);
    for (const table of verified)
      expect(table.note, `${table.verb} ${table.tense}`).toMatch(
        VERIFIED_SOURCE
      );
  });

  test('tables from the core-verbs list are not ticked', () => {
    for (const table of fixtures.paradigms.filter((t) =>
      /core-verbs list/.test(t.note ?? '')
    )) {
      expect(table.verified, `${table.verb} ${table.tense}`).toBe(false);
    }
  });

  test('the checker rejects a ticked table that does not say who confirmed it', () => {
    const data = structuredClone(fixtures);
    const table = data.paradigms.find(
      (t) => t.verb === 'kusoma' && t.tense === 'past'
    )!;
    table.verified = true;
    table.note = "From somebody's list.";
    expect(
      checkFixtures(rules, data, noErrors).errors.map((e) => e.message)
    ).toContainEqual(
      expect.stringMatching(
        /kusoma past: a verified table's note must start with "Confirmed by Chris's tutor"/
      )
    );
  });
});

describe('one table per verb and tense', () => {
  test('there are no duplicates', () => {
    const names = fixtures.paradigms.map(
      (t) => `${t.verb ?? 'have'} ${t.tense}`
    );
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  test('the checker rejects a duplicate', () => {
    const data = structuredClone(fixtures);
    data.paradigms.push(
      structuredClone(
        data.paradigms.find((t) => t.verb === 'kula' && t.tense === 'present')!
      )
    );
    expect(
      checkFixtures(rules, data, noErrors).errors.map((e) => e.message)
    ).toContainEqual(
      "kula present: there's already a table for this verb and tense; merge them"
    );
  });

  test("the tutor's ninakunywa and nilikunywa are noted in the full kunywa tables", () => {
    const note = (tense: string) =>
      fixtures.paradigms.find((t) => t.verb === 'kunywa' && t.tense === tense)
        ?.note;
    expect(note('present')).toMatch(/tutor confirmed ninakunywa/);
    expect(note('past')).toMatch(/tutor confirmed nilikunywa/);
  });
});

test('forms.md: the kuwa na heading says "(to have)" like the others', () => {
  expect(readFileSync('decks/nani-na-lini/forms.md', 'utf8')).toMatch(
    /^## ⬜ kuwa na \(to have\): Have/m
  );
});

describe('sijala and sikwenda: textbook forms, but Nairobi often says otherwise', () => {
  test.each([
    ['kula', 'perfect', 'sijala', 'sijakula'],
    ['kwenda', 'past', 'sikwenda', 'sikuenda'],
  ])(
    '%s %s: %s is in the table, with a note about %s, and it is not ticked',
    (sw, tense, textbook, everyday) => {
      const table = fixtures.paradigms.find(
        (t) => t.verb === sw && t.tense === tense
      )!;
      expect(table.neg).toContain(textbook);
      expect(table.note).toMatch(
        new RegExp(`you'll often hear ${everyday}; check with your tutor`)
      );
      expect(table.verified).toBe(false);
    }
  );
});
