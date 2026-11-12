import type { NaniVerb } from './conjugate.ts';
import type { Pattern } from './patterns.ts';
import type { NaniRules } from './schema.ts';

/**
 * The English side: "We didn't read", "He/she wants", "They (N-class) don't have".
 *
 * Subject + a template, chosen in this order:
 *   1. the verb's own English for that tense (kuweza: "can" / "can't")
 *   2. for a stative verb's present: rules.english.stativePresent ("I want", not "I am wanting")
 *   3. rules.english[tense]
 * filled from the subject (am/is/are, have/has, do/does, was/were) and the verb's forms.
 */
export const english = (
  rules: NaniRules,
  pattern: Pattern,
  verb?: NaniVerb
) => {
  const subject = rules.subjects.find((s) => s.id === pattern.subject);
  if (!subject) throw new Error(`Unknown subject "${pattern.subject}"`);

  const { tense, polarity } = pattern;
  const own = tense === 'have' ? undefined : verb?.en.tenses?.[tense];
  const template =
    own?.[polarity] ??
    (tense === 'present' && verb?.en.stative
      ? rules.english.stativePresent
      : rules.english[tense])[polarity];

  const values: Record<string, string | undefined> = {
    be: subject.be,
    have: subject.have,
    do: subject.do,
    was: subject.was,
    // For a second clause with its own subject: "I am going out / I come from".
    subject: subject.en,
    s: subject.do === 'does' ? 's' : '',
    ...(verb && {
      base: verb.en.base,
      past: verb.en.past,
      participle: verb.en.participle,
      ing: verb.en.ing,
      simple: subject.do === 'does' ? verb.en.third : verb.en.base,
    }),
  };
  const rest = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined)
      throw new Error(`"${pattern.id}" needs a verb for {${name}}`);
    return value;
  });
  const sentence = `${subject.en} ${rest}`;
  return sentence[0]!.toUpperCase() + sentence.slice(1);
};
