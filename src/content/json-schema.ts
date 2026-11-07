import { z } from 'zod';

import { VocabDeckFile } from './schema.ts';

export const SCHEMA_PATH = 'schema/vocab-deck.schema.json';

// Draft-07 because that's what the YAML language server (VS Code's YAML extension) handles best.
export const vocabDeckJsonSchemaText = () =>
  `${JSON.stringify(
    {
      ...z.toJSONSchema(VocabDeckFile, { target: 'draft-07', io: 'input' }),
      title: 'Swahili vocabulary deck',
      description:
        'Generated from src/content/schema.ts by `npm run decks:schema`. Do not edit by hand.',
    },
    null,
    2
  )}\n`;
