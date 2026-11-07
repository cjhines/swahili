# Contributing

## Adding cards

Vocabulary lives in themed decks, one YAML file each, in `decks/vocab/`. The file name is the
deck's ID (`time-and-dates.yaml`), and `title` is what the app shows.

```yaml
# yaml-language-server: $schema=../../schema/vocab-deck.schema.json
title: Time + dates
cards:
  - id: vocab-kesho
    kind: word
    sw: kesho
    en: tomorrow
```

In VS Code with the recommended YAML extension, the first line gives you autocomplete and inline
errors as you type.

### Card kinds

| `kind` | Required | Optional |
| --- | --- | --- |
| `word` (numbers, days, adjectives, phrases…) | `id`, `sw`, `en` | `alt`, `example`, `hint`, `note` |
| `noun` | `id`, `sw`, `en` | `plural`, `alt`, `example`, `hint`, `note` |
| `verb` | `id`, `sw` (the ku- form), `en.base`, `en.past`, `en.participle`, `en.ing`, `example` | `stem`, `nani`, `alt`, `hint`, `note` |

- `alt`: other accepted Swahili forms, e.g. `alt: [alfu moja]` for *elfu moja*.
- `hint`: shown on the front when going English → Swahili, to tell apart words with the same
  English, e.g. `hint: (for someone)`.
- `example`: `{ sw: Ninasoma kitabu., en: I am reading a book. }`
- Verbs need every English form because Nani na Lini? builds sentences like "We didn't eat"
  from them:

  ```yaml
  - id: verb-kula
    kind: verb
    sw: kula
    en: { base: eat, past: ate, participle: eaten, ing: eating }
    example: { sw: Ninakula wali., en: I am eating rice. }
  ```

A verb can sit in any themed deck. Nani na Lini? picks up every `kind: verb` card wherever it is.

## IDs: the one rule that matters

Progress is stored against card IDs, so **once an ID is published, never rename it and never
reuse it.** Renaming resets that card's progress for everyone.

- Format: `vocab-` plus the Swahili in lowercase with hyphens (`vocab-kumi-na-moja`), or
  `verb-` plus the ku- form (`verb-kusoma`). For words spelled the same, add the English:
  `vocab-kaa-crab`, `verb-kukaa-sit`.
- IDs must be unique across all decks.
- Moving a card to another deck file is fine. Progress belongs to the ID, not the deck.
- `decks/ids.lock` lists every ID ever published. After adding cards, run `npm run ids:update` to
  record their IDs, and commit the lock with them.
- To delete a card, keep its line in `ids.lock` and append `# retired`. That ID can then never
  be used again.

## Checking your changes

```sh
npm run decks:check
```

This runs exactly what CI runs on the decks. Every problem is reported as `file:line`:

- every file matches the schema, with no missing, misspelt or unexpected fields
- no ID appears twice
- every ID is in `ids.lock`, no published ID has disappeared, and no retired ID is back
- `schema/vocab-deck.schema.json` matches `src/content/schema.ts`. After changing the schema,
  run `npm run decks:schema`.

The build runs the same validation, so an invalid deck can't be deployed.

## Content licence

Deck content is [CC BY-SA 4.0](decks/LICENSE). Only add words, sentences or decks you wrote
yourself, or whose licence allows it. **Never copy from textbooks, courses or other people's Anki
decks** unless their licence permits it. Single word translations are fine. Example sentences
and curated lists are what to watch.

## Code

See the [README](README.md) for development commands. Relative imports always include their
extension (`'./schema.ts'`), and ESLint enforces it.
