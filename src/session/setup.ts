import { z } from 'zod/mini';

import type { VocabDeck } from '../content/schema.ts';
import { readLocal, writeLocal } from '../storage/local.ts';

// The setup screen's choices for a Vocabulary session, remembered between visits.

export const NEW_CAP_OPTIONS = [0, 5, 10, 15, 20, 30, 50] as const;

export const VocabSetup = z.object({
  deckIds: z.array(z.string()),
  direction: z.enum(['sw-en', 'en-sw']),
  mode: z.enum(['practice', 'complete']),
  newCap: z.int().check(z.minimum(0), z.maximum(100)),
  repeatMisses: z.boolean(),
});
export type VocabSetup = z.infer<typeof VocabSetup>;

const KEY = 'setup';
// Stored per deck kind, so Nani na Lini? can keep its own choices alongside.
const Stored = z.partial(z.object({ vocab: VocabSetup }));

export const defaultVocabSetup = (decks: readonly VocabDeck[]): VocabSetup => ({
  deckIds: decks.map((deck) => deck.id),
  direction: 'sw-en',
  mode: 'practice',
  newCap: 10,
  repeatMisses: true,
});

/** Last choices, minus decks that no longer exist. Anything unreadable falls back to the defaults. */
export const loadVocabSetup = (decks: readonly VocabDeck[]): VocabSetup => {
  const stored = Stored.safeParse(readLocal(KEY));
  const vocab = stored.success ? stored.data.vocab : undefined;
  if (!vocab) return defaultVocabSetup(decks);

  const existing = new Set(decks.map((deck) => deck.id));
  const deckIds = vocab.deckIds.filter((id) => existing.has(id));
  return {
    ...vocab,
    deckIds: deckIds.length ? deckIds : defaultVocabSetup(decks).deckIds,
  };
};

export const saveVocabSetup = (setup: VocabSetup) => {
  const stored = Stored.safeParse(readLocal(KEY));
  writeLocal(KEY, { ...(stored.success ? stored.data : {}), vocab: setup });
};
