import type { Direction } from '../domain.ts';
import type { VocabCard, VocabDeck } from './schema.ts';

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
};

/** Verbs are learned as "to read", everything else as written. */
export const englishOf = (card: VocabCard) =>
  card.kind === 'verb' ? `to ${card.en.base}` : card.en;

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
