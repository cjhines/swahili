import { conjugate, type NaniVerb } from './conjugate.ts';
import { english } from './english.ts';
import {
  NANI_TENSES,
  patternId,
  POLARITIES,
  type NaniTense,
  type Polarity,
} from './patterns.ts';
import type { NaniFixtures, NaniRules } from './schema.ts';
import type { DeckError, Key } from '../content/validate.ts';

// Proves rules.yaml against fixtures.yaml: every listed form must come out exactly.

const fixtureVerb = (
  fixtures: NaniFixtures,
  sw: string | undefined
): NaniVerb | undefined =>
  sw && fixtures.verbs[sw] ? { sw, en: fixtures.verbs[sw] } : undefined;

const pattern = (subject: string, tense: NaniTense, polarity: Polarity) => ({
  id: patternId(subject, tense, polarity),
  subject,
  tense,
  polarity,
});

export const checkFixtures = (
  rules: NaniRules,
  fixtures: NaniFixtures,
  {
    path,
    at,
  }: {
    path: string;
    at: (keys: readonly Key[]) => { line?: number; col?: number };
  }
) => {
  const errors: DeckError[] = [];
  const fail = (keys: readonly Key[], message: string) =>
    errors.push({ path, ...at(keys), message });
  const subjectIds = rules.subjects.map((s) => s.id);
  const unverified: string[] = [];

  fixtures.paradigms.forEach((table, t) => {
    const name = `${table.verb ?? 'have'} ${table.tense}`;
    const subjects = table.subjects ?? subjectIds;
    const unknown = subjects.filter((s) => !subjectIds.includes(s));
    if (unknown.length)
      return fail(
        ['paradigms', t, 'subjects'],
        `${name}: unknown subjects ${unknown.join(', ')}`
      );
    if (table.tense !== 'have' && !table.verb)
      return fail(['paradigms', t], `${name}: needs a verb`);
    if (table.verb && !fixtures.verbs[table.verb])
      return fail(
        ['paradigms', t, 'verb'],
        `${name}: add ${table.verb}'s English forms under verbs:`
      );
    if (!table.verified) unverified.push(name);

    for (const polarity of POLARITIES) {
      const forms = table[polarity];
      if (forms.length !== subjects.length) {
        fail(
          ['paradigms', t, polarity],
          `${name} ${polarity}: ${forms.length} forms for ${subjects.length} subjects`
        );
        continue;
      }
      subjects.forEach((subject, i) => {
        const actual = conjugate(
          rules,
          pattern(subject, table.tense, polarity),
          fixtureVerb(fixtures, table.verb)
        ).sw;
        if (actual !== forms[i]) {
          const which = polarity === 'pos' ? 'positive' : 'negative';
          fail(
            ['paradigms', t, polarity, i],
            `${name} ${which} (${subject}): fixture says ${forms[i]}, rules give ${actual}`
          );
        }
      });
    }
  });

  fixtures.english.forEach((row, r) => {
    const verb = fixtureVerb(fixtures, row.verb);
    if (row.tense !== 'have' && !verb)
      return fail(['english', r], `needs a verb listed under verbs:`);
    if (!subjectIds.includes(row.subject))
      return fail(['english', r, 'subject'], `unknown subject ${row.subject}`);
    const actual = english(
      rules,
      pattern(row.subject, row.tense, row.polarity),
      verb
    );
    if (actual !== row.en)
      fail(
        ['english', r, 'en'],
        `fixture says "${row.en}", rules give "${actual}"`
      );
  });

  return { errors, unverified };
};

/**
 * Tenses whose fixture tables are all verified. Only these are offered in the app: a tense is
 * never taught until its forms have been checked against a grammar reference.
 */
export const verifiedTenses = (fixtures: NaniFixtures): NaniTense[] =>
  NANI_TENSES.filter((tense) => {
    const tables = fixtures.paradigms.filter((table) => table.tense === tense);
    return tables.length > 0 && tables.every((table) => table.verified);
  });
