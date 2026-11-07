# Swahili Flashcards: v1 Plan

Nov 6, 2026. This plan replaces the original planning handover. Every place where it differs is
listed under [Changes from the handover](#changes-from-the-handover).

## What the app is

A flashcard PWA served at **https://cjhin.es/swahili/**, built from the public repo
`cjhines/swahili` and hosted on GitHub Pages. There is no backend, and progress lives in the
browser.

### Decks

There are two kinds of deck:

- **Vocabulary**: themed decks such as *Time + dates*, *Figures of speech* and *Verbs*. You tick
  which decks a session includes. Verbs are ordinary vocabulary cards: "to read" ↔ *kusoma*, with an
  example sentence on the answer side.
- **Nani na Lini?**: verb conjugation plus have / don't have. A card is a **pattern**, such as
  "we + past + negative". Each time a card is shown, the pattern is filled with a verb picked at
  random from your vocabulary, so one day you get "We didn't read" ↔ *hatukusoma* and the next
  "We didn't eat" ↔ *hatukula*. Progress is tracked per pattern, not per verb.

### A session

The setup screen remembers your last choices.

| Option | Vocabulary | Nani na Lini? |
| --- | --- | --- |
| What to include | Tick themed decks | Tick tenses: Present, Past, Future, Perfect, Have. Plus positive only / negative only / both. All 8 subjects are always included |
| Direction | Swahili → English, or English → Swahili | same |
| Mode | Practice or Complete deck | same |
| New cards per session | Practice only, default 10 | same |
| Repeat missed cards | On by default | same |

- **Practice** shows the cards that are due, most overdue first. Up to *N* new cards, picked at
  random, are mixed in among them. If nothing is due and there are no new cards, the app says so
  and offers a Complete deck run.
- **Complete deck** goes through every card in the selection, shuffled.
- **Marking:** you say the answer out loud, tap to flip, then press **Got it** or **Missed it**.
  On desktop: Space flips, → is Got it, ← is Missed it. On a phone you can also swipe right for
  Got it and left for Missed it. There's no typing.
- **Every mark counts towards scheduling, in both modes.** FSRS accounts for when you last saw the
  card, so extra Complete deck runs can't distort Practice.
- **Repeat missed cards:** a missed card goes back into the pile a few cards later, and the session
  ends only when every card has been got once.
- **Direction:** progress is tracked separately for each direction. Missing *kesho* → "tomorrow" a
  lot doesn't affect "tomorrow" → *kesho*.
- **Closing mid-session:** every mark is saved as soon as you make it. Practice simply picks up
  whatever is still due. An unfinished Complete deck run is offered as **Resume (30/80)** on the
  setup screen for up to 24 hours.

### What a card looks like

| Card | Front (Swahili → English) | Answer side |
| --- | --- | --- |
| Noun | *kitabu* | book · plural *vitabu* |
| Verb | *kusoma* | to read · *Ninasoma kitabu.* / I am reading a book. |
| Other word | *kesho* | tomorrow |
| Nani na Lini? | *hatukusoma* | We didn't read, then the breakdown below |

English → Swahili shows the same two sides the other way round.

A Nani na Lini? answer is broken into coloured parts, each with a plain-language label:

```
ha   · tu · ku   · soma
not    we   past   read
```

The colours come from a single theme file and should match Chris's grammar sheets. They're
placeholders until he sends his colours.

**Labels for ambiguous English subjects:** a short label is added only where English is
ambiguous, as in "You (plural) didn't read" and "They (things) didn't read". The label never shows
the prefix, because that would give the answer away.

---

## Repo layout

```
swahili/
├── .github/workflows/
│   ├── checks.yml            # reusable: lint, typecheck, test, deck checks, build, smoke test
│   ├── ci.yml                # pull requests → checks.yml
│   └── deploy.yml            # push to main → checks.yml → GitHub Pages
├── decks/
│   ├── LICENSE               # CC BY-SA 4.0
│   ├── ids.lock              # every ID ever published (see "ID rules")
│   ├── vocab/                # one file per themed deck
│   │   ├── numbers.yaml
│   │   └── time-and-dates.yaml
│   └── nani-na-lini/
│       ├── rules.yaml        # subjects, tenses, negatives, have, English templates, labels
│       └── fixtures.yaml     # known-correct forms that Chris checks against his sheets
├── schema/
│   └── vocab-deck.schema.json   # generated from Zod; gives editor autocomplete in the YAML
├── scripts/
│   ├── check-decks.ts        # schema + duplicates + ids.lock + Nani fixtures
│   └── update-ids.ts         # appends new IDs to ids.lock
├── src/
│   ├── main.tsx
│   ├── App.tsx               # boot: opens the progress store, then <Study>
│   ├── Study.tsx             # screen state machine (setup → session → end); no router
│   ├── domain.ts             # Direction, Grade, Mode, ProgressKey
│   ├── screens/              # SetupScreen, SessionScreen, EndScreen; Settings (export/import) in M5
│   ├── components/           # Flashcard (tap + swipe), Choice (segmented radios)
│   ├── ui/format.ts          # "in 3 hours", plurals
│   ├── content/
│   │   ├── schema.ts         # Zod schemas, the source of truth for deck shape
│   │   ├── validate.ts       # parse + validate, with file:line errors; no fs, so shared by all callers
│   │   ├── ids.ts            # ids.lock rules
│   │   ├── json-schema.ts    # Zod → the editor's JSON Schema
│   │   └── node/             # Node-only (separate tsconfig)
│   │       ├── load.ts       # reads decks/vocab/*.yaml
│   │       └── vite-plugin.ts    # `import decks from 'virtual:decks'`
│   ├── nani/
│   │   ├── patterns.ts       # enumerates the 80 patterns and their IDs
│   │   ├── conjugate.ts      # pure: (verb, pattern) → { sw, parts }
│   │   └── english.ts        # pure: (verb, pattern) → "We didn't read"
│   ├── scheduler/
│   │   └── scheduler.ts      # pure FSRS wrapper
│   ├── session/
│   │   ├── queue.ts          # pure: builds Practice / Complete deck queues
│   │   └── session.ts        # pure reducer: flip, mark, requeue
│   ├── storage/
│   │   ├── db.ts             # IndexedDB `swahili`
│   │   ├── progress.ts
│   │   └── backup.ts         # export, import (merge / replace)
│   └── styles/
│       └── theme.css         # colours for each part role, as CSS custom properties
├── e2e/
│   └── smoke.spec.ts         # Playwright against `vite preview` under /swahili/
├── docs/
│   └── deploy.md             # nginx config and Pages settings
├── public/                   # icons, robots.txt
├── LICENSE                   # MIT
├── CONTRIBUTING.md
└── README.md
```

## Tooling

| Tool | Why |
| --- | --- |
| **React 19 + Vite 8 + TypeScript 6 (strict)** | Same stack as cjhin.es, so config and habits carry over |
| **No router** | Four screens held as app state. Pages has no rewrites, so this avoids 404 fallbacks entirely |
| **ESLint 9 (flat) + Prettier** | Copied from cjhin.es (universe + typescript-eslint). One difference: relative imports always carry their extension (`'./schema.ts'`), which Vite's upcoming native config loader requires |
| **Plain CSS + custom properties** | The app is small. Part colours live in `theme.css` |
| **`yaml`** (eemeli) | Follows YAML 1.2, so `en: no` stays a string rather than becoming `false` |
| **Zod 4** | One source for validation, TS types (`z.infer`) and the editor's JSON Schema (`z.toJSONSchema`). Full Zod for the build-time deck schema; **`zod/mini`** in anything the app ships (localStorage, backups), which cut it from 83 kB to 22 kB of the bundle |
| **ts-fsrs v6 (FSRS-7 model)** | FSRS, the scheduler modern Anki uses, with short-term (same-day) reviews built in |
| **`idb`** | Tiny promise wrapper. Access is just "load everything, put one", so Dexie's query layer isn't needed |
| **vite-plugin-pwa** (Workbox `generateSW`) | Manifest, precaching and update flow, scoped to `/swahili/` |
| **Vitest + Testing Library + `fake-indexeddb`** | Unit tests for the scheduler, queue, conjugation and storage, plus component tests |
| **Playwright** (Chromium only) | One smoke test of the built app under `/swahili/`, to catch base-path bugs that only appear in a build |
| **`tsx`** | Runs the two scripts in `scripts/` without a separate build |
| **Node 24** | Matches the local machine; pinned in `.nvmrc` and CI |

## Deck files

### Vocabulary deck

The file name is the deck ID, e.g. `decks/vocab/time-and-dates.yaml` → `time-and-dates`.

```yaml
# yaml-language-server: $schema=../../schema/vocab-deck.schema.json
title: Time + dates
cards:
  - id: vocab-kesho
    kind: word
    sw: kesho
    en: tomorrow

  - id: vocab-saa
    kind: noun
    sw: saa
    en: hour, clock
    plural: saa
    note: same in the plural

  - id: verb-kusubiri
    kind: verb
    sw: kusubiri
    en: { base: wait, past: waited, participle: waited, ing: waiting }
    example: { sw: Ninakusubiri., en: I am waiting for you. }
```

Card kinds, with required fields in **bold**:

| `kind` | Fields |
| --- | --- |
| `noun` | **`id`, `sw`, `en`**, `plural`, `alt`, `example`, `hint`, `note` |
| `verb` | **`id`, `sw` (ku- form), `en.base`, `en.past`, `en.participle`, `en.ing`, `example`**, `stem`, `nani`, `alt`, `hint`, `note` |
| `word` | **`id`, `sw`, `en`**, `alt`, `example`, `hint`, `note` (numbers, days, adjectives, adverbs, phrases, figures of speech) |

- `alt` lists other accepted Swahili forms, such as `alt: [alfu moja]` for *elfu moja*. They're
  shown on the answer side.
- Every object is strict, so a misspelt field (`plurl:`) is an error, not silently ignored.

- `hint` is shown on the **front** to tell apart words with the same English, e.g.
  `hint: (for someone)`.
- `stem` is normally derived from `sw` (`kusoma` → `soma`, `kwenda` → `enda`, `kula` → `la`).
  Set it only to override that.
- `nani` holds per-verb overrides for Nani na Lini?, e.g. `nani: { exclude: true }` for *kuwa*.
- Claude writes every English verb form, so nobody has to fill them in by hand. CI rejects any
  verb that's missing one.
- A verb can sit in a themed deck (e.g. *kula* in *Food*). Nani na Lini? draws from every
  `kind: verb` card in every deck.

### Nani na Lini? rules

`rules.yaml` holds all the grammar as data, so a fix is an edit to a data file, not a code change:

```yaml
subjects:
  - { id: i,      en: I,              be: am,  have: have, do: do,   pos: ni, neg: si }
  - { id: you,    en: you,            be: are, have: have, do: do,   pos: u,  neg: hu }
  - { id: heshe,  en: he/she,         be: is,  have: has,  do: does, pos: a,  neg: ha }
  - { id: we,     en: we,             be: are, have: have, do: do,   pos: tu, neg: hatu }
  - { id: youpl,  en: you (plural),   be: are, have: have, do: do,   pos: m,  neg: ham }
  - { id: they,   en: they,           be: are, have: have, do: do,   pos: wa, neg: hawa }
  - { id: it,     en: it,             be: is,  have: has,  do: does, pos: i,  neg: hai }
  - { id: things, en: they (things),  be: are, have: have, do: do,   pos: zi, neg: hazi }

tenses:
  present: { pos: na, neg: ~,  negEnding: i, label: now }
  past:    { pos: li, neg: ku, label: past }
  future:  { pos: ta, neg: ta, label: future }
  perfect: { pos: me, neg: ja, label: done }

english:
  present: { pos: "{be} {ing}",      neg: "{be} not {ing}" }
  past:    { pos: "{past}",          neg: "didn't {base}" }
  future:  { pos: "will {base}",     neg: "won't {base}" }
  perfect: { pos: "{have} {participle}", neg: "{have}n't {participle} yet" }
  have:    { pos: "{have}",          neg: "{do}n't have" }
```

The rules the engine applies, each covered by fixtures:

- **Positive:** subject + tense + stem, e.g. *tu·li·soma*.
- **Negative:** negative subject + tense + stem, e.g. *ha·tu·ku·soma*. The present negative has
  no tense marker, and a final *-a* becomes *-i* (*si·som·i*). Stems that don't end in *-a* keep
  their ending (*sijibu*).
- **One-syllable verbs** (detected by counting vowels in the stem, overridable per verb) keep
  *ku-* in the positive tenses and the future negative (*ninakula*, *sitakula*), and drop it in
  the present, past and perfect negatives (*sili*, *sikula*, *sijala*).
- **Have / don't have:** subject + *na*, or negative subject + *na* (*tuna* / *hatuna*,
  *zina* / *hazina*).
