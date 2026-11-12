import 'fake-indexeddb/auto';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import nani from 'virtual:nani';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';

import { Study, type NaniContent } from './Study.tsx';
import type { VocabDeck } from './content/schema.ts';
import { createScheduler, type Scheduler } from './scheduler/scheduler.ts';
import { ProgressStore } from './storage/progress.ts';

const decks: VocabDeck[] = [
  {
    id: 'numbers',
    title: 'Numbers',
    cards: [
      { id: 'vocab-moja', kind: 'word', sw: 'moja', en: 'one' },
      { id: 'vocab-mbili', kind: 'word', sw: 'mbili', en: 'two' },
      {
        id: 'vocab-elfu-moja',
        kind: 'word',
        sw: 'elfu moja',
        alt: ['alfu moja'],
        en: 'one thousand',
      },
    ],
  },
  {
    id: 'days',
    title: 'Days',
    cards: [
      { id: 'vocab-jumatatu', kind: 'word', sw: 'Jumatatu', en: 'Monday' },
    ],
  },
];
const english = new Map(
  decks.flatMap((deck) =>
    deck.cards.map((card) => [card.sw, card.en as string])
  )
);

let scheduler: Scheduler;
let store: ProgressStore;
let n = 0;
beforeAll(async () => {
  scheduler = await createScheduler({ fuzz: false });
});
beforeEach(async () => {
  localStorage.clear();
  store = await ProgressStore.open({ scheduler, dbName: `study-test-${++n}` });
});
afterEach(() => store.close());

// The real grammar.
const noNani: NaniContent = { rules: nani.rules };

const setup = (
  naniContent: NaniContent = noNani,
  withDecks: VocabDeck[] = decks
) => {
  const user = userEvent.setup();
  render(<Study decks={withDecks} nani={naniContent} store={store} />);
  return user;
};

const start = () => screen.getByRole('button', { name: /^Start/ });
const promptText = () =>
  within(screen.getByTestId('flashcard')).getByText(
    (_, el) => el?.classList.contains('flashcard-prompt') ?? false
  ).textContent!;

/** Picks options on the setup screen. */
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  ...labels: (string | RegExp)[]
) => {
  for (const label of labels) await user.click(screen.getByLabelText(label));
};

describe('setup', () => {
  test('lists the decks; Practice with nothing learned offers every card as new', () => {
    setup();
    expect(screen.getByLabelText(/Numbers/)).toBeChecked();
    expect(screen.getByLabelText(/Days/)).toBeChecked();
    expect(screen.getByText('0 cards due · 4 new')).toBeInTheDocument();
    expect(start()).toHaveTextContent('Start · 4 cards');
  });

  test('choices are remembered', async () => {
    const user = setup();
    await choose(user, 'Complete deck', 'English → Swahili', /^Days/);
    expect(start()).toHaveTextContent('Start · 3 cards');
    expect(
      JSON.parse(localStorage.getItem('swahili:setup')!).vocab
    ).toMatchObject({
      deckIds: ['numbers'],
      direction: 'en-sw',
      mode: 'complete',
    });
  });

  test('no decks chosen: cannot start', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(screen.getByText('Choose at least one deck.')).toBeInTheDocument();
    expect(start()).toBeDisabled();
  });
});

