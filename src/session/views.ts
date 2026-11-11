import type { ReviewItem } from './queue.ts';
import type { VerbCard } from './start.ts';
import {
  answerFor,
  meaningOf,
  promptFor,
  type Answer,
  type CardIndex,
  type Prompt,
} from '../content/display.ts';
import { conjugate } from '../nani/conjugate.ts';
import { english } from '../nani/english.ts';
import { verbFacts, type VerbFacts } from '../nani/facts.ts';
import { allPatterns } from '../nani/patterns.ts';
import type { NaniRules } from '../nani/schema.ts';

// What's on screen for a queue item, whatever the deck kind. The session and end screens only
// ever see this, so they don't care whether a card is vocabulary or Nani na Lini?.

export type CardView = {
  /** Shown in the session header: the deck's name, or "Nani na Lini?". */
  title: string;
  prompt: Prompt;
  answer: Answer;
};

export type ViewOf = (item: ReviewItem) => CardView | undefined;

/** "One syllable, so it keeps ku-: ninakuwa · nilikuwa · nitakuwa · nimekuwa". */
export const keptLine = ({ prefix, kept }: VerbFacts) =>
  kept &&
  `${kept.oneSyllable ? 'One syllable, so it keeps' : 'Keeps'} ${prefix}-: ${kept.forms.join(' · ')}`;

/**
 * A vocabulary card. Verbs also show their stem, and, if they keep their ku-, the forms that show
 * it: both worked out by the Nani na Lini? engine from rules.yaml, never typed by hand.
 */
export const vocabView =
  (index: CardIndex, rules: NaniRules): ViewOf =>
  (item) => {
    const entry = index.get(item.cardId);
    if (!entry) return undefined;
    const { card } = entry;
    const answer = answerFor(card, item.direction);
    if (card.kind === 'verb') {
      const facts = verbFacts(rules, card.sw);
      answer.stem = facts.stem;
      const kept = keptLine(facts);
      if (kept) answer.kept = kept;
    }
    return {
      title: entry.deck.title,
      prompt: promptFor(card, item.direction),
      answer,
    };
  };

export const NANI_TITLE = 'Nani na Lini?';

/**
 * A pattern plus its verb: going English → Swahili, "We didn't read" is the prompt and
 * hatukusoma the answer (and the other way round). The answer side always shows the Swahili
 * form's breakdown and which verb it was.
 */
export const naniView = (
  rules: NaniRules,
  verbs: readonly VerbCard[]
): ViewOf => {
  const patterns = new Map(allPatterns(rules).map((p) => [p.id, p]));
  const verbById = new Map(verbs.map((v) => [v.id, v.verb]));
  return (item) => {
    const pattern = patterns.get(item.cardId);
    const verb = item.verbId ? verbById.get(item.verbId) : undefined;
    if (!pattern || (pattern.tense !== 'have' && !verb)) return undefined;

    const form = conjugate(rules, pattern, verb);
    const swahili = { text: form.sw, lang: 'sw' } as const;
    const englishSide = {
      text: english(rules, pattern, verb),
      lang: 'en',
    } as const;
    const extras = {
      breakdown: form.parts,
      gloss: verb ? `${verb.sw}: ${meaningOf(verb.en)}` : 'kuwa na: to have',
    };
    return item.direction === 'sw-en'
      ? {
          title: NANI_TITLE,
          prompt: swahili,
          answer: { ...englishSide, ...extras },
        }
      : {
          title: NANI_TITLE,
          prompt: englishSide,
          answer: { ...swahili, ...extras },
        };
  };
};

/** One view for everything: Nani na Lini? patterns are the cards whose ID starts nani-. */
export const viewFor =
  (vocab: ViewOf, nani: ViewOf): ViewOf =>
  (item) =>
    item.cardId.startsWith('nani-') ? nani(item) : vocab(item);
