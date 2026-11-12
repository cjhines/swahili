import { conjugate, verbInfo } from './conjugate.ts';
import { pattern, TENSES } from './patterns.ts';
import type { NaniRules } from './schema.ts';

export type VerbFacts = {
  /** kusoma → soma, kunywa → nywa, kuwa → wa, kwenda → enda. */
  stem: string;
  /** ku, or kw for verbs like kwenda. */
  prefix: string;
  /**
   * For verbs that keep their ku- (one syllable, like kunywa and kuwa, or listed in rules.yaml,
   * like kwenda): the "I" form in each tense, e.g. ninakuwa, nilikuwa, nitakuwa, nimekuwa.
   */
  kept?: { oneSyllable: boolean; forms: string[] };
};

/**
 * What a verb card shows about the verb itself: its stem, and, if it keeps its ku-, the forms that
 * prove it. Built by the same engine fixtures.yaml checks, so the card can't contradict the rules.
 */
export const verbFacts = (rules: NaniRules, sw: string): VerbFacts => {
  const { stem, prefix, keepKu, oneSyllable, needsObject } = verbInfo(
    rules,
    sw
  );
  // A verb that always takes an object (kupa) never appears bare, so its "kept" forms would mislead.
  if (!keepKu || needsObject) return { stem, prefix };
  const first = rules.subjects[0]!.id; // "I", first in rules.yaml
  const forms = TENSES.map(
    (tense) =>
      conjugate(rules, pattern(first, tense, 'pos'), { sw, en: { base: '' } })
        .sw
  );
  return { stem, prefix, kept: { oneSyllable, forms } };
};

/** "One syllable, so it keeps ku-: ninakuwa · nilikuwa · nitakuwa · nimekuwa". */
export const keptLine = ({ prefix, kept }: VerbFacts) =>
  kept &&
  `${kept.oneSyllable ? 'One syllable, so it keeps' : 'Keeps'} ${prefix}-: ${kept.forms.join(' · ')}`;
