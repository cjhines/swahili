import type { VocabDeck } from '../content/schema.ts';
import { progressKey, type Direction } from '../domain.ts';
import {
  completeQueue,
  practiceQueue,
  reviewItems,
  type Random,
  type ReviewItem,
  type StateOf,
} from './queue.ts';
import { startSession } from './session.ts';
import type { NaniSetup, SessionSetup } from './setup.ts';
import { skipReason, verbInfo, type NaniVerb } from '../nani/conjugate.ts';
import { allPatterns, type Pattern } from '../nani/patterns.ts';
import type { NaniRules } from '../nani/schema.ts';

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

/** A verb card Nani na Lini? can fill its patterns with. */
export type VerbCard = { id: string; verb: NaniVerb };

/** Every verb in every deck, except those rules.yaml says never to conjugate (kuwa). */
export const naniVerbs = (
  decks: readonly VocabDeck[],
  rules: NaniRules
): VerbCard[] =>
  decks
    .flatMap((deck) => deck.cards)
    .flatMap((card) =>
      card.kind === 'verb' && !verbInfo(rules, card.sw).exclude
        ? [{ id: card.id, verb: { sw: card.sw, en: card.en } }]
        : []
    );

export const MIN_REVIEWED_VERBS = 5;

/**
 * Verbs you've already met in Vocabulary (either direction), so a miss means you didn't know
 * the pattern, not the verb. With fewer than 5 of those, every verb, so there's enough variety.
 */
export const eligibleVerbs = (verbs: readonly VerbCard[], stateOf: StateOf) => {
  const reviewed = verbs.filter(
    (v) =>
      stateOf(progressKey(v.id, 'sw-en')) !== undefined ||
      stateOf(progressKey(v.id, 'en-sw')) !== undefined
  );
  return reviewed.length >= MIN_REVIEWED_VERBS ? reviewed : [...verbs];
};

/** The patterns matching the chosen tenses and positive/negative, in the chosen direction. */
export const naniItems = (
  rules: NaniRules,
  setup: Pick<NaniSetup, 'tenses' | 'polarity' | 'direction'>
) =>
  allPatterns(rules)
    .filter(
      (p) =>
        setup.tenses.includes(p.tense) &&
        (setup.polarity === 'both' || p.polarity === setup.polarity)
    )
    .map((p): ReviewItem => ({
      key: progressKey(p.id, setup.direction),
      cardId: p.id,
      direction: setup.direction,
    }));

/**
 * Gives each verb pattern a random verb, never the same one twice in a row. "Have" needs none.
 * `allowed` leaves out verbs rules.yaml skips for a pattern (no kutaka in the perfect).
 */
export const assignVerbs = (
  queue: readonly ReviewItem[],
  verbIds: readonly string[],
  patterns: ReadonlyMap<string, Pattern>,
  random: Random = Math.random,
  allowed: (verbId: string, pattern: Pattern) => boolean = () => true
): ReviewItem[] => {
  let previous: string | undefined;
  return queue.map((item) => {
    const pattern = patterns.get(item.cardId);
    if (!pattern || pattern.tense === 'have' || verbIds.length === 0)
      return item;
    const fits = verbIds.filter((id) => allowed(id, pattern));
    const pool = fits.length > 0 ? fits : verbIds; // every verb skipped: better than no card
    const choices =
      pool.length > 1 ? pool.filter((id) => id !== previous) : pool;
    const verbId = choices[Math.floor(random() * choices.length)]!;
    previous = verbId;
    return { ...item, verbId };
  });
};

export const itemsFor = (
  setup: SessionSetup,
  { decks, rules }: { decks: readonly VocabDeck[]; rules: NaniRules }
): ReviewItem[] =>
  setup.kind === 'vocab'
    ? vocabItems(decks, setup.deckIds, setup.direction)
    : naniItems(rules, setup);

export const buildSession = (
  setup: SessionSetup,
  content: {
    decks: readonly VocabDeck[];
    rules: NaniRules;
    verbs: readonly VerbCard[];
  },
  stateOf: StateOf,
  { now, random = Math.random }: { now: Date; random?: Random }
) => {
  const items = itemsFor(setup, content);
  let queue =
    setup.mode === 'practice'
      ? practiceQueue(items, stateOf, { now, newCap: setup.newCap, random })
      : completeQueue(items, random);
  if (setup.kind === 'nani') {
    const patterns = new Map(allPatterns(content.rules).map((p) => [p.id, p]));
    const swOf = new Map(content.verbs.map((v) => [v.id, v.verb.sw]));
    queue = assignVerbs(
      queue,
      eligibleVerbs(content.verbs, stateOf).map((v) => v.id),
      patterns,
      random,
      (id, pattern) => !skipReason(content.rules, swOf.get(id) ?? '', pattern)
    );
  }
  return startSession(queue, { repeatMisses: setup.repeatMisses });
};
