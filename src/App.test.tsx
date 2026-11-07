import { render, screen } from '@testing-library/react';
import decks from 'virtual:decks';
import { expect, test } from 'vitest';

import { App } from './App.tsx';

test('renders the placeholder heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Karibu!'
  );
});

test('lists every deck with its card count', () => {
  render(<App />);
  expect(decks.length).toBeGreaterThan(0);
  for (const deck of decks) {
    expect(screen.getByText(deck.title)).toHaveTextContent(
      `${deck.cards.length} cards`
    );
  }
});
