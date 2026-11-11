import { z } from 'zod';

import { NANI_TENSES } from './patterns.ts';
import { englishTemplate, VerbEnglish } from '../content/schema.ts';

// Shapes of decks/nani-na-lini/rules.yaml and fixtures.yaml. Build-time only (full Zod): the
// app receives the validated rules as JSON through `virtual:nani`.

const Piece = z.string().regex(/^[a-z]+$/, 'lowercase letters only');
const VerbKu = z.string().regex(/^k[uw][a-z]+$/, 'a ku- form, e.g. kusoma');
const Label = z.string().min(1);

const Template = englishTemplate('An English sentence after the subject');

const Subject = z.strictObject({
  id: z.string().regex(/^[a-z]+$/),
  en: Label,
  be: z.enum(['am', 'is', 'are']),
  have: z.enum(['have', 'has']),
  do: z.enum(['do', 'does']),
  was: z.enum(['was', 'were']),
  pos: Piece,
  neg: z.array(Piece).min(1).max(2),
});

const Marker = z.strictObject({
  marker: Piece,
  label: Label,
  kept: z.enum(['keep', 'drop', 'merge']).default('keep'),
});

const TenseRule = z.strictObject({ pos: Marker, neg: Marker.nullable() });
const English = z.strictObject({ pos: Template, neg: Template });

export const NaniRules = z
  .strictObject({
    subjects: z.array(Subject).min(1),
    tenses: z.strictObject({
      present: TenseRule,
      past: TenseRule,
      future: TenseRule,
      perfect: TenseRule,
    }),
    presentNegativeEnding: z.strictObject({ ending: Piece, label: Label }),
    have: z.strictObject({ marker: Piece, label: Label }),
    labels: z.strictObject({ negative: Label, keptKu: Label }),
    english: z.strictObject({
      present: English,
      past: English,
      future: English,
      perfect: English,
      have: English,
      /** For stative verbs (want, know): "I want", not "I am wanting". */
      stativePresent: English,
    }),
    verbs: z
      .record(
        VerbKu,
        z.strictObject({
          keepKu: z.literal(true).optional(),
          exclude: z.literal(true).optional(),
          stem: Piece.optional(),
        })
      )
      .default({}),
  })
  .refine(
    (rules) =>
      new Set(rules.subjects.map((s) => s.id)).size === rules.subjects.length,
    {
      message: 'subject ids must be unique',
      path: ['subjects'],
    }
  );

export type NaniRules = z.output<typeof NaniRules>;
export type Subject = NaniRules['subjects'][number];

export const NaniFixtures = z.strictObject({
  /** English forms for every verb used below (deck verbs aren't needed: fixtures stand alone). */
  verbs: z.record(VerbKu, VerbEnglish),
  /** Known-correct forms, one table per verb and tense. Subjects in rules.yaml order. */
  paradigms: z.array(
    z.strictObject({
      verb: VerbKu.optional(), // absent for "have"
      tense: z.enum(NANI_TENSES),
      subjects: z.array(z.string()).min(1).optional(), // default: every subject
      pos: z.array(Piece),
      neg: z.array(Piece),
      verified: z.boolean(),
      note: z.string().optional(),
    })
  ),
  /** Known-correct English prompts. */
  english: z.array(
    z.strictObject({
      verb: VerbKu.optional(),
      subject: z.string(),
      tense: z.enum(NANI_TENSES),
      polarity: z.enum(['pos', 'neg']),
      en: Label,
    })
  ),
});
export type NaniFixtures = z.output<typeof NaniFixtures>;
