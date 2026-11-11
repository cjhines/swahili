// Provided at build time by src/content/node/vite-plugin.ts.
declare module 'virtual:decks' {
  const decks: import('./schema.ts').VocabDeck[];
  export default decks;
}

// Provided at build time by src/content/node/vite-plugin.ts: rules.yaml, validated and proven
// against fixtures.yaml, plus the tenses whose fixture tables have all been verified.
declare module 'virtual:nani' {
  const nani: {
    rules: import('../nani/schema.ts').NaniRules;
    verifiedTenses: import('../nani/patterns.ts').NaniTense[];
  };
  export default nani;
}
