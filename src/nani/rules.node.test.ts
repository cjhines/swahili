// @vitest-environment node
//
// The verb quirks in rules.yaml: verbs left out of Nani na Lini?, and tenses some verbs skip.
import { describe, expect, test } from 'vitest';

import { skipReason, verbInfo } from './conjugate.ts';
import { verbFacts } from './facts.ts';
import { allPatterns } from './patterns.ts';
import { realContent } from '../content/node/real-content.ts';
import { buildSession } from '../session/start.ts';
import { seededRandom } from '../test/random.ts';

const { decks, rules, naniVerbs } = realContent();

describe('left out of Nani na Lini?, with the reason', () => {
  test.each(['kuwa', 'kuonana', 'kupa'])('%s', (sw) => {
    expect(verbInfo(rules, sw).exclude).toBe(true);
    expect(rules.verbs[sw]?.why).toBeTruthy();
    expect(naniVerbs.map((v) => v.verb.sw)).not.toContain(sw);
  });

  test('kupa needs an object, so it lists no kept ku- forms either', () => {
    expect(verbInfo(rules, 'kupa')).toMatchObject({ needsObject: true });
    expect(verbFacts(rules, 'kupa')).toEqual({ stem: 'pa', prefix: 'ku' });
  });
});

describe('perfects you would rarely hear are skipped', () => {
  test.each([
    ['kutaka', 'pos'],
    ['kutaka', 'neg'],
    ['kuhitaji', 'pos'],
    ['kuhitaji', 'neg'],
    ['kupenda', 'neg'],
    ['kuishi', 'neg'],
  ] as const)('%s perfect %s', (sw, polarity) => {
    expect(skipReason(rules, sw, { tense: 'perfect', polarity })).toBeTruthy();
  });

  test('everything else is used', () => {
    for (const [sw, tense, polarity] of [
      ['kupenda', 'perfect', 'pos'],
      ['kuishi', 'perfect', 'pos'],
      ['kutaka', 'past', 'neg'],
      ['kula', 'perfect', 'neg'],
    ] as const)
      expect(skipReason(rules, sw, { tense, polarity }), sw).toBeUndefined();
  });

  test('a session never fills a skipped pattern with that verb', () => {
    const swOf = new Map(naniVerbs.map((v) => [v.id, v.verb.sw]));
    const patterns = new Map(allPatterns(rules).map((p) => [p.id, p]));
    // Only five verbs have been met, four of them with skips, so they're picked as often as can be.
    const met = ['kutaka', 'kuhitaji', 'kupenda', 'kuishi', 'kujua'].map(
      (sw) => `verb-${sw}:`
    );
    const stateOf = (key: string) =>
      met.some((prefix) => key.startsWith(prefix)) ? ({} as never) : undefined;
    for (let seed = 1; seed <= 20; seed++) {
      const { queue } = buildSession(
        {
          kind: 'nani',
          tenses: ['perfect'],
          polarity: 'both',
          direction: 'en-sw',
          mode: 'complete',
          newCap: 10,
          repeatMisses: false,
        },
        { decks, rules, verbs: naniVerbs },
        stateOf,
        { now: new Date('2026-01-01'), random: seededRandom(seed) }
      );
      for (const item of queue) {
        const sw = swOf.get(item.verbId!)!;
        expect(
          skipReason(rules, sw, patterns.get(item.cardId)!),
          `${item.cardId} ${sw}`
        ).toBeUndefined();
      }
    }
  });
});
