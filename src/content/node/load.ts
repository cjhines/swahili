import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NaniFixtures, NaniRules } from '../../nani/schema.ts';
import { parseYaml, type DeckSource } from '../validate.ts';

export const VOCAB_DIR = 'decks/vocab';
export const NANI_DIR = 'decks/nani-na-lini';

/** Reads every decks/vocab/*.yaml file, sorted by name so output is stable. */
export const loadDeckSources = (root: string): DeckSource[] =>
  readdirSync(join(root, VOCAB_DIR))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => ({
      path: `${VOCAB_DIR}/${name}`,
      text: readFileSync(join(root, VOCAB_DIR, name), 'utf8'),
    }));

const read = (root: string, path: string): DeckSource => ({
  path,
  text: readFileSync(join(root, path), 'utf8'),
});

/** decks/nani-na-lini/rules.yaml, validated. */
export const loadNaniRules = (root: string) => {
  const source = read(root, `${NANI_DIR}/rules.yaml`);
  return { path: source.path, ...parseYaml(source, NaniRules) };
};

/** decks/nani-na-lini/fixtures.yaml, validated. */
export const loadNaniFixtures = (root: string) => {
  const source = read(root, `${NANI_DIR}/fixtures.yaml`);
  return { path: source.path, ...parseYaml(source, NaniFixtures) };
};
