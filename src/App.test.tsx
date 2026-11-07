import 'fake-indexeddb/auto';

import { render, screen } from '@testing-library/react';
import decks from 'virtual:decks';
import { expect, test } from 'vitest';

import { App } from './App.tsx';

test('boots: opens the progress database, then shows setup with the real decks', async () => {
  render(<App />);
  expect(
    await screen.findByRole('heading', { level: 1, name: /Kadi za Kiswahili/ })
  ).toBeInTheDocument();
  for (const deck of decks) {
    expect(screen.getByText(deck.title)).toBeInTheDocument();
  }
});
