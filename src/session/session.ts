import type { Grade, ProgressKey } from '../domain.ts';
import type { Random, ReviewItem } from './queue.ts';

// The state of one study session, as a pure reducer. It decides what's shown next. Saving each
// mark is the caller's job (ProgressStore.mark), so this stays free of I/O and easy to test.
//
// Plain JSON-serialisable data throughout, so an unfinished Complete deck run can be saved
// and resumed.

export type SessionState = {
  queue: ReviewItem[];
  /** Index of the card on screen. The session is over once it reaches queue.length. */
  position: number;
  flipped: boolean;
  repeatMisses: boolean;
  /** Distinct cards the session started with. */
  total: number;
  /** Cards that are done: got, or missed with repeat-misses off. */
  finished: ProgressKey[];
  /** Cards missed at least once, for the end screen. */
  missed: ProgressKey[];
};

export type SessionAction =
  | { type: 'flip' }
  /** `requeueOffset`: how many other cards come before a missed card returns (see requeueOffset()). */
  | { type: 'mark'; grade: Grade; requeueOffset: number };

export const startSession = (
  queue: readonly ReviewItem[],
  { repeatMisses }: { repeatMisses: boolean }
): SessionState => ({
  queue: [...queue],
  position: 0,
  flipped: false,
  repeatMisses,
  total: new Set(queue.map((item) => item.key)).size,
  finished: [],
  missed: [],
});

export const currentItem = (state: SessionState): ReviewItem | undefined =>
  state.queue[state.position];

export const isDone = (state: SessionState) =>
  state.position >= state.queue.length;

/** A missed card comes back 3–5 cards later, so its position isn't predictable. */
export const requeueOffset = (random: Random = Math.random) =>
  3 + Math.floor(random() * 3);

const addOnce = (keys: ProgressKey[], key: ProgressKey) =>
  keys.includes(key) ? keys : [...keys, key];

export const sessionReducer = (
  state: SessionState,
  action: SessionAction
): SessionState => {
  const item = currentItem(state);
  if (!item) return state;

  switch (action.type) {
    case 'flip':
      return state.flipped ? state : { ...state, flipped: true };

    case 'mark': {
      // The buttons only appear on the answer side. Marking an unseen answer is a bug, so ignore it.
      if (!state.flipped) return state;

      const requeue = action.grade === 'missed' && state.repeatMisses;
      let queue = state.queue;
      if (requeue) {
        // Clamped to the end: with fewer cards left than the offset, it simply comes last.
        const at = Math.min(
          state.position + 1 + action.requeueOffset,
          queue.length
        );
        queue = [...queue.slice(0, at), item, ...queue.slice(at)];
      }

      return {
        ...state,
        queue,
        position: state.position + 1,
        flipped: false,
        finished: requeue ? state.finished : addOnce(state.finished, item.key),
        missed:
          action.grade === 'missed'
            ? addOnce(state.missed, item.key)
            : state.missed,
      };
    }
  }
};
