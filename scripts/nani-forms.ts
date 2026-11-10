// `npm run nani:forms`: regenerates decks/nani-na-lini/forms.md, the human-readable table of
// every fixture form (with English and the part breakdown) for checking against grammar sheets.
import { writeFileSync } from 'node:fs';

import { loadNaniFixtures, loadNaniRules } from '../src/content/node/load.ts';
import { formatErrors } from '../src/content/validate.ts';
import { FORMS_PATH, renderForms } from '../src/nani/forms.ts';

const rules = loadNaniRules(process.cwd());
const fixtures = loadNaniFixtures(process.cwd());
if (!rules.data || !fixtures.data) {
  console.error(
    `✗ Fix these first:\n\n${formatErrors([...rules.errors, ...fixtures.errors])}\n`
  );
  process.exit(1);
}
writeFileSync(FORMS_PATH, renderForms(rules.data, fixtures.data));
console.log(`✓ Wrote ${FORMS_PATH}`);
