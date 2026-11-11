import { progressKey, type Direction, type ProgressKey } from '../domain.ts';
import { isDue, isNew, type MemoryState } from '../scheduler/scheduler.ts';

// Pure queue building. Randomness is injected so tests are deterministic.

export type ReviewItem = {
  key: ProgressKey;
  cardId: string;
  direction: Direction;
  /**
   * Nani na Lini? only: the verb card this pattern is shown with, chosen when the session is
   * built. Progress is tracked by `key` (the pattern), never by the verb.
   */
  verbId?: string;
};

export type Random = () => number;

export type StateOf = (key: ProgressKey) => MemoryState | undefined;

/** One item per card, all in the session's chosen direction. */
export const reviewItems = (
  cardIds: readonly string[],
  direction: Direction
): ReviewItem[] =>
  cardIds.map((cardId) => ({
    key: progressKey(cardId, direction),
    cardId,
    direction,
  }));

/** Fisher–Yates. Returns a new array. */
export const shuffle = <T>(
  items: readonly T[],
  random: Random = Math.random
): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

export type PracticeOptions = {
  now: Date;
  /** Most new cards to introduce this session. */
  newCap: number;
  random?: Random;
};

/**
 * Practice: every due card, most overdue first, plus up to `newCap` new cards picked at random
 * and mixed in at random positions. Cards that have been reviewed but aren't due yet are left out.
 */
export const practiceQueue = (
  items: readonly ReviewItem[],
  stateOf: StateOf,
  { now, newCap, random = Math.random }: PracticeOptions
): ReviewItem[] => {
  const due = items
    .map((item) => ({ item, state: stateOf(item.key) }))
    .filter((entry): entry is { item: ReviewItem; state: MemoryState } =>
      isDue(entry.state, now)
    )
    .sort((a, b) => a.state.dueAt.getTime() - b.state.dueAt.getTime())
    .map(({ item }) => item);

  const fresh = shuffle(
    items.filter((item) => isNew(stateOf(item.key))),
    random
  ).slice(0, Math.max(0, newCap));

  const queue = [...due];
  for (const item of fresh) {
    queue.splice(Math.floor(random() * (queue.length + 1)), 0, item);
  }
  return queue;
};

/** Complete deck: every card once, shuffled. */
export const completeQueue = (
  items: readonly ReviewItem[],
  random: Random = Math.random
) => shuffle(items, random);

/** What Practice would offer right now, for the setup screen and the "nothing due" message. */
export const practiceSummary = (
  items: readonly ReviewItem[],
  stateOf: StateOf,
  now: Date
) => {
  let due = 0;
  let fresh = 0;
  let nextDueAt: Date | undefined;
  for (const item of items) {
    const state = stateOf(item.key);
    if (isNew(state)) fresh++;
    else if (isDue(state, now)) due++;
    else if (!nextDueAt || state.dueAt < nextDueAt) nextDueAt = state.dueAt;
  }
  return { due, new: fresh, nextDueAt };
};
