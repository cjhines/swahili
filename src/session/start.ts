import type { VocabDeck } from '../content/schema.ts';
import type { Direction } from '../domain.ts';
import {
  completeQueue,
  practiceQueue,
  reviewItems,
  type Random,
  type StateOf,
} from './queue.ts';
import { startSession } from './session.ts';
import type { VocabSetup } from './setup.ts';

/** Every card in the chosen decks, in the chosen direction. */
export const vocabItems = (
  decks: readonly VocabDeck[],
  deckIds: readonly string[],
  direction: Direction
) =>
  reviewItems(
    decks
      .filter((deck) => deckIds.includes(deck.id))
      .flatMap((deck) => deck.cards.map((card) => card.id)),
    direction
  );

export const buildVocabSession = (
  setup: VocabSetup,
  decks: readonly VocabDeck[],
  stateOf: StateOf,
  { now, random = Math.random }: { now: Date; random?: Random }
) => {
  const items = vocabItems(decks, setup.deckIds, setup.direction);
  const queue =
    setup.mode === 'practice'
      ? practiceQueue(items, stateOf, { now, newCap: setup.newCap, random })
      : completeQueue(items, random);
  return startSession(queue, { repeatMisses: setup.repeatMisses });
};