describe('a Complete deck run', () => {
  test('flip, mark every card, see the summary, return to setup; progress is saved', async () => {
    const user = setup();
    await choose(user, 'Complete deck', /^Days/);
    await user.click(start());

    for (let i = 0; i < 3; i++) {
      expect(screen.getByText(`${i}/3`)).toBeInTheDocument();
      const sw = promptText();
      expect(
        screen.queryByRole('button', { name: 'Got it' })
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Show answer' }));
      expect(
        within(screen.getByTestId('flashcard')).getByText(english.get(sw)!)
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }

    expect(
      screen.getByRole('heading', { name: /Hongera!/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Got first time').nextElementSibling
    ).toHaveTextContent('3');
    expect(store.stateOf('vocab-moja:sw-en')?.reps).toBe(1);
    expect(store.stateOf('vocab-moja:en-sw')).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      await screen.findByRole('heading', { name: /Kadi za Kiswahili/ })
    ).toBeInTheDocument();

    // Everything in Numbers is now learned and not due, so Practice has nothing to offer for it.
    await choose(user, 'Practice');
    expect(screen.getByText(/Nothing due right now/)).toBeInTheDocument();
    expect(start()).toBeDisabled();
  });

  test('the answer side shows alternative spellings', async () => {
    const user = setup();
    await choose(user, 'Complete deck', /^Days/);
    await user.click(start());
    while (promptText() !== 'elfu moja') {
      await user.click(screen.getByRole('button', { name: 'Show answer' }));
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }
    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByText('alfu moja')).toBeInTheDocument();
  });

  test('a missed card comes back until it is got, and is listed at the end', async () => {
    const user = setup();
    await choose(user, 'Complete deck', /^Numbers/); // just Days: one card
    await user.click(start());

    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: 'Missed it' }));
    expect(promptText()).toBe('Jumatatu'); // back again
    expect(screen.getByText('0/1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(
      screen.getByRole('heading', { name: /Hongera!/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Missed 1 card' })
    ).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(
      (await store.reviewsOf('vocab-jumatatu:sw-en')).map((r) => r.grade)
    ).toEqual(['missed', 'got']);
  });

  test('leaving half-way offers to resume, and resuming carries on where it stopped', async () => {
    const user = setup();
    await choose(user, 'Complete deck', /^Days/);
    await user.click(start());
    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    const next = promptText();

    await user.click(screen.getByRole('button', { name: 'End session' }));
    const resume = await screen.findByRole('button', { name: 'Resume (1/3)' });
    await user.click(resume);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(promptText()).toBe(next);
  });

  test('a resumable run can be discarded', async () => {
    const user = setup();
    await choose(user, 'Complete deck', /^Days/);
    await user.click(start());
    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'End session' }));

    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(
      screen.queryByRole('button', { name: /Resume/ })
    ).not.toBeInTheDocument();
    expect(localStorage.getItem('swahili:resume')).toBeNull();
  });
});

test('keyboard: Space flips, → is Got it, ← is Missed it', async () => {
  const user = setup();
  await choose(user, 'Complete deck', /^Days/);
  await user.click(start());

  const first = promptText();
  await user.keyboard(' ');
  expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  await user.keyboard('{ArrowLeft}');
  expect(
    (
      await store.reviewsOf(
        `vocab-${first === 'elfu moja' ? 'elfu-moja' : first}:sw-en`
      )
    )[0]?.grade
  ).toBe('missed');

  await user.keyboard(' ');
  await user.keyboard('{ArrowRight}');
  expect(screen.getByText('1/3')).toBeInTheDocument();
});

test('English → Swahili shows the English first', async () => {
  const user = setup();
  await choose(user, 'English → Swahili', 'Complete deck', /^Numbers/);
  await user.click(start());
  expect(promptText()).toBe('Monday');
  await user.click(screen.getByRole('button', { name: 'Show answer' }));
  expect(screen.getByText('Jumatatu')).toBeInTheDocument();
});

test('ending a Practice session early keeps every answer given so far', async () => {
  const user = setup();
  await user.click(start());
  await user.click(screen.getByRole('button', { name: 'Show answer' }));
  await user.click(screen.getByRole('button', { name: 'Got it' }));
  await user.click(screen.getByRole('button', { name: 'End session' }));

  expect(await screen.findByText('0 cards due · 3 new')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Resume/ })
  ).not.toBeInTheDocument(); // Practice isn't resumable
});

