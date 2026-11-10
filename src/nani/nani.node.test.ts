// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';

import { conjugate, verbInfo, type NaniVerb } from './conjugate.ts';
import { english } from './english.ts';
import { checkFixtures } from './fixtures.ts';
import {
  allPatterns,
  patternId,
  type NaniTense,
  type Polarity,
} from './patterns.ts';
import { NaniRules, type NaniFixtures } from './schema.ts';
import { loadNaniFixtures, loadNaniRules } from '../content/node/load.ts';
import { parseYaml } from '../content/validate.ts';

let rules: NaniRules;
let fixtures: ReturnType<typeof loadNaniFixtures>;
beforeAll(() => {
  const loaded = loadNaniRules(process.cwd());
  if (!loaded.data) throw new Error(JSON.stringify(loaded.errors));
  rules = loaded.data;
  fixtures = loadNaniFixtures(process.cwd());
});

const soma: NaniVerb = {
  sw: 'kusoma',
  en: { base: 'read', past: 'read', participle: 'read', ing: 'reading' },
};
const kula: NaniVerb = {
  sw: 'kula',
  en: { base: 'eat', past: 'ate', participle: 'eaten', ing: 'eating' },
};
const kwenda: NaniVerb = {
  sw: 'kwenda',
  en: { base: 'go', past: 'went', participle: 'gone', ing: 'going' },
};

const p = (subject: string, tense: NaniTense, polarity: Polarity) => ({
  id: patternId(subject, tense, polarity),
  subject,
  tense,
  polarity,
});
const breakdown = (form: ReturnType<typeof conjugate>) =>
  form.parts.map((part) => `${part.text}:${part.label}`);

test('every fixture in fixtures.yaml comes out exactly', () => {
  expect(fixtures.errors).toEqual([]);
  const result = checkFixtures(rules, fixtures.data!, {
    path: fixtures.path,
    at: fixtures.at,
  });
  expect(result.errors).toEqual([]);
});

describe('the part breakdown', () => {
  test('ha · tu · ku · soma = not · we · past · read', () => {
    const form = conjugate(rules, p('we', 'past', 'neg'), soma);
    expect(form.sw).toBe('hatukusoma');
    expect(breakdown(form)).toEqual([
      'ha:not',
      'tu:we',
      'ku:past',
      'soma:read',
    ]);
    expect(form.parts.map((part) => part.role)).toEqual([
      'negative',
      'subject',
      'tense',
      'stem',
    ]);
  });

  test('fused negatives are one part: si · som · i', () => {
    expect(breakdown(conjugate(rules, p('i', 'present', 'neg'), soma))).toEqual(
      ['si:not + I', 'som:read', 'i:not']
    );
  });

  test('a kept ku- is its own part: ni · na · ku · la', () => {
    const form = conjugate(rules, p('i', 'present', 'pos'), kula);
    expect(breakdown(form)).toEqual(['ni:I', 'na:now', 'ku:kept', 'la:eat']);
    expect(form.parts[2]!.role).toBe('ku');
  });

  test("past negative: the verb's ku/kw is the marker: si · ku · la, si · kw · enda", () => {
    expect(breakdown(conjugate(rules, p('i', 'past', 'neg'), kula))).toEqual([
      'si:not + I',
      'ku:past',
      'la:eat',
    ]);
    expect(conjugate(rules, p('i', 'past', 'neg'), kwenda).sw).toBe('sikwenda');
  });

  test('have: tu · na = we · have', () => {
    expect(breakdown(conjugate(rules, p('we', 'have', 'pos')))).toEqual([
      'tu:we',
      'na:have',
    ]);
  });

  test('the parts always join to the whole form', () => {
    for (const pattern of allPatterns(rules)) {
      const form = conjugate(
        rules,
        pattern,
        pattern.tense === 'have' ? undefined : kula
      );
      expect(form.parts.map((part) => part.text).join('')).toBe(form.sw);
      expect(form.parts.every((part) => part.text && part.label)).toBe(true);
    }
  });
});

