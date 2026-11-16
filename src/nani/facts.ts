import { conjugate, verbInfo } from './conjugate.ts';
import { pattern, TENSES } from './patterns.ts';
import type { NaniRules } from './schema.ts';

export type VerbFacts = {
  /** kusoma → soma, kunywa → nywa, kuwa → wa, kwenda → enda. */
  stem: string;
  /** ku, or kw for verbs like kwenda. */
  prefix: string;
  /**
   * For verbs that keep their ku- (one syllable, like kunywa and kuwa, or listed in rules.yaml):
   * the "I" form in each tense, e.g. ninakuwa, nilikuwa, nitakuwa, nimekuwa. `textbook`: only
   * textbooks keep it (kwenda: ninakwenda), and the app shows the everyday forms (ninaenda).
   */
  kept?: { oneSyllable: boolean; textbook?: true; forms: string[] };
};

/**
 * What a verb card shows about the verb itself: its stem, and, if it keeps its ku-, the forms that
 * prove it. Built by the same engine fixtures.yaml checks, so the card can't contradict the rules.
 */
export const verbFacts = (rules: NaniRules, sw: string): VerbFacts => {
  const { stem, prefix, keepKu, textbookKeepsKu, oneSyllable, needsObject } =
    verbInfo(rules, sw);
  // A verb that always takes an object (kupa) never appears bare, so its "kept" forms would mislead.
  if (!(keepKu || textbookKeepsKu) || needsObject) return { stem, prefix };
  const first = rules.subjects[0]!.id; // "I", first in rules.yaml
  const forms = TENSES.map(
    (tense) =>
      conjugate(
        rules,
        pattern(first, tense, 'pos'),
        { sw, en: { base: '' } },
        { keepKu: true }
      ).sw
  );
  return {
    stem,
    prefix,
    kept: { oneSyllable, ...(!keepKu && { textbook: true as const }), forms },
  };
};

/**
 * "One syllable, so it keeps ku-: ninakuwa · nilikuwa · nitakuwa · nimekuwa", or for a verb shown
 * the everyday way, "Textbooks keep kw-: ninakwenda · nilikwenda · nitakwenda · nimekwenda".
 */
export const keptLine = ({ prefix, kept }: VerbFacts) => {
  if (!kept) return undefined;
  const why = kept.textbook
    ? 'Textbooks keep'
    : kept.oneSyllable
      ? 'One syllable, so it keeps'
      : 'Keeps';
  return `${why} ${prefix}-: ${kept.forms.join(' · ')}`;
};
