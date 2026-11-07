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
    .describe('The ku- form, e.g. kusoma.'),
  stem: z
    .string()
    .regex(/^[a-z]+$/)
    .optional()
    .describe(
      'Only if it cannot be derived by dropping ku-/kw- (kusoma → soma, kwenda → enda).'
    ),
  en: z
    .strictObject({
      base: text('e.g. read (shown as "to read")'),
      past: text('e.g. read, ate'),
      participle: text('e.g. read, eaten'),
      ing: text('e.g. reading, eating'),
    })
    .describe(
      'Every English form, needed to build Nani na Lini? prompts like "We didn\'t eat".'
    ),
  example: Example,
  nani: z
    .strictObject({
      exclude: z
        .literal(true)
        .optional()
        .describe('Never use this verb in Nani na Lini?, e.g. kuwa.'),
    })
    .optional()
    .describe('Nani na Lini? overrides for this verb.'),
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