describe('verbInfo', () => {
  test.each([
    ['kula', 'la', true],
    ['kunywa', 'nywa', true],
    ['kuja', 'ja', true],
    ['kusoma', 'soma', false],
    ['kuosha', 'osha', false],
    ['kwenda', 'enda', true], // listed in rules.yaml
  ])('%s: stem %s, keeps ku: %s', (sw, stem, keepKu) => {
    expect(verbInfo(rules, sw)).toMatchObject({ stem, keepKu });
  });

  test('kuwa is never conjugated', () => {
    expect(verbInfo(rules, 'kuwa').exclude).toBe(true);
    expect(verbInfo(rules, 'kusoma').exclude).toBe(false);
  });
});

describe('patterns', () => {
  test('80 of them, with unique IDs', () => {
    const patterns = allPatterns(rules);
    expect(patterns).toHaveLength(80);
    expect(new Set(patterns.map((pattern) => pattern.id)).size).toBe(80);
    expect(patterns[0]!.id).toBe('nani-i-present-pos');
  });

  test('every pattern has a Swahili form and an English prompt', () => {
    for (const pattern of allPatterns(rules)) {
      const verb = pattern.tense === 'have' ? undefined : soma;
      expect(conjugate(rules, pattern, verb).sw).toMatch(/^[a-z]+$/);
      expect(english(rules, pattern, verb)).toMatch(/^[A-Z]/);
    }
  });

  test('a verb tense without a verb is a programming error', () => {
    expect(() => conjugate(rules, p('i', 'past', 'pos'))).toThrow(
      /needs a verb/
    );
    expect(() => english(rules, p('i', 'past', 'pos'))).toThrow(/needs a verb/);
  });
});

describe('checkFixtures', () => {
  test('a wrong fixture is reported with its line', () => {
    const data = structuredClone(fixtures.data!) as NaniFixtures;
    data.paradigms[0]!.neg[3] = 'hatusomu';
    const result = checkFixtures(rules, data, {
      path: fixtures.path,
      at: fixtures.at,
    });
    expect(result.errors).toEqual([
      expect.objectContaining({
        path: 'decks/nani-na-lini/fixtures.yaml',
        line: expect.any(Number),
        message:
          'kusoma present negative (we): fixture says hatusomu, rules give hatusomi',
      }),
    ]);
  });

  test('lists the tables not yet verified', () => {
    const data = structuredClone(fixtures.data!) as NaniFixtures;
    data.paradigms.forEach((table) => (table.verified = true));
    data.paradigms[1]!.verified = false;
    expect(
      checkFixtures(rules, data, { path: '', at: () => ({}) }).unverified
    ).toEqual(['kusoma past']);
  });

  test('a table with the wrong number of forms is reported', () => {
    const data = structuredClone(fixtures.data!) as NaniFixtures;
    data.paradigms[0]!.pos.pop();
    expect(
      checkFixtures(rules, data, { path: '', at: () => ({}) }).errors[0]!
        .message
    ).toMatch(/7 forms for 8 subjects/);
  });
});

describe('rules.yaml validation', () => {
  const parse = (text: string) =>
    parseYaml({ path: 'decks/nani-na-lini/rules.yaml', text }, NaniRules);
  const original = () => readFileSync('decks/nani-na-lini/rules.yaml', 'utf8');

  test('a misspelt template placeholder fails, with its line', () => {
    const result = parse(original().replace('{participle}', '{partciple}'));
    expect(result.errors[0]!.message).toMatch(
      /english\.perfect\.pos: placeholders must be one of/
    );
    expect(result.errors[0]!.line).toBeGreaterThan(1);
  });

  test('duplicate subject ids fail', () => {
    const result = parse(original().replace('{ id: we,', '{ id: you,'));
    expect(result.errors[0]!.message).toMatch(/subject ids must be unique/);
  });
});
