// `npm run ids:update`: records new card IDs in decks/ids.lock. Never removes anything.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { LOCK_PATH, parseLock, updateLock } from '../src/content/ids.ts';
import { loadDeckSources } from '../src/content/node/load.ts';
import { formatErrors, parseDecks } from '../src/content/validate.ts';

const { decks, errors } = parseDecks(loadDeckSources(process.cwd()));
if (errors.length) {
  console.error(`✗ Fix the deck files first:\n\n${formatErrors(errors)}\n`);
  process.exit(1);
}

const before = existsSync(LOCK_PATH) ? readFileSync(LOCK_PATH, 'utf8') : '';
const after = updateLock(
  decks.flatMap((deck) => deck.cards.map((card) => card.id)),
  before
);
const added = parseLock(after).live.size - parseLock(before).live.size;
writeFileSync(LOCK_PATH, after);
console.log(
  added
    ? `✓ Added ${added} IDs to ${LOCK_PATH}.`
    : `✓ ${LOCK_PATH} already up to date.`
);
