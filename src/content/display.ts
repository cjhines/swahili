import type { Direction } from '../domain.ts';
import type { VerbEnglish, VocabCard, VocabDeck } from './schema.ts';
import type { Part } from '../nani/conjugate.ts';

// What each side of a vocabulary card shows, as plain data. Kept out of the components so the
// rules are tested directly.

export type Lang = 'sw' | 'en';

export type Prompt = {
  text: string;
  lang: Lang;
  /** Only going English → Swahili, to tell apart words with the same English. */
  hint?: string;
};

export type Answer = {
  text: string;
  lang: Lang;
  /** Other accepted Swahili spellings or forms. */
  alt?: string[];
  plural?: string;
  example?: { sw: string; en: string };
  note?: string;
  /** Verbs: the stem, e.g. nywa for kunywa. */
  stem?: string;
  /** Verbs that keep their ku-: "One syllable, so it keeps ku-: ninakunywa · nilikunywa · …". */
  kept?: string;
  /** Nani na Lini?: the form in coloured, labelled parts (ha·tu·ku·soma). */
  breakdown?: Part[];
  /** Nani na Lini?: which verb it was, e.g. "kusoma: to read". */
  gloss?: string;
};

/** How Vocabulary shows a verb: its own wording if it has one, else "to read". */
export const meaningOf = (en: VerbEnglish) => en.meaning ?? `to ${en.base}`;

/** Verbs are learned by meaning ("to read"), everything else as written. */
export const englishOf = (card: VocabCard) =>
  card.kind === 'verb' ? meaningOf(card.en) : card.en;

export const promptFor = (card: VocabCard, direction: Direction): Prompt =>
  direction === 'sw-en'
    ? { text: card.sw, lang: 'sw' }
    : {
        text: englishOf(card),
        lang: 'en',
        ...(card.hint && { hint: card.hint }),
      };

export const answerFor = (card: VocabCard, direction: Direction): Answer => ({
  ...(direction === 'sw-en'
    ? { text: englishOf(card), lang: 'en' }
    : { text: card.sw, lang: 'sw' }),
  ...(card.alt && { alt: card.alt }),
  ...(card.kind === 'noun' && card.plural && { plural: card.plural }),
  ...(card.example && { example: card.example }),
  ...(card.note && { note: card.note }),
});

export type CardIndex = ReadonlyMap<
  string,
  { card: VocabCard; deck: VocabDeck }
>;

export const indexCards = (decks: readonly VocabDeck[]): CardIndex =>
  new Map(
    decks.flatMap((deck) =>
      deck.cards.map((card) => [card.id, { card, deck }] as const)
    )
  );
