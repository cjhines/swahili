import { conjugate, verbInfo } from './conjugate.ts';
import { patternId, TENSES } from './patterns.ts';
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
  const { stem, prefix, keepKu, oneSyllable } = verbInfo(rules, sw);
  if (!keepKu) return { stem, prefix };
  const first = rules.subjects[0]!.id; // "I", first in rules.yaml
  const forms = TENSES.map(
    (tense) =>
      conjugate(
        rules,
        {
          id: patternId(first, tense, 'pos'),
          subject: first,
          tense,
          polarity: 'pos',
        },
        { sw, en: { base: '' } }
      ).sw
  );
  return { stem, prefix, kept: { oneSyllable, forms } };
};
