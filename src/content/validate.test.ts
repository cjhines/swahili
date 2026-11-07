import { describe, expect, test } from 'vitest';

import { formatErrors, parseDecks } from './validate.ts';

const deck = (path: string, body: string) => ({
  path: `decks/vocab/${path}`,
  text: body,
});

const VALID = `title: Numbers
cards:
  - id: vocab-moja
    kind: word
    sw: moja
    en: one
`;

describe('parseDecks', () => {
  test('accepts a valid deck and takes its ID from the file name', () => {
    const { decks, errors } = parseDecks([deck('numbers.yaml', VALID)]);
    expect(errors).toEqual([]);
    expect(decks).toEqual([
      {
        id: 'numbers',
        title: 'Numbers',
        cards: [{ id: 'vocab-moja', kind: 'word', sw: 'moja', en: 'one' }],
      },
    ]);
  });

  test('keeps `en: no` as a string (YAML 1.2, not the 1.1 Norway problem)', () => {
    const { decks, errors } = parseDecks([
      deck(
        'words.yaml',
        'title: Words\ncards:\n  - { id: vocab-hapana, kind: word, sw: hapana, en: no }\n'
      ),
    ]);
    expect(errors).toEqual([]);
    expect(decks[0]!.cards[0]!.en).toBe('no');
  });

  test('rejects a number where text is expected', () => {
    const { errors } = parseDecks([
      deck(
        'words.yaml',
        'title: Words\ncards:\n  - { id: vocab-kumi, kind: word, sw: kumi, en: 10 }\n'
      ),
    ]);
    expect(formatErrors(errors)).toMatch(/cards\[0\]\.en/);
  });

  test('reports a missing field at the card it belongs to, with file and line', () => {
    const text = `title: Numbers
cards:
  - id: vocab-moja
    kind: word
    sw: moja
    en: one

  - id: vocab-mbili
    kind: word
    sw: mbili
`;
    const { errors } = parseDecks([deck('numbers.yaml', text)]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      path: 'decks/vocab/numbers.yaml',
      line: 8,
    });
    expect(errors[0]!.message).toMatch(/^cards\[1\]\.en: /);
  });

  test('rejects a misspelt field instead of silently ignoring it', () => {
    const { errors } = parseDecks([
      deck(
        'n.yaml',
        'title: N\ncards:\n  - { id: vocab-kitabu, kind: noun, sw: kitabu, en: book, plurl: vitabu }\n'
      ),
    ]);
    expect(formatErrors(errors)).toMatch(/plurl/);
  });

  test('rejects badly formed IDs', () => {
    const { errors } = parseDecks([
      deck(
        'n.yaml',
        'title: N\ncards:\n  - { id: Vocab-Moja, kind: word, sw: moja, en: one }\n'
      ),
    ]);
    expect(formatErrors(errors)).toMatch(/cards\[0\]\.id: must be "vocab-"/);
  });

  test('rejects an unknown kind', () => {
    const { errors } = parseDecks([
      deck(
        'n.yaml',
        'title: N\ncards:\n  - { id: vocab-moja, kind: number, sw: moja, en: one }\n'
      ),
    ]);
    expect(formatErrors(errors)).toMatch(/kind must be noun, word or verb/);
  });

  test('requires every English form on a verb', () => {
    const verb = `title: Verbs
cards:
  - id: verb-kula
    kind: verb
    sw: kula
    en: { base: eat, past: ate, ing: eating }
    example: { sw: Ninakula., en: I am eating. }
`;
    const { errors } = parseDecks([deck('verbs.yaml', verb)]);
    expect(formatErrors(errors)).toMatch(/cards\[0\]\.en\.participle/);
  });

  test('accepts a complete verb', () => {
    const verb = `title: Verbs
cards:
  - id: verb-kwenda
    kind: verb
    sw: kwenda
    en: { base: go, past: went, participle: gone, ing: going }
    example: { sw: Ninakwenda sokoni., en: I am going to the market. }
`;
    expect(parseDecks([deck('verbs.yaml', verb)]).errors).toEqual([]);
  });

  test('fails on duplicate IDs across decks, naming both places', () => {
    const { errors } = parseDecks([
      deck('a.yaml', VALID),
      deck('b.yaml', VALID.replace('Numbers', 'Again')),
    ]);
    expect(errors).toHaveLength(1);
    expect(formatErrors(errors)).toBe(
      'decks/vocab/b.yaml:3:9  duplicate ID vocab-moja (first used at decks/vocab/a.yaml:3)'
    );
  });

  test('rejects a deck file name that is not a valid deck ID', () => {
    expect(
      parseDecks([deck('Time and Dates.yaml', VALID)]).errors[0]!.message
    ).toMatch(/file name/);
  });

  test('reports YAML syntax errors with a line number', () => {
    const { errors } = parseDecks([
      deck('broken.yaml', 'title: X\ncards:\n  - id: [unclosed\n'),
    ]);
    expect(errors[0]).toMatchObject({ path: 'decks/vocab/broken.yaml' });
    expect(errors[0]!.line).toBeGreaterThan(0);
  });

  test('rejects duplicate keys within a card', () => {
    const { errors } = parseDecks([
      deck(
        'd.yaml',
        'title: D\ncards:\n  - id: vocab-moja\n    kind: word\n    sw: moja\n    en: one\n    en: two\n'
      ),
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });
});
