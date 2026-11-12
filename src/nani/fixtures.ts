import { conjugate, type NaniVerb } from './conjugate.ts';
import { english } from './english.ts';
import { pattern, POLARITIES } from './patterns.ts';
import type { NaniFixtures, NaniRules } from './schema.ts';
import type { VerbEnglish, VocabDeck } from '../content/schema.ts';
import type { DeckError, Key } from '../content/validate.ts';

// Proves rules.yaml against fixtures.yaml: every listed form must come out exactly.

/** A verb's English: from its card, or from fixtures.yaml for a verb with no card. */
export const fixtureEnglish = (
  fixtures: NaniFixtures,
  decks: readonly VocabDeck[]
) => {
  const fromCards = new Map<string, VerbEnglish>(
    decks
      .flatMap((deck) => deck.cards)
      .flatMap((card) => (card.kind === 'verb' ? [[card.sw, card.en]] : []))
  );
  return (sw: string | undefined): NaniVerb | undefined => {
    const en = sw && (fromCards.get(sw) ?? fixtures.verbs[sw]);
    return sw && en ? { sw, en } : undefined;
  };
};

export const checkFixtures = (
  rules: NaniRules,
  fixtures: NaniFixtures,
  decks: readonly VocabDeck[],
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
  const verbOf = fixtureEnglish(fixtures, decks);
  const subjectIds = rules.subjects.map((s) => s.id);
  const unverified: string[] = [];
  const seen = new Set<string>();

  const carded = new Set(
    decks.flatMap((deck) => deck.cards.map((card) => card.sw))
  );
  for (const sw of Object.keys(fixtures.verbs))
    if (carded.has(sw))
      fail(
        ['verbs', sw],
        `${sw} has a card, so it uses the card's English; remove it from verbs:`
      );

  fixtures.paradigms.forEach((table, t) => {
    const name = `${table.verb ?? 'have'} ${table.tense}`;
    if (seen.has(name))
      fail(
        ['paradigms', t],
        `${name}: there's already a table for this verb and tense; merge them`
      );
    seen.add(name);
    const subjects = table.subjects ?? subjectIds;
    const unknown = subjects.filter((s) => !subjectIds.includes(s));
    if (unknown.length)
      return fail(
        ['paradigms', t, 'subjects'],
        `${name}: unknown subjects ${unknown.join(', ')}`
      );
    if (table.tense !== 'have' && !table.verb)
      return fail(['paradigms', t], `${name}: needs a verb`);
    const verb = verbOf(table.verb);
    if (table.verb && !verb)
      return fail(
        ['paradigms', t, 'verb'],
        `${name}: ${table.verb} has no card; add its English under verbs:`
      );
    if (!table.verified) unverified.push(name);

    for (const polarity of POLARITIES) {
      const forms = table[polarity];
      if (!forms) continue; // a table may list only positive (or only negative) forms
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
          verb
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
    const verb = verbOf(row.verb);
    if (row.tense !== 'have' && !verb)
      return fail(
        ['english', r],
        `needs a verb with a card, or one under verbs:`
      );
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
