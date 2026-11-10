import type { NaniRules } from './schema.ts';

// A Nani na Lini? card is a pattern: subject + tense + positive/negative, e.g. "we + past +
// negative". The verb is chosen when the card is shown, so progress tracks the pattern.
// Zod-free on purpose: the app imports this, and full Zod must stay out of the bundle.

export const TENSES = ['present', 'past', 'future', 'perfect'] as const;
export type Tense = (typeof TENSES)[number];
export const NANI_TENSES = [...TENSES, 'have'] as const;
export type NaniTense = (typeof NANI_TENSES)[number];
export const POLARITIES = ['pos', 'neg'] as const;
export type Polarity = (typeof POLARITIES)[number];

export type Pattern = {
  id: string;
  subject: string;
  tense: NaniTense;
  polarity: Polarity;
};

/** e.g. nani-we-past-neg. These are card IDs: once published, never renamed (see ids.lock). */
export const patternId = (
  subject: string,
  tense: NaniTense,
  polarity: Polarity
) => `nani-${subject}-${tense}-${polarity}`;

/** Every pattern: subjects × (4 tenses + have) × positive/negative. 80 with 8 subjects. */
export const allPatterns = (rules: Pick<NaniRules, 'subjects'>): Pattern[] =>
  rules.subjects.flatMap((subject) =>
    NANI_TENSES.flatMap((tense) =>
      POLARITIES.map((polarity) => ({
        id: patternId(subject.id, tense, polarity),
        subject: subject.id,
        tense,
        polarity,
      }))
    )
  );