- **English present is always progressive** ("We are reading"). That way "We read" only ever means
  past, even for verbs like *read* whose past is spelled the same.

**Pattern IDs** are built from their parts: `nani-<subject>-<tense>-<pos|neg>`, e.g.
`nani-we-past-neg` or `nani-things-have-pos`. That's 8 × 4 × 2 + 8 × 2 = **80 patterns**.

**Fixtures** list known-correct forms:

```yaml
- { verb: kusoma, subject: we, tense: past,    polarity: neg, sw: hatukusoma, verified: false }
- { verb: kula,   subject: i,  tense: present, polarity: pos, sw: ninakula,   verified: false }
- { verb: kula,   subject: i,  tense: present, polarity: neg, sw: sili,       verified: false }
```

CI fails if the engine disagrees with **any** fixture, verified or not. Claude writes the fixtures,
and Chris flips `verified: true` once he has checked each one against his sheets. A tense doesn't
ship in the app until all of its fixtures are verified.

### ID rules, enforced by `npm run decks:check` in CI

- IDs use only `[a-z0-9-]` and are unique across all decks and all Nani patterns.
- Prefixes: `vocab-` for nouns and words, `verb-` for verbs, `nani-` for patterns. Homonyms get an
  English suffix: `vocab-kaa-crab`, `verb-kukaa-sit`.
