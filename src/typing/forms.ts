import type { Lang } from '../content/display.ts';

// Typing mode: every way of writing a card's answer that counts as right, and the canonical key
// two answers are compared by.
//
// Swahili must be exact: the key only ignores capitals, punctuation and extra spaces, because one
// letter is often the grammar (sisomi, not sisoma). English is lenient: the rules below.

/**
 * Every English form an answer accepts, for display and matching:
 * - the answer as it stands
 * - " / " separates meanings, each right on its own: "to look / to look at" → "to look", "to look at"
 * - a bracketed part is optional: "It (N-class)" → "It"; "(plural)" may also be "all" ("you all")
 * - "he/she" may be "he", "she" or "he or she"
 * - "yet" is optional after haven't / hasn't ("We haven't read"). Not after don't: "I don't know
 *   yet" without "yet" is the present, a different card.
 * - a leading "to", "a", "an" or "the" is optional
 * - contractions may be written out ("didn't" → "did not")
 * - a number in words may be written in digits ("twenty-two" → "22")
 */
export const englishForms = (answer: string): string[] => {
  const forms = answer.split(/\s+\/\s+/).flatMap((meaning) => {
    // "He/she reads" → "She reads", not "she reads".
    const capital = /^\p{Lu}/u.test(meaning);
    return [
      ...optionalGroups(meaning)
        .flatMap(eitherWord)
        .flatMap(withoutYet)
        .flatMap(withoutLeadingWord)
        .flatMap((form) => [form, writtenOut(form)])
        .map((form) =>
          capital ? form.charAt(0).toUpperCase() + form.slice(1) : form
        ),
      ...digits(meaning),
    ];
  });
  return unique([answer, ...forms].map(tidy));
};

/** "I have heard (got it)" → "I have heard", "I have heard got it". */
const optionalGroups = (text: string): string[] => {
  const match = /\s*\(([^)]*)\)/.exec(text);
  if (!match) return [text];
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const inner = match[1]!;
  const fillers = ['', ` ${inner}`, ...(inner === 'plural' ? [' all'] : [])];
  return fillers.flatMap((filler) => optionalGroups(before + filler + after));
};

/** "He/she reads" → itself, "He reads", "she reads", "He or she reads". */
const eitherWord = (text: string): string[] => {
  const match = /(\p{L}+)\/(\p{L}+)/u.exec(text);
  if (!match) return [text];
  const [whole, a, b] = match;
  const head = text.slice(0, match.index);
  const tails = eitherWord(text.slice(match.index + whole.length));
  return [whole, a!, b!, `${a} or ${b}`].flatMap((word) =>
    tails.map((tail) => head + word + tail)
  );
};

const withoutYet = (text: string) =>
  /\b(have|has)(n['’]t| not)\b/i.test(text) && /\s+yet$/i.test(text)
    ? [text, text.replace(/\s+yet$/i, '')]
    : [text];

const withoutLeadingWord = (text: string) => {
  const match = /^(to|a|an|the)\s+(?=\S)/i.exec(text);
  return match ? [text, text.slice(match[0].length)] : [text];
};

/** For showing the nearest right answer: "We did not read" lines up with what was typed. */
const writtenOut = (text: string) =>
  text
    .replace(/\bwon['’]t\b/gi, 'will not')
    .replace(/\bcan['’]t\b/gi, 'cannot')
    .replace(/\b(\w+)n['’]t\b/gi, '$1 not')
    .replace(/\b(\w+)['’]re\b/gi, '$1 are')
    .replace(/\b(\w+)['’]ve\b/gi, '$1 have')
    .replace(/\b(\w+)['’]ll\b/gi, '$1 will')
    .replace(/\bI['’]m\b/g, 'I am');

const digits = (text: string) => {
  const value = numberValue(text);
  return value === undefined ? [] : [String(value)];
};

const UNITS = [
  ...'zero one two three four five six seven eight nine'.split(' '),
  ...'ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(
    ' '
  ),
];
const TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');

/** "twenty-two" → 22, "one thousand" → 1000. Anything that isn't wholly a number → undefined. */
export const numberValue = (text: string): number | undefined => {
  const words = text
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((word) => word && word !== 'and');
  if (!words.length) return undefined;
  let total = 0;
  let current = 0;
  for (const word of words) {
    if (UNITS.includes(word)) current += UNITS.indexOf(word);
    else if (TENS.includes(word)) current += (TENS.indexOf(word) + 2) * 10;
    else if (word === 'hundred') current = (current || 1) * 100;
    else if (word === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
    } else return undefined;
  }
  return total + current;
};

/**
 * What two answers are compared by: lower case, straight apostrophes, no punctuation, single
 * spaces. English also has its contractions written out ("he's" may be "he is" or "he has", so
 * that gives two keys) and loses a leading "to", "a", "an" or "the".
 */
export const keysOf = (text: string, lang: Lang): string[] => {
  const plain = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘ʼ`´]/g, "'")
    .replace(/(\d),(?=\d{3}\b)/g, '$1'); // 1,000 → 1000
  if (lang === 'sw')
    // Apostrophes stay inside a word (ng'ombe): there they're a letter.
    return [
      tidy(plain.replace(/[^\p{L}\p{N}']+|'(?!\p{L})|(?<!\p{L})'/gu, ' ')),
    ];
  return unique(
    contractions(plain).map((key) =>
      tidy(key.replace(/'/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ')).replace(
        /^(to|a|an|the) (?=\S)/,
        ''
      )
    )
  );
};

const PRONOUN_S =
  /\b(he|she|it|that|there|what|who|where|here)'s\b|\b(he|she)s\b/;

const contractions = (text: string): string[] => {
  const s = text
    .replace(/\blet'?s\b/g, 'let us')
    .replace(/\bwon'?t\b/g, 'will not')
    .replace(/\bcan'?t\b|\bcannot\b/g, 'can not')
    .replace(/\b(\w+)n't\b/g, '$1 not')
    // Without the apostrophe (autocorrect is off): dont, didnt, havent…
    .replace(
      /\b(do|does|did|is|are|was|were|has|have|had|could|would|should|must|need)nt\b/g,
      '$1 not'
    )
    .replace(/\b(\w+)'re\b|\b(you|they)re\b/g, '$1$2 are')
    .replace(/\b(\w+)'ve\b|\b(i|we|you|they)ve\b/g, '$1$2 have')
    .replace(/\b(\w+)'ll\b|\b(you|they)ll\b/g, '$1$2 will')
    .replace(/\bi'?m\b/g, 'i am');
  return eitherS(s);
};

/** "he's" is "he is" or "he has": one key for each. */
const eitherS = (text: string): string[] => {
  const match = PRONOUN_S.exec(text);
  if (!match) return [text];
  const who = match[1] ?? match[2]!;
  const head = text.slice(0, match.index);
  const tails = eitherS(text.slice(match.index + match[0].length));
  return ['is', 'has'].flatMap((verb) =>
    tails.map((tail) => `${head}${who} ${verb}${tail}`)
  );
};

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();
const unique = <T>(list: T[]) => [...new Set(list)];
