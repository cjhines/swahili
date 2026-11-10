import { isNode, LineCounter, parseDocument, type Document } from 'yaml';
import type { z } from 'zod';

import { VocabDeckFile, type VocabDeck } from './schema.ts';

// Parses and validates deck files. Environment-neutral (no fs), so the Vite plugin, the
// `decks:check` script and the unit tests all run exactly the same checks.

export type DeckSource = {
  /** Repo-relative path, e.g. decks/vocab/numbers.yaml. Used in error messages. */
  path: string;
  text: string;
};

export type DeckError = {
  path: string;
  line?: number;
  col?: number;
  message: string;
};

const DECK_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const deckIdFromPath = (path: string) =>
  path
    .split('/')
    .pop()!
    .replace(/\.ya?ml$/, '');

export type Key = string | number;

const formatKeyPath = (keys: readonly Key[]) =>
  keys.reduce<string>(
    (out, key) =>
      typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${key}` : key,
    ''
  );

// Finds the closest node that exists along `keys`. For a missing field that is the object it
// should have been in, so the error points at the card rather than at the top of the file.
const positionOf = (
  doc: Document,
  lines: LineCounter,
  keys: readonly Key[]
) => {
  for (let i = keys.length; i >= 0; i--) {
    const node = doc.getIn(keys.slice(0, i), true);
    if (isNode(node) && node.range) return lines.linePos(node.range[0]);
  }
  return undefined;
};

/**
 * Parses one YAML file and validates it against a Zod schema. Every error carries file:line.
 * `at(keys)` gives the line of any node, for checks the schema can't express.
 */
export const parseYaml = <S extends z.ZodType>(
  { path, text }: DeckSource,
  schema: S
): {
  data?: z.output<S>;
  errors: DeckError[];
  at: (keys: readonly Key[]) => { line?: number; col?: number };
} => {
  // YAML 1.2 (the library default): only true/false are booleans, so `en: no` stays a string.
  const lines = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lines, uniqueKeys: true });
  const at = (keys: readonly Key[]) => positionOf(doc, lines, keys) ?? {};
  if (doc.errors.length) {
    return {
      at,
      errors: doc.errors.map((error) => {
        const pos = error.linePos?.[0];
        return {
          path,
          line: pos?.line,
          col: pos?.col,
          message: error.message.split('\n')[0]!,
        };
      }),
    };
  }

  const result = schema.safeParse(doc.toJS());
  if (!result.success) {
    return {
      at,
      errors: result.error.issues.map((issue) => {
        const keys = issue.path.filter(
          (key): key is Key => typeof key !== 'symbol'
        );
        const where = formatKeyPath(keys);
        return {
          path,
          ...at(keys),
          message: where ? `${where}: ${issue.message}` : issue.message,
        };
      }),
    };
  }
  return { data: result.data, errors: [], at };
};

export const parseDecks = (sources: readonly DeckSource[]) => {
  const decks: VocabDeck[] = [];
  const errors: DeckError[] = [];
  const seenIds = new Map<string, { path: string; line?: number }>();

  for (const source of sources) {
    const { path } = source;
    const id = deckIdFromPath(path);
    if (!DECK_ID.test(id)) {
      errors.push({
        path,
        message: `file name must be lowercase letters, digits and hyphens, e.g. time-and-dates.yaml`,
      });
    }

    const result = parseYaml(source, VocabDeckFile);
    if (!result.data) {
      errors.push(...result.errors);
      continue;
    }

    result.data.cards.forEach((card, index) => {
      const pos = result.at(['cards', index, 'id']);
      const first = seenIds.get(card.id);
      if (first) {
        const firstAt = first.line ? `${first.path}:${first.line}` : first.path;
        errors.push({
          path,
          ...pos,
          message: `duplicate ID ${card.id} (first used at ${firstAt})`,
        });
      } else {
        seenIds.set(card.id, { path, line: pos?.line });
      }
    });

    decks.push({ id, ...result.data });
  }

  return { decks, errors };
};

export const formatErrors = (errors: readonly DeckError[]) =>
  errors
    .map(
      ({ path, line, col, message }) =>
        `${path}${line ? `:${line}:${col ?? 1}` : ''}  ${message}`
    )
    .join('\n');
