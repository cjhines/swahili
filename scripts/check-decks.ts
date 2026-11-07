// `npm run decks:check`: everything CI checks about the deck files, runnable locally.
import { existsSync, readFileSync } from 'node:fs';

import { checkIds, LOCK_PATH } from '../src/content/ids.ts';
import {
  SCHEMA_PATH,
  vocabDeckJsonSchemaText,
} from '../src/content/json-schema.ts';
import { loadDeckSources } from '../src/content/node/load.ts';
import { formatErrors, parseDecks } from '../src/content/validate.ts';

const read = (path: string) =>
  existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : '';

const { decks, errors } = parseDecks(loadDeckSources(process.cwd()));
const problems: string[] = [];

if (errors.length) {
  problems.push(formatErrors(errors));
} else {
  // Only meaningful once every deck parses: a deck that failed would look like deleted IDs.
  problems.push(
    ...checkIds(
      decks.flatMap((deck) => deck.cards.map((card) => card.id)),
      read(LOCK_PATH)
    )
  );
}

if (read(SCHEMA_PATH) !== vocabDeckJsonSchemaText()) {
  problems.push(
    `${SCHEMA_PATH} is out of date with src/content/schema.ts. Run \`npm run decks:schema\`.`
  );
}

if (problems.length) {
  console.error(`✗ Deck check failed:\n\n${problems.join('\n')}\n`);
  process.exit(1);
}

const cards = decks.reduce((sum, deck) => sum + deck.cards.length, 0);
console.log(
  `✓ ${decks.length} decks, ${cards} cards: valid, IDs unique and locked, schema up to date.`
);