- `decks/ids.lock` lists every ID ever published, one per line. Retired ones end in `# retired`.
  - A current ID that isn't in the lock fails the check. Run `npm run ids:update` to add it.
  - An unretired lock ID with no matching card fails the check. This catches accidental renames,
    which would silently reset progress.
  - A retired ID that reappears fails the check. Old progress would attach to a new card.
- Moving a card between deck files is fine, because progress belongs to the ID, not the deck.

### How decks reach the app

`src/content/node/vite-plugin.ts` reads `decks/vocab/*.yaml` and runs `validate.ts`. It serves the result as the
virtual module `virtual:decks`. Dev and build therefore go through the same validation, and editing
a YAML file hot-reloads it. A bad deck fails `vite build` with the file name and YAML line number.

---

## Progress storage

### The scheduler: pure, no I/O

```ts
// src/domain.ts
type Grade = 'got' | 'missed';                 // → Rating.Good / Rating.Again
type Direction = 'sw-en' | 'en-sw';
type ProgressKey = `${string}:${Direction}`;   // e.g. 'vocab-kesho:sw-en', 'nani-we-past-neg:en-sw'

// src/scheduler/scheduler.ts
createScheduler({ fuzz = true }): Promise<Scheduler>   // async: ts-fsrs v6 loads its model lazily
scheduler.review(key, state: MemoryState | undefined, grade, now): { state: MemoryState; log: ReviewLog }
isNew(state)            // no state = new in that direction
isDue(state, now)       // has state and dueAt <= now
```

