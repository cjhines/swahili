// `npm run nani:forms`: regenerates decks/nani-na-lini/forms.md, every form Nani na Lini? can show
// (every verb card, every tense and subject, with English and the part breakdown), for review.
import { writeFileSync } from 'node:fs';

import { loadContent } from '../src/content/node/content.ts';
import { formatErrors } from '../src/content/validate.ts';
import { FORMS_PATH, renderForms } from '../src/nani/forms.ts';

const { decks, rules, fixtures, errors } = loadContent(process.cwd());
if (errors.length || !rules.data || !fixtures.data) {
  console.error(`✗ Fix these first:\n\n${formatErrors(errors)}\n`);
  process.exit(1);
}
writeFileSync(FORMS_PATH, renderForms(rules.data, fixtures.data, decks));
console.log(`✓ Wrote ${FORMS_PATH}`);
