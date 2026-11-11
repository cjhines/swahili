import { z } from 'zod';

// The shape of a vocabulary deck file (decks/vocab/*.yaml). This is the single source of
// truth: the TypeScript types, the build-time validation and the editor's JSON Schema
// (schema/vocab-deck.schema.json, via `npm run decks:schema`) all come from here.

const text = (description: string) =>
  z
    .string()
    .regex(/^\S(.*\S)?$/s, 'must not be empty or start/end with a space')
    .describe(description);

const Example = z
  .strictObject({
    sw: text('The example sentence in Swahili.'),
    en: text('Its English translation.'),
  })
  .describe('An example sentence, shown on the answer side.');

const common = {
  sw: text('The Swahili word or phrase.'),
  alt: z
    .array(text('An alternative spelling or form.'))
    .min(1)
    .optional()
    .describe(
      'Other accepted Swahili forms, e.g. alfu moja for elfu moja. Shown on the answer side.'
    ),
  hint: text(
    'Shown on the front when going English → Swahili, to tell apart words with the same English, ' +
      'e.g. "(for someone)".'
  ).optional(),
  note: text('A short note shown on the answer side.').optional(),
};

const vocabId = z
  .string()
  .regex(
    /^vocab-[a-z0-9]+(-[a-z0-9]+)*$/,
    'must be "vocab-" plus lowercase letters, digits and hyphens, e.g. vocab-kumi-na-moja'
  )
  .describe(
    'Permanent ID. Progress is attached to it, so never rename or reuse one once published.'
  );

export const Noun = z.strictObject({
  id: vocabId,
  kind: z.literal('noun'),
  ...common,
  en: text('The English meaning.'),
  plural: text(
    'The plural form, even when it is the same as the singular.'
  ).optional(),
  example: Example.optional(),
});

export const Word = z.strictObject({
  id: vocabId,
  kind: z
    .literal('word')
    .describe(
      'Anything that is not a noun or a verb: numbers, adjectives, phrases…'
    ),
  ...common,
  en: text('The English meaning.'),
  example: Example.optional(),
});

/**
 * Placeholders an English template may use. Subject-dependent: be (am/is/are), have (have/has),
 * do (do/does), was (was/were), simple (the verb's base, or its `third` form after he/she/it).
 * From the verb: base, past, participle, ing.
 */
export const ENGLISH_PLACEHOLDERS = [
  'be',
  'have',
  'do',
  'was',
  'simple',
  'base',
  'past',
  'participle',
  'ing',
];

export const englishTemplate = (description: string) =>
  z
    .string()
    .refine(
      (text) =>
        [...text.matchAll(/\{(\w+)\}/g)].every(([, name]) =>
          ENGLISH_PLACEHOLDERS.includes(name!)
        ),
      `placeholders must be one of {${ENGLISH_PLACEHOLDERS.join('}, {')}}`
    )
    .describe(description);

const TenseEnglish = z.strictObject({
  pos: englishTemplate('e.g. can, {was} called, {have} been able to'),
  neg: englishTemplate("e.g. can't, {was}n't called"),
});

/** A verb's English: its forms, for Nani na Lini? sentences, and how Vocabulary shows it. */
export const VerbEnglish = z
  .strictObject({
    base: text(
      'e.g. read. Nani na Lini? builds its sentences from these four forms.'
    ),
    past: text('e.g. read, ate'),
    participle: text('e.g. read, eaten'),
    ing: text('e.g. reading, eating'),
    meaning: text(
      'What Vocabulary shows, when it is more than "to " + base: e.g. "to call / to shout". ' +
        'Nani na Lini? sentences use the base form ("We didn\'t call").'
    ).optional(),
    stative: z
      .literal(true)
      .optional()
      .describe(
        'The present is "I want" / "He/she wants", not "I am wanting". Needs `third`.'
      ),
    third: text(
      'The he/she form of the simple present: wants, knows.'
    ).optional(),
    tenses: z
      .strictObject({
        present: TenseEnglish.optional(),
        past: TenseEnglish.optional(),
        future: TenseEnglish.optional(),
        perfect: TenseEnglish.optional(),
      })
      .optional()
      .describe(
        'The verb\'s own English for particular tenses, e.g. kuweza: present { pos: can, neg: "can\'t" }.'
      ),
  })
  .refine((en) => !en.stative || en.third, {
    message: 'a stative verb needs `third`',
    path: ['third'],
  });
export type VerbEnglish = z.output<typeof VerbEnglish>;

export const Verb = z.strictObject({
  id: z
    .string()
    .regex(
      /^verb-k[uw][a-z]+(-[a-z0-9]+)*$/,
      'must be "verb-" plus the ku- form, lowercase, e.g. verb-kusoma'
    )
    .describe(
      'Permanent ID. Progress is attached to it, so never rename or reuse one once published.'
    ),
  kind: z.literal('verb'),
  ...common,
  sw: z
    .string()
    .regex(/^k[uw][a-z]+$/, 'must be the ku- form in lowercase, e.g. kusoma')
    .describe(
      'The ku- form, e.g. kusoma. Grammar quirks (kwenda keeping its kw-, kuwa never being ' +
        'conjugated) live in decks/nani-na-lini/rules.yaml, not here.'
    ),
  en: VerbEnglish,
  example: Example.optional(),
});

export const VocabCard = z.discriminatedUnion('kind', [Noun, Word, Verb], {
  error: 'kind must be noun, word or verb',
});

export const VocabDeckFile = z.strictObject({
  title: text('The deck name shown on the setup screen, e.g. "Time + dates".'),
  cards: z.array(VocabCard).min(1),
});

export type Noun = z.infer<typeof Noun>;
export type Word = z.infer<typeof Word>;
export type Verb = z.infer<typeof Verb>;
export type VocabCard = z.infer<typeof VocabCard>;
export type VocabDeckFile = z.infer<typeof VocabDeckFile>;

/** A validated deck. Its ID is its file name: decks/vocab/time-and-dates.yaml → time-and-dates. */
export type VocabDeck = VocabDeckFile & { id: string };
