// Small shared vocabulary for scheduling, storage and sessions.

/** Which way round a card is tested. Progress is tracked separately for each. */
export type Direction = 'sw-en' | 'en-sw';
export const DIRECTIONS: readonly Direction[] = ['sw-en', 'en-sw'];

/** The two buttons: Got it / Missed it. */
export type Grade = 'got' | 'missed';

export type Mode = 'practice' | 'complete';

/** What progress is stored against: a card in one direction, e.g. `vocab-kesho:sw-en`. */
export type ProgressKey = `${string}:${Direction}`;

export const progressKey = (
  cardId: string,
  direction: Direction
): ProgressKey => `${cardId}:${direction}`;
