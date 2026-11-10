# Swahili

Swahili flashcards with spaced repetition, at **https://cjhin.es/swahili/**.

- **Vocabulary:** themed decks, studied in either direction.
- **Nani na Lini?:** verb conjugations and have / don't have, using verbs from your vocabulary.

Progress stays in your browser. There are no accounts and no server.

> 🚧 Work in progress. See [PLAN.md](PLAN.md) for the design and milestones.

## Development

Requires Node 24.

```sh
npm install
npm run dev          # http://localhost:5173/swahili/
npm test             # unit tests (Vitest)
npm run lint
npm run typecheck
npm run build        # → dist/
npm run e2e          # smoke-tests the production build under /swahili/ (Playwright)
npm run decks:check  # validates decks/ (and the Nani na Lini? rules) exactly as CI does
npm run nani:forms   # regenerates decks/nani-na-lini/forms.md after changing rules or fixtures
```

To add cards, see [CONTRIBUTING.md](CONTRIBUTING.md).

The first time you run `npm run e2e`, install the browser with `npx playwright install chromium`.

## Deployment

Every push to `main` is checked, built and deployed to GitHub Pages
(`cjhines.github.io/swahili/`), and `cjhin.es/swahili/` proxies to it. See
[docs/deploy.md](docs/deploy.md).

## Licence

- Code: [MIT](LICENSE)
- Deck content (`decks/`): [CC BY-SA 4.0](decks/LICENSE)
