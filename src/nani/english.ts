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
export const english = (rules: NaniRules, pattern: Pattern, verb?: NaniVerb) =>
  fill(rules, pattern, verb, template(rules, pattern, verb).sentence);

/**
 * Every English sentence that counts as right in typing mode: the card's own sentence first, then
 * rules.english.accept ("We read" for tunasoma), which applies only when the sentence comes from
 * the plain tense template (3 above).
 */
export const englishAnswers = (
  rules: NaniRules,
  pattern: Pattern,
  verb?: NaniVerb
) => {
  const { sentence, plain } = template(rules, pattern, verb);
  const extra = plain
    ? (rules.english.accept[pattern.tense]?.[pattern.polarity] ?? [])
    : [];
  return [sentence, ...extra].map((t) => fill(rules, pattern, verb, t));
};

const template = (rules: NaniRules, pattern: Pattern, verb?: NaniVerb) => {
  const { tense, polarity } = pattern;
  const own = tense === 'have' ? undefined : verb?.en.tenses?.[tense];
  if (own) return { sentence: own[polarity], plain: false };
  if (tense === 'present' && verb?.en.stative)
    return { sentence: rules.english.stativePresent[polarity], plain: false };
  return { sentence: rules.english[tense][polarity], plain: true };
};

const fill = (
  rules: NaniRules,
  pattern: Pattern,
  verb: NaniVerb | undefined,
  template: string
) => {
  const subject = rules.subjects.find((s) => s.id === pattern.subject);
  if (!subject) throw new Error(`Unknown subject "${pattern.subject}"`);

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
