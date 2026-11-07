// `npm run decks:schema`: regenerates the JSON Schema that gives editors autocomplete and
// validation inside the deck YAML files.
import { writeFileSync } from 'node:fs';

import {
  SCHEMA_PATH,
  vocabDeckJsonSchemaText,
} from '../src/content/json-schema.ts';

writeFileSync(SCHEMA_PATH, vocabDeckJsonSchemaText());
console.log(`✓ Wrote ${SCHEMA_PATH}`);
