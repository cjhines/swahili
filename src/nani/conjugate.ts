import type { Pattern } from './patterns.ts';
import type { NaniRules } from './schema.ts';
import type { VerbEnglish } from '../content/schema.ts';

// Builds a Swahili verb form from rules.yaml, as labelled parts for the coloured breakdown:
//
//   ha  · tu · ku   · soma
//   not   we   past   read
//
// Pure: rules + pattern + verb in, form out. fixtures.yaml checks it against known-correct forms.

export type PartRole =
  | 'subject'
  | 'negative'
  | 'negative-subject'
  | 'tense'
  | 'ku'
  | 'stem'
  | 'ending'
  | 'have';
export type Part = { text: string; role: PartRole; label: string };
export type Form = { sw: string; parts: Part[] };

export type NaniVerb = { sw: string; en: VerbEnglish };
/** All conjugation needs: the ku- form, and the English base for the stem's label. */
export type ConjugatableVerb = { sw: string; en: Pick<VerbEnglish, 'base'> };

const VOWELS = /[aeiou]/g;

/** How a verb behaves, from its ku- form plus any quirks listed in rules.yaml. */
export const verbInfo = (rules: NaniRules, sw: string) => {
  const quirks = rules.verbs[sw] ?? {};
  const prefix = sw.slice(0, 2); // ku, or kw before a vowel (kwenda)
  const stem = quirks.stem ?? sw.slice(2);
  const oneSyllable = (stem.match(VOWELS)?.length ?? 0) === 1; // la, nywa, wa
  return {
    prefix,
    stem,
    oneSyllable,
    keepKu: quirks.keepKu ?? oneSyllable,
    exclude: quirks.exclude ?? false,
  };
};

const subjectParts = (rules: NaniRules, pattern: Pattern): Part[] => {
  const subject = rules.subjects.find((s) => s.id === pattern.subject);
  if (!subject) throw new Error(`Unknown subject "${pattern.subject}"`);
  if (pattern.polarity === 'pos')
    return [{ text: subject.pos, role: 'subject', label: subject.en }];
  const [first, second] = subject.neg;
  return second
    ? [
        { text: first!, role: 'negative', label: rules.labels.negative },
        { text: second, role: 'subject', label: subject.en },
      ]
    : [
        {
          text: first!,
          role: 'negative-subject',
          label: `${rules.labels.negative} + ${subject.en}`,
        },
      ];
};

export const conjugate = (
  rules: NaniRules,
  pattern: Pattern,
  verb?: ConjugatableVerb
): Form => {
  const parts = subjectParts(rules, pattern);

  if (pattern.tense === 'have') {
    parts.push({
      text: rules.have.marker,
      role: 'have',
      label: rules.have.label,
    });
  } else {
    if (!verb) throw new Error(`"${pattern.id}" needs a verb`);
    const { prefix, stem, keepKu } = verbInfo(rules, verb.sw);
    const stemPart = (text: string): Part => ({
      text,
      role: 'stem',
      label: verb.en.base,
    });
    const kuPart: Part = {
      text: prefix,
      role: 'ku',
      label: rules.labels.keptKu,
    };
    const marker = rules.tenses[pattern.tense][pattern.polarity];

    if (!marker) {
      // Present negative: no marker, a final -a becomes the ending (som·i); one-syllable verbs
      // drop their ku- (si·l·i). Verbs not ending in -a keep their ending (si·jibu).
      const { ending, label } = rules.presentNegativeEnding;
      parts.push(
        ...(stem.endsWith('a')
          ? [
              stemPart(stem.slice(0, -1)),
              { text: ending, role: 'ending' as const, label },
            ]
          : [stemPart(stem)])
      );
    } else if (keepKu && marker.kept === 'merge') {
      // The marker is itself ku, and the verb's own ku/kw takes its place: si·ku·la, si·kw·enda.
      parts.push(
        { text: prefix, role: 'tense', label: marker.label },
        stemPart(stem)
      );
    } else {
      parts.push(
        { text: marker.marker, role: 'tense', label: marker.label },
        ...(keepKu && marker.kept === 'keep' ? [kuPart] : []),
        stemPart(stem)
      );
    }
  }

  return { sw: parts.map((part) => part.text).join(''), parts };
};
