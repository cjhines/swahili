// `npm run decks:check`: everything CI checks about decks/, runnable locally.
import { existsSync, readFileSync } from 'node:fs';

import { checkIds, LOCK_PATH } from '../src/content/ids.ts';
import {
  SCHEMA_PATH,
  vocabDeckJsonSchemaText,
} from '../src/content/json-schema.ts';
import { loadContent } from '../src/content/node/content.ts';
import { formatErrors } from '../src/content/validate.ts';
import { checkFixtures } from '../src/nani/fixtures.ts';
import { FORMS_PATH, renderForms } from '../src/nani/forms.ts';

const read = (path: string) =>
  existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : '';

const { decks, rules, fixtures, errors, ids } = loadContent(process.cwd());
const problems: string[] = [];
let unverified: string[] = [];

if (errors.length) {
  problems.push(formatErrors(errors));
} else {
  // Only meaningful once everything parses: a file that failed would look like deleted IDs.
  problems.push(...checkIds(ids, read(LOCK_PATH)));

  const result = checkFixtures(rules.data!, fixtures.data!, {
    path: fixtures.path,
    at: fixtures.at,
  });
  if (result.errors.length) problems.push(formatErrors(result.errors));
  unverified = result.unverified;

  if (read(FORMS_PATH) !== renderForms(rules.data!, fixtures.data!, decks)) {
    problems.push(
      `${FORMS_PATH} is out of date with the decks, rules.yaml or fixtures.yaml. Run \`npm run nani:forms\`.`
    );
  }
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
const tables = fixtures.data!.paradigms.length;
console.log(
  `✓ ${decks.length} decks, ${cards} cards: valid, IDs unique and locked, schema up to date.`
);
console.log(
  `✓ Nani na Lini?: ${ids.length - cards} patterns; all ${tables} fixture tables match the rules` +
    (unverified.length
      ? ` (${unverified.length} not yet checked against the grammar sheets).`
      : ', all checked.')
);
