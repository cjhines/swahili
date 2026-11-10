// Provided at build time by src/content/node/vite-plugin.ts.
declare module 'virtual:decks' {
  const decks: import('./schema.ts').VocabDeck[];
  export default decks;
}

// Provided at build time by src/content/node/vite-plugin.ts: rules.yaml, validated.
declare module 'virtual:nani-rules' {
  const rules: import('../nani/schema.ts').NaniRules;
  export default rules;
}
