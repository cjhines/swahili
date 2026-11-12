import type { VocabDeck } from '../../content/schema.ts';
import type { Direction, Mode } from '../../domain.ts';
import type { NaniTense } from '../../nani/patterns.ts';
import type { DeckKind, NaniSetup, SessionSetup } from '../../session/setup.ts';
import { NANI_TITLE } from '../../session/views.ts';

export const DECK_KINDS = [
  { value: 'vocab', label: 'Vocabulary' },
  {
    value: 'nani',
    label: NANI_TITLE,
    description: 'Verb forms: who did it, and when.',
  },
] as const satisfies readonly {
  value: DeckKind;
  label: string;
  description?: string;
}[];

export const DIRECTIONS = [
  { value: 'sw-en', label: 'Swahili → English' },
  { value: 'en-sw', label: 'English → Swahili' },
] as const satisfies readonly { value: Direction; label: string }[];

export const MODES = [
  {
    value: 'practice',
    label: 'Practice',
    description: 'Cards that are due, plus some new ones.',
  },
  {
    value: 'complete',
    label: 'Complete deck',
    description: 'Every card you’ve chosen, once.',
  },
] as const satisfies readonly {
  value: Mode;
  label: string;
  description: string;
}[];

export const TENSES: { value: NaniTense; label: string; example: string }[] = [
  { value: 'present', label: 'Present', example: 'ninasoma · I am reading' },
  { value: 'past', label: 'Past', example: 'nilisoma · I read' },
  { value: 'future', label: 'Future', example: 'nitasoma · I will read' },
  { value: 'perfect', label: 'Perfect', example: 'nimesoma · I have read' },
  { value: 'have', label: 'Have / don’t have', example: 'nina · I have' },
];

export const POLARITIES = [
  { value: 'pos', label: 'Positive' },
  { value: 'neg', label: 'Negative' },
  { value: 'both', label: 'Both' },
] as const satisfies readonly { value: NaniSetup['polarity']; label: string }[];

/** "Numbers, Time + dates" or "Nani na Lini?: Past, Present". */
export const describeSetup = (
  setup: SessionSetup,
  decks: readonly VocabDeck[]
) =>
  setup.kind === 'vocab'
    ? setup.deckIds
        .map((id) => decks.find((deck) => deck.id === id)?.title)
        .filter(Boolean)
        .join(', ')
    : `${NANI_TITLE}: ${TENSES.filter((t) => setup.tenses.includes(t.value))
        .map((t) => t.label)
        .join(', ')}`;

export const directionLabel = (direction: Direction) =>
  DIRECTIONS.find((d) => d.value === direction)!.label;

/** Adds `value` if it's missing, removes it if it's there. */
export const toggle = <T>(list: readonly T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
