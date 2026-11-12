import { loadContent } from './content.ts';
import { naniVerbs } from '../../session/start.ts';
import type { Verb, VocabCard } from '../schema.ts';

/**
 * The real decks, rules.yaml and fixtures.yaml, for tests that check the content itself.
 * Throws if anything fails to parse: `npm run decks:check` says why.
 */
export const realContent = () => {
  const { decks, rules, fixtures, errors } = loadContent(process.cwd());
  if (errors.length || !rules.data || !fixtures.data)
    throw new Error('decks/ has errors: run npm run decks:check');
  const cards = decks.flatMap((deck) => deck.cards);
  const card = (id: string): VocabCard => {
    const found = cards.find((c) => c.id === id);
    if (!found) throw new Error(`no card ${id}`);
    return found;
  };
  const verb = (sw: string): Verb => {
    const found = cards.find(
      (c): c is Verb => c.kind === 'verb' && c.sw === sw
    );
    if (!found) throw new Error(`no verb card ${sw}`);
    return found;
  };
  return {
    decks,
    rules: rules.data,
    fixtures: fixtures.data,
    /** For reporting fixture errors with file:line. */
    fixturesFile: { path: fixtures.path, at: fixtures.at },
    cards,
    card,
    verb,
    /** The verbs Nani na Lini? uses. */
    naniVerbs: naniVerbs(decks, rules.data),
  };
};
