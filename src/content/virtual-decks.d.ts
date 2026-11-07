// Provided at build time by src/content/node/vite-plugin.ts.
declare module 'virtual:decks' {
  const decks: import('./schema.ts').VocabDeck[];
  export default decks;
}