describe('Nani na Lini?', () => {
  const verbs: VocabDeck = {
    id: 'verbs',
    title: 'Verbs',
    cards: [
      {
        id: 'verb-kusoma',
        kind: 'verb',
        sw: 'kusoma',
        en: { base: 'read', past: 'read', participle: 'read', ing: 'reading' },
      },
      // Never conjugated (rules.yaml), so never used.
      {
        id: 'verb-kuwa',
        kind: 'verb',
        sw: 'kuwa',
        en: { base: 'be', past: 'was', participle: 'been', ing: 'being' },
      },
    ],
  };
  const unlocked: NaniContent = { rules: nani.rules };
  const pickNani = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('radio', { name: 'Nani na Lini?' }));

  test('every tense can be chosen, and all are ticked to start with', async () => {
    const user = setup(unlocked, [...decks, verbs]);
    await pickNani(user);
    for (const label of [/^Present/, /^Past/, /^Future/, /^Perfect/, /^Have/]) {
      expect(screen.getByLabelText(label)).toBeEnabled();
      expect(screen.getByLabelText(label)).toBeChecked();
    }
    expect(screen.queryByText(/grammar sheets/)).not.toBeInTheDocument();
    expect(start()).toBeEnabled();
  });

  test('a past-negative run: English prompt, Swahili answer with its breakdown', async () => {
    const user = setup(unlocked, [...decks, verbs]);
    await pickNani(user);
    for (const other of [/^Present/, /^Future/, /^Perfect/, /^Have/])
      await user.click(screen.getByLabelText(other)); // past only
    await user.click(screen.getByRole('radio', { name: 'Negative' }));
    await user.click(screen.getByRole('radio', { name: 'Complete deck' }));
    expect(start()).toHaveTextContent('Start · 8 forms');
    await user.click(start());

    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      const prompt = promptText();
      seen.push(prompt);
      expect(prompt).toMatch(/didn't read$/);
      await user.click(screen.getByRole('button', { name: 'Show answer' }));
      const card = within(screen.getByTestId('flashcard'));
      expect(card.getByText('kusoma: to read')).toBeInTheDocument();
      expect(
        card.getByRole('group', { name: 'Parts of the word' })
      ).toHaveTextContent(/past/);
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }
    expect(new Set(seen).size).toBe(8); // every subject once
    expect(seen).toContain("We didn't read");
    expect(
      screen.getByRole('heading', { name: /Hongera!/ })
    ).toBeInTheDocument();
    // Progress belongs to the pattern, not the verb.
    expect(store.stateOf('nani-we-past-neg:en-sw')?.reps).toBe(1);
    expect(store.stateOf('verb-kusoma:en-sw')).toBeUndefined();
  });

  test('the answer shows the right form for the prompt', async () => {
    const user = setup(unlocked, [...decks, verbs]);
    await pickNani(user);
    await user.click(screen.getByLabelText(/^Have/));
    await user.click(screen.getByRole('radio', { name: 'Negative' }));
    await user.click(screen.getByRole('radio', { name: 'Complete deck' }));
    await user.click(start());
    while (promptText() !== "We didn't read") {
      await user.keyboard(' ');
      await user.keyboard('{ArrowRight}');
    }
    await user.keyboard(' ');
    expect(
      within(screen.getByTestId('flashcard')).getByText('hatukusoma')
    ).toBeInTheDocument();
  });

  test('have / don’t have needs no verbs at all', async () => {
    const user = setup(unlocked, decks); // no verbs anywhere, so only have / don't have
    await pickNani(user);
    await user.click(screen.getByRole('radio', { name: 'Complete deck' }));
    expect(start()).toHaveTextContent('Start · 16 forms');
    await user.click(start());
    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(
      within(screen.getByTestId('flashcard')).getByText('kuwa na: to have')
    ).toBeInTheDocument();
  });

  test('verb tenses need verbs: without any, they say so', async () => {
    const user = setup(unlocked, decks); // no verb cards
    await pickNani(user);
    expect(screen.getByLabelText(/^Past/)).toBeDisabled();
    expect(screen.getByLabelText(/^Past/).closest('label')).toHaveTextContent(
      'Needs verbs in a Vocabulary deck'
    );
  });

  test('remembers Nani na Lini? as the last deck type', async () => {
    const user = setup(unlocked, [...decks, verbs]);
    await pickNani(user);
    cleanup();
    setup(unlocked, [...decks, verbs]);
    expect(screen.getByRole('radio', { name: 'Nani na Lini?' })).toBeChecked();
  });
});
