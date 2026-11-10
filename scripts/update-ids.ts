// `npm run ids:update`: records new card IDs (deck cards and Nani na Lini? patterns) in
// decks/ids.lock. Never removes anything.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { LOCK_PATH, parseLock, updateLock } from '../src/content/ids.ts';
import { loadContent } from '../src/content/node/content.ts';
import { formatErrors } from '../src/content/validate.ts';

const { errors, ids } = loadContent(process.cwd());
if (errors.length) {
  console.error(`✗ Fix the content files first:\n\n${formatErrors(errors)}\n`);
  process.exit(1);
}

const before = existsSync(LOCK_PATH) ? readFileSync(LOCK_PATH, 'utf8') : '';
const after = updateLock(ids, before);
const added = parseLock(after).live.size - parseLock(before).live.size;
writeFileSync(LOCK_PATH, after);
console.log(
  added
    ? `✓ Added ${added} IDs to ${LOCK_PATH}.`
    : `✓ ${LOCK_PATH} already up to date.`
);
