// @vitest-environment node
//
// forms.md is the review document: it must hold EVERY form Nani na Lini? can show, so a review
// covers everything in one go and nothing is drip-fed. Checked against the real decks and rules.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';

import { conjugate, skipReason, verbInfo } from './conjugate.ts';
import { english } from './english.ts';
import { FORMS_PATH, renderForms } from './forms.ts';
import { allPatterns, TENSES } from './patterns.ts';
import type { NaniFixtures, NaniRules } from './schema.ts';
import { loadContent } from '../content/node/content.ts';
import type { VocabDeck } from '../content/schema.ts';
import { naniVerbs, type VerbCard } from '../session/start.ts';

let rules: NaniRules;
let fixtures: NaniFixtures;
let decks: VocabDeck[];
let verbs: VerbCard[];
let md: string;
beforeAll(() => {
  const content = loadContent(process.cwd());
  rules = content.rules.data!;
  fixtures = content.fixtures.data!;
  decks = content.decks;
  verbs = naniVerbs(decks, rules);
  md = renderForms(rules, fixtures, decks);
});

/** The "## kusoma · to read" section, up to the next "## ". */
const section = (text: string, sw: string) => {
  const start = text.indexOf(`\n## ${sw} · `);
  if (start < 0) return undefined;
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end < 0 ? undefined : end);
};
const tableHeadings = (text: string) =>
  [...text.matchAll(/^### (✅|⬜) (.+)$/gm)].map((m) => m[2]);
const rows = (text: string) =>
  text
    .split('\n')
    .filter((l) => /^\| (?!---|\s\|)/.test(l) && !l.startsWith('| | '));

test('the file on disk is current', () => {
  expect(readFileSync(FORMS_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(md);
});

const TITLES = {
  present: 'Present (now)',
  past: 'Past',
  future: 'Future',
  perfect: 'Perfect (have done / not yet)',
} as const;
/** Skipped for the whole tense (both polarities) in rules.yaml. */
const tenseSkipped = (sw: string, tense: (typeof TENSES)[number]) =>
  !!skipReason(rules, sw, { tense, polarity: 'pos' }) &&
  !!skipReason(rules, sw, { tense, polarity: 'neg' });

test('every verb the app conjugates is there, in all four tenses, in order (less any it skips)', () => {
  expect(verbs.length).toBeGreaterThan(40);
  for (const { verb } of verbs) {
    const s = section(md, verb.sw);
    expect(s, verb.sw).toBeDefined();
    expect(tableHeadings(s!), verb.sw).toEqual(
      TENSES.filter((t) => !tenseSkipped(verb.sw, t)).map((t) => TITLES[t])
    );
  }
});

test('every form the app can show is in it, with its English and parts, for all 8 subjects', () => {
  const patterns = allPatterns(rules).filter((p) => p.tense !== 'have');
  let checked = 0;
  for (const { verb } of verbs) {
    const s = section(md, verb.sw)!;
    const tables = TENSES.filter((t) => !tenseSkipped(verb.sw, t)).length;
    expect(rows(s), verb.sw).toHaveLength(tables * rules.subjects.length);
    for (const pattern of patterns) {
      const parts = conjugate(rules, pattern, verb)
        .parts.map((p) => p.text)
        .join('·');
      const cell = `**${parts}** | ${english(rules, pattern, verb)} |`;
      if (skipReason(rules, verb.sw, pattern)) {
        // Never shown in the app, so not in the tables either.
        expect(s, `${verb.sw} ${pattern.id}`).not.toContain(cell);
        continue;
      }
      expect(s, `${verb.sw} ${pattern.id}`).toContain(cell);
      checked++;
    }
  }
  // have / don't have: 8 subjects × 2.
  const have = section(md, 'kuwa na')!;
  for (const pattern of allPatterns(rules).filter((p) => p.tense === 'have')) {
    expect(have).toContain(
      `**${conjugate(rules, pattern)
        .parts.map((p) => p.text)
        .join('·')}** | ${english(rules, pattern)} |`
    );
    checked++;
  }
  expect(md).toContain(`That’s ${checked.toLocaleString('en')} forms`);
});

test('each verb shows what its card says: meaning, stem, kept forms, note, example', () => {
  const kula = section(md, 'kula')!;
  expect(kula).toMatch(/^## kula · to eat$/m);
  expect(kula).toMatch(
    /^- Stem: \*la\*\. One syllable, so it keeps ku-: ninakula · nilikula · nitakula · nimekula$/m
  );
  const kuacha = section(md, 'kuacha')!;
  expect(kuacha).toMatch(/^- Note: Needs an object: ninaacha kazi/m);
  const kuelewa = section(md, 'kuelewa')!;
  expect(kuelewa).toMatch(/^- Example: \*Sielewi\.\* I don't understand\.$/m);
});

describe('verbs left out of Nani na Lini? are listed with the reason', () => {
  test.each(['kuwa', 'kuonana', 'kupa'])('%s', (sw) => {
    const s = section(md, sw)!;
    expect(s).toBeDefined();
    expect(s).toContain(`**Not in Nani na Lini?** ${rules.verbs[sw]!.why!}`);
  });

  test('kuwa keeps its tutor-confirmed tables', () => {
    const s = section(md, 'kuwa')!;
    expect(s).toMatch(/^### ✅ Present \(now\)$/m);
    expect(s).toContain('**ni·na·ku·wa** | I am becoming |');
  });

  test('every verb with a card or a fixture table has a section', () => {
    const names = new Set([
      ...decks.flatMap((d) =>
        d.cards.filter((c) => c.kind === 'verb').map((c) => c.sw)
      ),
      ...fixtures.paradigms.flatMap((t) => (t.verb ? [t.verb] : [])),
    ]);
    for (const sw of names) expect(section(md, sw), sw).toBeDefined();
    expect(verbInfo(rules, 'kupa').exclude).toBe(true);
  });
});

describe('✅ means the whole table was confirmed', () => {
  test('a partly confirmed table stays ⬜ and says which forms were confirmed', () => {
    const kunywa = section(md, 'kunywa')!;
    expect(kunywa).toMatch(/^### ⬜ Future$/m);
    expect(kunywa).toContain(
      "> Confirmed by Chris's tutor: nitakunywa. The rest still needs checking."
    );
  });

  test('a fixture covering every subject and both polarities, verified, gives ✅', () => {
    const data = structuredClone(fixtures);
    const table = data.paradigms.find(
      (t) => t.verb === 'kula' && t.tense === 'past'
    )!;
    table.verified = true;
    table.note = "Confirmed by Chris's tutor.";
    expect(section(renderForms(rules, data, decks), 'kula')).toMatch(
      /^### ✅ Past$/m
    );
  });

  test('fixture notes go on the matching table', () => {
    expect(section(md, 'kuja')).toMatch(
      /### ⬜ Perfect \(have done \/ not yet\)\n\n> Textbook forms\. In Nairobi you'll often hear sijakuja/
    );
  });

  test('the count covers every table (a tense that is not used is not a table)', () => {
    const all = md.match(/^### (✅|⬜) /gm)!.length;
    const ticked = md.match(/^### ✅/gm)?.length ?? 0;
    expect(md).toContain(`**${ticked} of ${all} tables checked.**`);
  });
});

describe('tenses and polarities rules.yaml skips are shown as not used, with the reason', () => {
  test.each([
    ['kutaka', /nimetaka and sijataka are grammatical/i],
    ['kuhitaji', /nimehitaji and sijahitaji are grammatical/i],
  ])('%s: no perfect table, just the reason', (sw, reason) => {
    const s = section(md, sw)!;
    expect(s).not.toMatch(/^### (✅|⬜) Perfect/m);
    expect(s).toMatch(/^### Perfect \(have done \/ not yet\): not used$/m);
    expect(s).toMatch(reason);
  });

  test.each([
    [
      'kupenda',
      'Sijapenda is rare.',
      '**ni·me·penda** | I like it (now) |  |  |',
    ],
    [
      'kuishi',
      'Sijaishi is odd.',
      '**ni·me·ishi** | I have lived (there) |  |  |',
    ],
  ])('%s: the perfect positive only', (sw, reason, row) => {
    const s = section(md, sw)!;
    expect(s).toContain(`> Negative not used: ${reason}`);
    expect(s).toContain(row);
  });
});

test('a new verb card adds its four tables by itself', () => {
  const extra: VocabDeck = {
    id: 'extra',
    title: 'Extra',
    cards: [
      {
        id: 'verb-kucheza',
        kind: 'verb',
        sw: 'kucheza',
        en: {
          base: 'play',
          past: 'played',
          participle: 'played',
          ing: 'playing',
        },
      },
    ],
  };
  const s = section(
    renderForms(rules, fixtures, [...decks, extra]),
    'kucheza'
  )!;
  expect(tableHeadings(s)).toHaveLength(4);
  expect(s).toContain("**ha·tu·ku·cheza** | We didn't play |");
});

describe("Claude's open questions", () => {
  test('appear at the top, numbered', () => {
    const data = structuredClone(fixtures);
    data.questions = ['Is sijala right?', 'Is sikwenda right?'];
    const out = renderForms(rules, data, decks);
    const top = out.slice(0, out.indexOf('\nVerbs: '));
    expect(top).toContain('## Questions from Claude');
    expect(top).toContain('1. Is sijala right?\n2. Is sikwenda right?');
  });

  test('none left (all answered), so no section', () => {
    expect(fixtures.questions).toEqual([]);
    expect(md).not.toContain('## Questions from Claude');
  });
});
