import { describe, expect, test } from 'vitest';

import { checkIds, parseLock, updateLock } from './ids.ts';

const lock = (...lines: string[]) => `# header\n\n${lines.join('\n')}\n`;

describe('checkIds', () => {
  test('passes when the decks and the lock agree', () => {
    expect(
      checkIds(['vocab-moja', 'vocab-mbili'], lock('vocab-mbili', 'vocab-moja'))
    ).toEqual([]);
  });

  test('fails on an ID that is not in the lock yet', () => {
    expect(checkIds(['vocab-moja', 'vocab-tatu'], lock('vocab-moja'))).toEqual([
      expect.stringMatching(/new IDs not recorded yet .*: vocab-tatu$/),
    ]);
  });

  test('fails on a rename, because the old ID vanished', () => {
    const problems = checkIds(['vocab-moja-1'], lock('vocab-moja'));
    expect(problems).toEqual([
      expect.stringMatching(/new IDs/),
      expect.stringMatching(/vocab-moja is published but no card has it/),
    ]);
  });

  test('allows a deliberately deleted card once its line is marked retired', () => {
    expect(
      checkIds(['vocab-moja'], lock('vocab-moja', 'vocab-old # retired'))
    ).toEqual([]);
  });

  test('fails when a retired ID is reused', () => {
    expect(checkIds(['vocab-old'], lock('vocab-old # retired'))).toEqual([
      expect.stringMatching(/vocab-old is retired and must not be reused/),
    ]);
  });

  test('reads Windows line endings', () => {
    expect(parseLock('vocab-a\r\nvocab-b # retired\r\n')).toEqual({
      live: new Set(['vocab-a']),
      retired: new Set(['vocab-b']),
    });
  });
});

describe('updateLock', () => {
  test('adds new IDs in sorted order and keeps retired lines', () => {
    const updated = updateLock(
      ['vocab-tatu', 'vocab-moja'],
      lock('vocab-moja', 'vocab-old # retired')
    );
    expect(
      updated.split('\n').filter((line) => line && !line.startsWith('#'))
    ).toEqual(['vocab-moja', 'vocab-old # retired', 'vocab-tatu']);
  });

  test('never drops a published ID, so a rename still fails the check afterwards', () => {
    const updated = updateLock(['vocab-moja-1'], lock('vocab-moja'));
    expect(parseLock(updated).live).toEqual(
      new Set(['vocab-moja', 'vocab-moja-1'])
    );
    expect(checkIds(['vocab-moja-1'], updated)).toEqual([
      expect.stringMatching(/vocab-moja is published/),
    ]);
  });

  test('does not re-add a retired ID as live', () => {
    const updated = updateLock(['vocab-old'], lock('vocab-old # retired'));
    expect(parseLock(updated)).toEqual({
      live: new Set(),
      retired: new Set(['vocab-old']),
    });
  });

  test('is stable: updating twice changes nothing', () => {
    const once = updateLock(['vocab-b', 'vocab-a'], '');
    expect(updateLock(['vocab-b', 'vocab-a'], once)).toBe(once);
  });
});
