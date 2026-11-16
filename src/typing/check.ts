import { englishForms, keysOf } from './forms.ts';
import type { Lang } from '../content/display.ts';

// Typing mode: is what you typed right? The verdict is final: right records Got it, wrong
// records Missed it. Pure, so every rule is tested directly.

/** What a card accepts when you type the answer. */
export type Expected = {
  lang: Lang;
  /** As the card shows them: "to look / to look at", "He/she didn't read", kungoja + its alt. */
  answers: readonly string[];
  /**
   * English only: other cards' answers. A slip that lands exactly on one of them is a different
   * answer, not a slip: "He/she read" (past) for anasoma, one letter from "He/she reads".
   */
  others?: () => readonly string[];
};

export type Check = {
  correct: boolean;
  /** What was typed, trimmed. Empty: you gave up. */
  typed: string;
  /** Letters (code point indexes) of `typed` that differ from `nearest`. */
  typedMarks: number[];
  /**
   * The right answer nearest to what was typed, when it's close enough to mark the letters that
   * differ. Absent when it was typed exactly right, or was nowhere near.
   */
  nearest?: string;
  /** Letters of `nearest` that differ from `typed`. */
  nearestMarks: number[];
};

/** A one-letter slip only counts in a word this long: "we" and "he" are different answers. */
export const SLIP_MIN_LETTERS = 4;

export const checkAnswer = (raw: string, expected: Expected): Check => {
  const typed = raw.trim();
  const { lang } = expected;
  const forms =
    lang === 'en'
      ? [...new Set(expected.answers.flatMap(englishForms))]
      : [...expected.answers];
  if (!typed)
    return { correct: false, typed, typedMarks: [], nearestMarks: [] };

  const typedKeys = keysOf(typed, lang);
  const keyed = forms.map((form) => ({ form, keys: keysOf(form, lang) }));
  if (keyed.some(({ keys }) => keys.some((key) => typedKeys.includes(key))))
    return { correct: true, typed, typedMarks: [], nearestMarks: [] };

  // English forgives one slip, unless it spells another card's answer.
  const slips =
    lang === 'en'
      ? keyed
          .filter(({ keys }) =>
            keys.some((key) => typedKeys.some((t) => isSlip(t, key)))
          )
          .map(({ form }) => form)
      : [];
  const correct = slips.length > 0 && !isOtherAnswer(typedKeys, expected);

  const nearest = closest(typed, correct ? slips : forms);
  const marks =
    nearest === undefined ? undefined : markDifferences(typed, nearest);
  // Too far off to compare letter by letter: the card's answer says it all.
  if (!marks) return { correct, typed, typedMarks: [], nearestMarks: [] };
  return {
    correct,
    typed,
    typedMarks: marks.typed,
    nearest,
    nearestMarks: marks.nearest,
  };
};

/** Same words but one, which is long enough and one letter off: "wiat" for "wait". */
export const isSlip = (typed: string, expected: string) => {
  const a = typed.split(' ');
  const b = expected.split(' ');
  if (a.length !== b.length) return false;
  const differing = a.flatMap((word, i) => (word === b[i] ? [] : [i]));
  if (differing.length !== 1) return false;
  const i = differing[0]!;
  return (
    [...b[i]!].length >= SLIP_MIN_LETTERS && editDistance(a[i]!, b[i]!) <= 1
  );
};

const isOtherAnswer = (typedKeys: string[], expected: Expected) => {
  const others = expected.others?.() ?? [];
  const keys = new Set(
    others.flatMap(englishForms).flatMap((form) => keysOf(form, 'en'))
  );
  return typedKeys.some((key) => keys.has(key));
};

/**
 * Letters to change, add, remove or swap with a neighbour ("wiat" → "wait" is one), ignoring
 * capitals and anything that isn't a letter or digit.
 */
export const editDistance = (a: string, b: string) => align(a, b).cost;

const closest = (typed: string, forms: readonly string[]) => {
  let best: { form: string; cost: number } | undefined;
  for (const form of forms) {
    const { cost } = align(typed, form);
    if (!best || cost < best.cost) best = { form, cost };
  }
  return best?.form;
};

/**
 * Which letters differ, for highlighting. Nothing when the two are so different that marking
 * would just colour in everything.
 */
export const markDifferences = (typed: string, nearest: string) => {
  const result = align(typed, nearest);
  const letters = [...nearest].filter(isLetter).length;
  if (result.cost > Math.max(2, Math.ceil(letters * 0.4))) return undefined;
  return { typed: result.a, nearest: result.b };
};

const isLetter = (char: string) => /[\p{L}\p{N}]/u.test(char);
const fold = (char: string) => char.toLowerCase().replace(/[’‘]/, "'");

/**
 * Optimal string alignment over code points: substitutions, insertions, deletions and swaps of
 * neighbours cost 1, but only for letters and digits. Spaces, punctuation and case are free.
 * Returns the cost and which positions of each string were changed.
 */
const align = (aText: string, bText: string) => {
  const a = [...aText];
  const b = [...bText];
  const weight = (char: string) => (isLetter(char) ? 1 : 0);
  const cost: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = 1; i <= a.length; i++)
    cost[i]![0] = cost[i - 1]![0]! + weight(a[i - 1]!);
  for (let j = 1; j <= b.length; j++)
    cost[0]![j] = cost[0]![j - 1]! + weight(b[j - 1]!);

  const same = (i: number, j: number) => fold(a[i - 1]!) === fold(b[j - 1]!);
  const swapped = (i: number, j: number) =>
    i > 1 &&
    j > 1 &&
    !same(i, j) &&
    fold(a[i - 1]!) === fold(b[j - 2]!) &&
    fold(a[i - 2]!) === fold(b[j - 1]!);
  const changeCost = (i: number, j: number) =>
    same(i, j) ? 0 : Math.max(weight(a[i - 1]!), weight(b[j - 1]!));

  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      let best = Math.min(
        cost[i - 1]![j]! + weight(a[i - 1]!),
        cost[i]![j - 1]! + weight(b[j - 1]!),
        cost[i - 1]![j - 1]! + changeCost(i, j)
      );
      if (swapped(i, j)) best = Math.min(best, cost[i - 2]![j - 2]! + 1);
      cost[i]![j] = best;
    }

  // Walk back along a cheapest path, noting what changed.
  const marksA: number[] = [];
  const marksB: number[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const here = cost[i]![j]!;
    if (i > 0 && j > 0 && here === cost[i - 1]![j - 1]! + changeCost(i, j)) {
      if (!same(i, j)) {
        if (isLetter(a[i - 1]!)) marksA.push(i - 1);
        if (isLetter(b[j - 1]!)) marksB.push(j - 1);
      }
      i--;
      j--;
    } else if (swapped(i, j) && here === cost[i - 2]![j - 2]! + 1) {
      marksA.push(i - 1, i - 2);
      marksB.push(j - 1, j - 2);
      i -= 2;
      j -= 2;
    } else if (i > 0 && here === cost[i - 1]![j]! + weight(a[i - 1]!)) {
      if (isLetter(a[i - 1]!)) marksA.push(i - 1);
      i--;
    } else {
      if (isLetter(b[j - 1]!)) marksB.push(j - 1);
      j--;
    }
  }
  return {
    cost: cost[a.length]![b.length]!,
    a: marksA.sort((x, y) => x - y),
    b: marksB.sort((x, y) => x - y),
  };
};
