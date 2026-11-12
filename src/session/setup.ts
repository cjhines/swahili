import { z } from 'zod/mini';

import type { VocabDeck } from '../content/schema.ts';
import { NANI_TENSES, type NaniTense } from '../nani/patterns.ts';
import { readLocal, writeLocal } from '../storage/local.ts';

// The setup screen's choices, remembered between visits: one set per deck kind, plus which kind
// was used last.

export const NEW_CAP_OPTIONS = [0, 5, 10, 15, 20, 30, 50] as const;

export type DeckKind = 'vocab' | 'nani';

const shared = {
  direction: z.enum(['sw-en', 'en-sw']),
  mode: z.enum(['practice', 'complete']),
  newCap: z.int().check(z.minimum(0), z.maximum(100)),
  repeatMisses: z.boolean(),
};

export const VocabSetup = z.object({
  kind: z.literal('vocab'),
  deckIds: z.array(z.string()),
  ...shared,
});
export type VocabSetup = z.infer<typeof VocabSetup>;

export const NaniSetup = z.object({
  kind: z.literal('nani'),
  tenses: z.array(z.enum(NANI_TENSES)),
  /** Positive only, negative only, or both. */
  polarity: z.enum(['pos', 'neg', 'both']),
  ...shared,
});
export type NaniSetup = z.infer<typeof NaniSetup>;

export const SessionSetup = z.discriminatedUnion('kind', [
  VocabSetup,
  NaniSetup,
]);
export type SessionSetup = VocabSetup | NaniSetup;

/** Setups saved before deck kinds existed were vocabulary ones without `kind`. */
export const withKind = (value: unknown) =>
  value && typeof value === 'object' && !('kind' in value) && 'deckIds' in value
    ? { kind: 'vocab', ...value }
    : value;

const KEY = 'setup';
const read = () => {
  const raw = readLocal(KEY);
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
};

export const defaultVocabSetup = (decks: readonly VocabDeck[]): VocabSetup => ({
  kind: 'vocab',
  deckIds: decks.map((deck) => deck.id),
  direction: 'sw-en',
  mode: 'practice',
  newCap: 10,
  repeatMisses: true,
});

export const defaultNaniSetup = (
  available: readonly NaniTense[]
): NaniSetup => ({
  kind: 'nani',
  tenses: [...available],
  polarity: 'both',
  // Producing the form is the skill: shown "We didn't read", you say hatukusoma.
  direction: 'en-sw',
  mode: 'practice',
  newCap: 10,
  repeatMisses: true,
});

/** Last vocabulary choices, minus decks that no longer exist. Unreadable falls back to defaults. */
export const loadVocabSetup = (decks: readonly VocabDeck[]): VocabSetup => {
  const parsed = VocabSetup.safeParse(withKind(read().vocab));
  if (!parsed.success) return defaultVocabSetup(decks);
  const existing = new Set(decks.map((deck) => deck.id));
  const deckIds = parsed.data.deckIds.filter((id) => existing.has(id));
  return {
    ...parsed.data,
    deckIds: deckIds.length ? deckIds : defaultVocabSetup(decks).deckIds,
  };
};

/** Last Nani na Lini? choices, limited to the tenses on offer. Unreadable falls back to defaults. */
export const loadNaniSetup = (available: readonly NaniTense[]): NaniSetup => {
  const parsed = NaniSetup.safeParse(read().nani);
  if (!parsed.success) return defaultNaniSetup(available);
  const tenses = parsed.data.tenses.filter((tense) =>
    available.includes(tense)
  );
  return { ...parsed.data, tenses: tenses.length ? tenses : [...available] };
};

export const loadLastKind = (): DeckKind =>
  read().kind === 'nani' ? 'nani' : 'vocab';

export const saveSetup = (setup: SessionSetup) =>
  writeLocal(KEY, { ...read(), [setup.kind]: setup, kind: setup.kind });
