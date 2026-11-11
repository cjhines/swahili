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
| `verb` | `id`, `sw` (the ku- form), `en.base`, `en.past`, `en.participle`, `en.ing` | `en.meaning`, `en.stative` + `en.third`, `en.tenses`, `example`, `alt`, `hint`, `note` |

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

  The four forms describe **one** meaning, the one Nani na Lini? sentences use ("We didn't
  call"). The optional fields cover verbs that don't fit that mould:

  - `meaning`: what Vocabulary shows, if it's more than "to" + base:
    `meaning: to call / to shout`.
  - `stative: true` and `third`: for verbs that don't take "-ing" in the present. Their present
    is "I want" / "He/she wants" / "I don't want", not "I am wanting":
    `{ base: want, …, stative: true, third: wants }`.
  - `tenses`: the verb's own English for any tense, for verbs nothing else fits. *Kuweza* uses
    `present: { pos: can, neg: "can't" }`. Placeholders: `{be}` am/is/are, `{have}` have/has,
    `{do}` do/does, `{was}` was/were, `{simple}` (base, or `third` after he/she/it), plus
    `{base}`, `{past}`, `{participle}`, `{ing}`. See *kuweza* and *kuitwa* in
    `decks/vocab/verbs.yaml`.

A verb can sit in any themed deck. Nani na Lini? picks up every `kind: verb` card wherever it is,
except those `rules.yaml` excludes (*kuwa*).

## Nani na Lini? grammar

Conjugations aren't written out card by card. They're built from
`decks/nani-na-lini/rules.yaml` (subjects, tense markers, negatives, the English templates, and
the quirks of particular verbs).

- **A verb behaves oddly**: add it under `verbs:` in `rules.yaml`. One-syllable verbs (*kula*,
  *kunywa*) are detected automatically. The quirks are:
  - `keepKu` for a verb that keeps its *ku-/kw-* anyway, like *kwenda*.
  - `exclude` to keep a verb out of Nani na Lini?: *kuwa*, whose present isn't am/is/are, and
    reciprocal *kuonana*.
  - `needsObject` for a verb that always takes a marker for who it's done to, like *kupa*
    (*nipe*, give me). It's excluded, and its card lists no kept-*ku-* forms.
- **A rule is wrong:** fix it in `rules.yaml`, then correct or add the affected forms in
  `fixtures.yaml`.
- **`fixtures.yaml`** holds known-correct forms, as tables per verb and tense. CI fails if the
  rules produce anything different. Set `verified: true` on a table once it has been checked
  against a grammar reference, and say which in its `note` (e.g. "Confirmed by Chris's tutor"). A
  table can list only `pos` or only `neg` when that's all a reference confirmed. A tense isn't
  offered in the app until all its tables are verified.
- **Verb cards show the stem and kept ku- forms automatically.** They come from `rules.yaml`, so
  don't type them into a card's `note`.
- **`forms.md`** is the readable version: every table with English and the parts (*ha·tu·ku·soma*).
  Regenerate it with `npm run nani:forms`; CI checks it's current.

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
- every ID is in `ids.lock` (Nani na Lini? patterns included), no published ID has disappeared,
  and no retired ID is back
- every form in `fixtures.yaml` comes out of `rules.yaml` exactly, and `forms.md` is current
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