- This uses **ts-fsrs v6** with the **FSRS-7** model, which the scheduler pins explicitly. Stored
  memory state is model-specific (FSRS-7 adds `stabilityFast`), so a silent model change on a
  library upgrade would misread it.
- Fuzz is on (it's off by default in v6), so cards learned together spread over neighbouring days.
  Target retention is 0.9.
- A new card's ts-fsrs `cardId` is set to its progress key, so every review log carries it.
- FSRS-7 sets short-term intervals itself. A first "Got it" on a new card schedules it days out,
  and a first "Missed it" brings it back within minutes.
- **Same-day repeats** (from repeat-missed-cards) go through the same function. One relearning
  episode counts **one lapse**, however many misses, but **each miss lowers stability**, so a card
  missed repeatedly comes back sooner. That's the intended behaviour: what you keep missing, you
  see more.
- Early reviews (Complete deck mode) still lengthen the interval, just by less than an on-time
  review.
- ts-fsrs v6 field names are camelCase (`dueAt`, `lastReviewAt`, `scheduledDays`). Its validation
  rejects date **strings**, so anything that round-trips through JSON, like a backup file, has to
  turn dates back into `Date` objects first. IndexedDB's structured clone keeps them as Dates.

### IndexedDB: database `swahili`, version 1

| Store | Key | Value |
| --- | --- | --- |
| `progress` | `key` (`cardId:direction`) | `{ key, cardId, direction, state: <ts-fsrs memory state, as-is>, updatedAt }` |
| `reviews` | `id` = `${key}@${reviewedAt ISO}` | `{ id, key, grade, mode, reviewedAt, log: <ts-fsrs ReviewLog> }`, indexed by `key` |
| `meta` | `name` | `schemaVersion`, `firstLaunchAt`, `persistGranted`, `lastExportAt` |

- **Loading:** at startup, `getAll('progress')` goes into a `Map`. Even a few thousand records is
  trivial, so no query indexes are needed.
- **Marking a card:** `ProgressStore.mark()` calls `review()`, then one transaction that puts the
  `progress` record and adds a `reviews` row. This happens immediately on every mark. Marks are
  queued, so two quick taps apply in order, each from the state the previous one produced. Memory
  is updated only after the write commits.
- **Joining:** a card with no record is new. A record whose card no longer exists is an
  **orphan**. Orphans are kept, ignored, and never deleted automatically.
- The review log isn't shown anywhere in v1. It's kept so stats can come later.

### localStorage, all keys prefixed `swahili:`

- `swahili:setup`: the last setup-screen choices, one set per deck kind.
- `swahili:resume`: an unfinished Complete deck run, holding the queue (card IDs, plus the chosen
  verb for Nani na Lini?), the position, `startedAt` and `savedAt`. It's deleted 24 hours after the
  **last mark** (not the start), or if any card in it no longer exists. It always resumes on the
  front of the card.
- `swahili:installNudgeDismissedAt`

### Session logic: pure, in `session/`

- **Practice queue:** due items sorted by `dueAt` ascending, plus `newCap` new items picked at
  random and inserted at random positions. `practiceSummary()` gives the due and new counts and the
  next due date, for the setup screen and the "nothing due" message.
- **Session state** is a pure reducer (`flip`, `mark`) over plain JSON-serialisable data, so a
  Complete deck run can be saved and resumed. Saving each mark is the caller's job.
- **Complete deck queue:** every item in the selection, shuffled.
- **Nani na Lini?:** the verb is chosen per card from eligible verbs, never the same verb twice in a
  row. A verb is eligible if it has a `progress` record in either direction. If fewer than 5 are
  eligible, every verb is used. Verbs with `nani.exclude` are always left out.
- **Missed card with repeat on:** the card is reinserted 3–5 cards later, or at the end if fewer
  remain.

### Backup: Settings screen

- **Export** downloads `swahili-progress-YYYY-MM-DD.json`, containing
  `{ app: 'swahili', format: 1, exportedAt, progress[], reviews[] }`.
- **Import (merge)** is the default. For each key it keeps whichever record has the later
  `state.lastReviewAt`, and takes the union of `reviews` by `id`. Dates in the file are turned
  back into `Date` objects before anything else (see above).
- **Replace** is a separate button with a confirmation. It clears both stores and loads the file
  in one transaction.
- The file is validated with Zod before anything is written.
- The Settings screen shows "Last exported N days ago" and whether persistent storage was granted.

## PWA and same-origin rules

**Why the PWA, `persist()` and export/import all ship in v1:** Safari deletes all script-writable
storage for a site (IndexedDB, localStorage) after seven days of Safari use without a visit to that
site. A week off flashcards would wipe your progress. Home-screen web apps have their own counter,
and in practice it never runs out
([source](https://www.itnews.com.au/news/apple-cops-flak-for-deleting-local-browser-storage-after-7-days-539833)).
So the app nudges you to install it to the home screen, asks for persistent storage, and offers a
backup file as the last line of defence.

The app shares the `https://cjhin.es` origin with the main site, so everything below is scoped to
`/swahili/`:

- `base: '/swahili/'`. The manifest has `start_url` and `scope` set to `/swahili/`. The service
  worker is served at `/swahili/sw.js` and registered with `scope: '/swahili/'`. Workbox's
  `navigateFallbackAllowlist` is `[/^\/swahili\//]`.
- **Updates:** `registerType: 'prompt'`. A waiting update is applied only from the setup screen,
  never during a session.
- `navigator.storage.persist()` is called on first launch, and the result is recorded in `meta`.
- **iPhone install nudge:** a banner on the setup screen, shown in iOS Safari when the app isn't
  running from the home screen. It can be dismissed for 30 days.
- The app sets no cookies. `index.html` has
  `<link rel="canonical" href="https://cjhin.es/swahili/">`.
- **Android back button:** starting a session pushes a history entry, so Back returns to setup
  instead of leaving the app.

## Hosting

```text
Deploy:  push to main → GitHub Actions → https://cjhines.github.io/swahili/
Serve:   https://cjhin.es/swahili/ → nginx on yapping.cjhin.es → https://cjhines.github.io/swahili/
```

What I checked:

- The server runs **nginx 1.24**.
- `cjhines.github.io` no longer has Pages or a `CNAME`, so the user-site custom-domain problem
  doesn't apply.
- The main site registers no service worker and uses no browser storage.

The repo's Pages custom domain stays **empty**. If the `cjhines.github.io` user site is ever
brought back, it must not have a custom domain either. GitHub applies a user site's custom domain
to all of that account's project sites
([source](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)),
which would break the proxy.

### nginx: to add to `/etc/nginx/sites-available/cjhin.es`, in the 443 server block

```nginx
# Without this, /swahili falls through to the main site's SPA fallback and renders the homepage.
location = /swahili { return 301 /swahili/; }

# ^~ so a future regex location can never capture /swahili/ assets.
location ^~ /swahili/ {
    resolver 127.0.0.53 valid=300s;         # re-resolve GitHub's IPs instead of pinning them at startup
    set $pages cjhines.github.io;
    proxy_pass https://$pages;              # variable + no URI → the /swahili/... path passes through unchanged
    proxy_set_header Host cjhines.github.io;
    proxy_ssl_server_name on;
    proxy_ssl_name cjhines.github.io;
    proxy_ssl_verify on;                    # nginx does NOT verify upstream certs by default
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_redirect https://cjhines.github.io/swahili/ /swahili/;
}
```

- This is a live production change, so it follows `infra/CLAUDE.md`. That means `nginx -t` before
  reloading, and an `infra/CHANGELOG.md` entry. Chris approves it at the time it's made.
- certbot's nginx installer rewrites this vhost on renewal; the next one is around 2026-12-13. Check
  `git -C /etc log` afterwards.
- After deploying, use `curl -I` to check that the main site's security headers (HSTS,
  X-Frame-Options, nosniff) aren't duplicated by GitHub's headers.
- If GitHub Pages is down, the installed app keeps working from the service worker cache.

`docs/deploy.md` keeps a copy of this block and the Pages settings.

## CI/CD

**`checks.yml`** (reusable via `workflow_call`) runs on `ubuntu-latest` with Node 24 and npm
caching:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test` (Vitest)
5. `npm run decks:check` (schema, duplicates, `ids.lock`, Nani fixtures, and a list of unverified fixtures)
6. `npm run build`
7. `npx playwright install --with-deps chromium && npm run e2e`. This runs against `vite preview` and loads
   `/swahili/`, checks that every asset returns 200 and the service worker registers, then flips and
   marks one card.
8. Uploads `dist/` as an artifact.

**`ci.yml`** runs `checks.yml` on every pull request.

**`deploy.yml`** runs on push to `main` and on `workflow_dispatch`:

- Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`, with
  in-progress runs not cancelled.
- It calls `checks.yml`, then `actions/upload-pages-artifact`, then `actions/deploy-pages` in the
  `github-pages` environment.
- After deploying, a final step uses `curl` to check that both `https://cjhines.github.io/swahili/`
  and `https://cjhin.es/swahili/` return 200 with the new build's asset hash. The step is
  non-blocking and reports a warning on failure, since the proxy isn't part of the deploy.

The repo's Pages source is set to **GitHub Actions**. There's no `gh-pages` branch.

## Licensing and contributing

- `LICENSE`: MIT, for the code.
- `decks/LICENSE`: CC BY-SA 4.0, for deck content. This leaves Wiktionary open as a future source.
- The v1 content is Chris's own paper decks, which are his own work.
- `CONTRIBUTING.md` covers: how to add a card, the ID rules and `ids.lock`, `npm run decks:check`,
  and the rule against copying from textbooks or courses unless their licence allows it.

---

## Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| 1 | **Skeleton:** Vite/React/TS, lint, Vitest, Playwright, the three workflows, a placeholder page, licences, `docs/deploy.md`, nginx proxy | The placeholder is live at both URLs, `/swahili` redirects, and CI is green. *Needs Chris's OK to create the public repo and to change nginx* |
| 2 | **Decks:** Zod schema, `validate.ts`, Vite plugin, `decks:check`, `ids.lock`, JSON Schema, `CONTRIBUTING.md`, Chris's paper vocab and verbs transcribed | CI rejects a duplicate ID, a missing field, a renamed ID and a verb with no English forms (each covered by a test) |
| 3 | **Scheduler and storage:** `scheduler.ts`, `db.ts`, `progress.ts`, `queue.ts`, `session.ts` | Unit tests cover new, due, overdue, miss/requeue, direction separation and orphans, with no UI |
| 4 | **Vocabulary sessions:** setup, card and end screens, keyboard, swipe, resume | **The first usable review session.** Chris completes a Practice run and a Complete deck run on his phone |
| 5 | **Safari protection:** PWA, `persist()`, install nudge, export/import (merge/replace), update-on-setup-screen | Installed to the home screen, works offline, and an export → wipe → import round trip restores everything |
| 6 | **Nani na Lini? rules:** `rules.yaml`, `conjugate.ts`, `english.ts`, fixtures, part breakdown | All fixtures pass. Chris has verified them for at least the present and past tenses |
| 7 | **Nani na Lini? sessions:** tense / polarity setup, verb selection, coloured breakdown | Chris completes a Practice run of past negatives on his phone |

Milestone 5 comes straight after 4, so Chris never studies on an iPhone without the Safari
protections in place.

## Out of scope for v1

- Accounts, login, or any server-side storage.
- Syncing progress across devices. Export/import covers moving progress by hand. Later options are a
  small endpoint on Chris's server, or Firebase.
- Typed answers.
- A stats screen. The review log is stored so one can be added later.
- Noun classes other than *i/zi* in Nani na Lini?.
- Moving the main cjhin.es site to GitHub Pages.

## Changes from the handover

- **Two deck kinds, not three.** Verbs are vocabulary cards, and Nani na Lini? replaces the
  "conjugation" deck.
- **Conjugation progress is per pattern, not per verb.** IDs change from `conj-soma-1sg-na` to
  `nani-i-present-pos`, and the verb is chosen when the card is shown.
- **The progress key is `cardId:direction`.** Both directions are supported for every deck and
  chosen per session.
- **Two-button grading** (Got it / Missed it), mapped to FSRS Good / Again, instead of four.
- **Subjects include *i* and *zi*,** so there are 8 subjects and 80 patterns.
- **Decks are YAML** compiled at build time, not hand-written JSON.
- **`idb` was chosen over Dexie,** and **React** was chosen as the framework.
- **Caddy config dropped.** The server runs nginx, and the snippet gained `^~`, the `/swahili`
  redirect, a re-resolving `resolver`, `proxy_redirect` and upstream certificate verification.
- **`ids.lock`** was added so that the never-rename / never-reuse rule is enforced, not just
  documented.

## Still needed from Chris

1. **Photos of the paper vocab and verb cards**, for milestone 2.
2. **The colours on the grammar sheets** for subject, negative, tense, stem and ending. Any time;
   placeholders are used until then.
3. **Fixture verification**, in milestone 6.
4. **Approvals at the time:** creating the public `cjhines/swahili` repo, and the nginx change.
