import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DeckSource } from '../validate.ts';

export const VOCAB_DIR = 'decks/vocab';

/** Reads every decks/vocab/*.yaml file, sorted by name so output is stable. */
export const loadDeckSources = (root: string): DeckSource[] =>
  readdirSync(join(root, VOCAB_DIR))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => ({
      path: `${VOCAB_DIR}/${name}`,
      text: readFileSync(join(root, VOCAB_DIR, name), 'utf8'),
    }));
