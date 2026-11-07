import decks from 'virtual:decks';

// Placeholder until milestone 4 brings the real setup screen. It lists the decks so the live
// site shows that deck validation and bundling work end to end.
export const App = () => (
  <main className="placeholder">
    <h1>
      Karibu! <span lang="sw">Kadi za Kiswahili</span>
    </h1>
    <p>Swahili flashcards are on the way. Decks so far:</p>
    <ul className="deck-list">
      {decks.map((deck) => (
        <li key={deck.id}>
          {deck.title} <span>{deck.cards.length} cards</span>
        </li>
      ))}
    </ul>
  </main>
);
