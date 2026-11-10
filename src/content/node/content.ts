import { allPatterns } from '../../nani/patterns.ts';
import type { DeckError } from '../validate.ts';
import { parseDecks } from '../validate.ts';
import { loadDeckSources, loadNaniFixtures, loadNaniRules } from './load.ts';

/**
 * Everything under decks/, validated: vocabulary decks, the Nani na Lini? rules and fixtures,
 * and every card ID they define (deck cards plus the generated Nani patterns, which are cards
 * too and live in ids.lock alongside the rest).
 */
export const loadContent = (root: string) => {
  const { decks, errors: deckErrors } = parseDecks(loadDeckSources(root));
  const rules = loadNaniRules(root);
  const fixtures = loadNaniFixtures(root);
  const errors: DeckError[] = [
    ...deckErrors,
    ...rules.errors,
    ...fixtures.errors,
  ];

  const ids = [
    ...decks.flatMap((deck) => deck.cards.map((card) => card.id)),
    ...(rules.data ? allPatterns(rules.data).map((pattern) => pattern.id) : []),
  ];
  return { decks, rules, fixtures, errors, ids };
};
