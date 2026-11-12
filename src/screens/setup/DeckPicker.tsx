import { toggle } from './options.ts';
import type { VocabDeck } from '../../content/schema.ts';
import { plural } from '../../ui/format.ts';

type Props = {
  decks: readonly VocabDeck[];
  chosen: readonly string[];
  onChange: (deckIds: string[]) => void;
};

/** The vocabulary decks, each with a checkbox, plus All / None. */
export const DeckPicker = ({ decks, chosen, onChange }: Props) => {
  const all = chosen.length === decks.length;
  return (
    <fieldset className="decks">
      <legend className="section-label">
        Decks
        <button
          type="button"
          className="link-btn"
          onClick={() => onChange(all ? [] : decks.map((deck) => deck.id))}
        >
          {all ? 'None' : 'All'}
        </button>
      </legend>
      <ul>
        {decks.map((deck) => (
          <li key={deck.id}>
            <label className="deck-row">
              <input
                type="checkbox"
                checked={chosen.includes(deck.id)}
                onChange={() => onChange(toggle(chosen, deck.id))}
              />
              <span className="deck-title">{deck.title}</span>
              <span className="muted">{plural(deck.cards.length, 'card')}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
};
