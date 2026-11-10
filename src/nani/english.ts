import type { NaniVerb } from './conjugate.ts';
import type { Pattern } from './patterns.ts';
import type { NaniRules } from './schema.ts';

/**
 * The English side: "We didn't read", "He/she has eaten", "They (things) don't have".
 * Subject + the tense's template from rules.yaml, filled from the subject (am/is/are, have/has,
 * do/does) and the verb's English forms.
 */
export const english = (
  rules: NaniRules,
  pattern: Pattern,
  verb?: NaniVerb
) => {
  const subject = rules.subjects.find((s) => s.id === pattern.subject);
  if (!subject) throw new Error(`Unknown subject "${pattern.subject}"`);
  const values: Record<string, string> = {
    be: subject.be,
    have: subject.have,
    do: subject.do,
    ...verb?.en,
  };
  const rest = rules.english[pattern.tense][pattern.polarity].replace(
    /\{(\w+)\}/g,
    (_, name: string) => {
      const value = values[name];
      if (value === undefined)
        throw new Error(`"${pattern.id}" needs a verb for {${name}}`);
      return value;
    }
  );
  const sentence = `${subject.en} ${rest}`;
  return sentence[0]!.toUpperCase() + sentence.slice(1);
};
