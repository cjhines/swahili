import { conjugate, skipReason, verbInfo, type NaniVerb } from './conjugate.ts';
import { english } from './english.ts';
import { keptLine, verbFacts } from './facts.ts';
import { fixtureEnglish } from './fixtures.ts';
import {
  allPatterns,
  pattern,
  TENSES,
  type NaniTense,
  type Polarity,
} from './patterns.ts';
import type { NaniFixtures, NaniRules } from './schema.ts';
import { meaningOf } from '../content/display.ts';
import type { VocabCard, VocabDeck } from '../content/schema.ts';

// decks/nani-na-lini/forms.md: everything Nani na Lini? can show, for review in one go. Every verb
// card in every tense, all subjects, positive and negative, with English and the part breakdown,
// plus what each verb's card says. Generated (`npm run nani:forms`); CI checks it's current.

export const FORMS_PATH = 'decks/nani-na-lini/forms.md';

const TITLES: Record<NaniTense, string> = {
  present: 'Present (now)',
  past: 'Past',
  future: 'Future',
  perfect: 'Perfect (have done / not yet)',
  have: 'Have / don’t have',
};

/** Lines of markdown. `checked` is set only on a table (✅ or ⬜), so tables can be counted. */
type Block = { lines: string[]; checked?: boolean };
type Fixture = NaniFixtures['paradigms'][number];

const table = (
  rules: NaniRules,
  tense: NaniTense,
  verb: NaniVerb | undefined,
  subjects: readonly string[],
  shown: Record<Polarity, boolean>,
  checked: boolean,
  note: string | undefined
): Block => {
  const label = new Map(rules.subjects.map((s) => [s.id, s.en]));
  const cells = (subject: string, polarity: Polarity) => {
    if (!shown[polarity]) return ['', ''];
    const p = pattern(subject, tense, polarity);
    const parts = conjugate(rules, p, verb).parts.map((part) => part.text);
    return [`**${parts.join('·')}**`, english(rules, p, verb)];
  };
  return {
    checked,
    lines: [
      `### ${checked ? '✅' : '⬜'} ${TITLES[tense]}`,
      '',
      ...(note ? [`> ${note}`, ''] : []),
      '| | Positive | | Negative | |',
      '| --- | --- | --- | --- | --- |',
      ...subjects.map(
        (s) =>
          `| ${label.get(s) ?? s} | ${[...cells(s, 'pos'), ...cells(s, 'neg')].join(' | ')} |`
      ),
      '',
    ],
  };
};

/** A tense the app uses: every subject, less any polarity rules.yaml skips for this verb. */
const tenseBlock = (
  rules: NaniRules,
  fixtures: NaniFixtures,
  tense: NaniTense,
  verb: NaniVerb | undefined
): Block => {
  const skip = (polarity: Polarity) =>
    verb ? skipReason(rules, verb.sw, { tense, polarity }) : undefined;
  const skipPos = skip('pos');
  const skipNeg = skip('neg');
  if (skipPos && skipNeg)
    return {
      lines: [`### ${TITLES[tense]}: not used`, '', `> ${skipPos}`, ''],
    };

  const fixture = fixtures.paradigms.find(
    (t) => t.verb === verb?.sw && t.tense === tense
  );
  const wholeTable =
    !!fixture?.verified &&
    !!fixture.pos &&
    !!fixture.neg &&
    (!fixture.subjects || fixture.subjects.length === rules.subjects.length);
  const skipNote = skipPos
    ? `Positive not used: ${skipPos}`
    : skipNeg && `Negative not used: ${skipNeg}`;
  const note = [fixture?.note, skipNote].filter(Boolean).join(' ');
  return table(
    rules,
    tense,
    verb,
    rules.subjects.map((s) => s.id),
    { pos: !skipPos, neg: !skipNeg },
    wholeTable,
    note || undefined
  );
};

/** A fixture table as written, for a verb the app doesn't conjugate (kuwa, test verbs). */
const fixtureBlock = (rules: NaniRules, fixture: Fixture, verb: NaniVerb) =>
  table(
    rules,
    fixture.tense,
    verb,
    fixture.subjects ?? rules.subjects.map((s) => s.id),
    { pos: !!fixture.pos, neg: !!fixture.neg },
    fixture.verified,
    fixture.note
  );

/** What a card shows besides its headword. */
const cardLines = (rules: NaniRules, card: VocabCard) => {
  const lines: string[] = [];
  if (card.kind === 'verb') {
    const facts = verbFacts(rules, card.sw);
    const kept = keptLine(facts);
    lines.push(`- Stem: *${facts.stem}*${kept ? `. ${kept}` : ''}`);
  }
  if (card.alt)
    lines.push(`- Also accepted: ${card.alt.map((a) => `*${a}*`).join(', ')}`);
  if (card.hint) lines.push(`- Hint (English → Swahili): ${card.hint}`);
  if (card.example)
    lines.push(`- Example: *${card.example.sw}* ${card.example.en}`);
  if (card.note) lines.push(`- Note: ${card.note}`);
  return lines.length ? [...lines, ''] : [];
};

type Section = { sw: string; blocks: Block[] };

const verbSection = (
  rules: NaniRules,
  fixtures: NaniFixtures,
  verb: NaniVerb,
  card: VocabCard | undefined
): Section => {
  const intro: string[] = [`## ${verb.sw} · ${meaningOf(verb.en)}`, ''];
  if (card) intro.push(...cardLines(rules, card));

  if (card && !verbInfo(rules, verb.sw).exclude)
    return {
      sw: verb.sw,
      blocks: [
        { lines: intro },
        ...TENSES.map((tense) => tenseBlock(rules, fixtures, tense, verb)),
      ],
    };

  const why = rules.verbs[verb.sw]?.why;
  intro.push(
    card
      ? `**Not in Nani na Lini?**${why ? ` ${why}` : ''}`
      : '**Not in the app.** A test verb with no card: fixtures.yaml uses it to check the rules.',
    ''
  );
  return {
    sw: verb.sw,
    blocks: [
      { lines: intro },
      ...fixtures.paradigms
        .filter((t) => t.verb === verb.sw)
        .map((t) => fixtureBlock(rules, t, verb)),
    ],
  };
};

/** How many forms the app can show: every pattern for every verb it uses, less skips. */
const formCount = (rules: NaniRules, verbs: readonly string[]) =>
  allPatterns(rules).reduce(
    (sum, p) =>
      sum +
      (p.tense === 'have'
        ? 1
        : verbs.filter((sw) => !skipReason(rules, sw, p)).length),
    0
  );

export const renderForms = (
  rules: NaniRules,
  fixtures: NaniFixtures,
  decks: readonly VocabDeck[]
) => {
  const cards = decks.flatMap((deck) => deck.cards);
  const verbCards = new Map(
    cards.flatMap((c) => (c.kind === 'verb' ? [[c.sw, c] as const] : []))
  );
  const verbOf = fixtureEnglish(fixtures, decks);
  // Every verb on a card, plus any test verb only fixtures.yaml uses.
  const names = new Set([
    ...verbCards.keys(),
    ...fixtures.paradigms.flatMap((t) => (t.verb ? [t.verb] : [])),
  ]);
  const sections = [...names].flatMap((sw) => {
    const verb = verbOf(sw);
    return verb ? [verbSection(rules, fixtures, verb, verbCards.get(sw))] : [];
  });
  const haveCard = cards.find((c) => c.sw === 'kuwa na');
  sections.push({
    sw: 'kuwa na',
    blocks: [
      {
        lines: [
          '## kuwa na · to have',
          '',
          ...(haveCard ? cardLines(rules, haveCard) : []),
        ],
      },
      tenseBlock(rules, fixtures, 'have', undefined),
    ],
  });
  sections.sort((a, b) => (a.sw < b.sw ? -1 : a.sw > b.sw ? 1 : 0));

  const used = [...verbCards.keys()].filter(
    (sw) => !verbInfo(rules, sw).exclude
  );
  const tables = sections
    .flatMap((s) => s.blocks)
    .filter((b) => b.checked !== undefined);
  const checked = tables.filter((b) => b.checked).length;
  const subjectNotes = [
    ...new Set(rules.subjects.flatMap((s) => (s.note ? [s.note] : []))),
  ].map((note) => {
    const who = rules.subjects.filter((s) => s.note === note).map((s) => s.en);
    return `**${who.join(', ')}:** ${note}`;
  });

  return [
    '# Nani na Lini?: every form, to check',
    '',
    '<!-- Generated from the decks, rules.yaml and fixtures.yaml by `npm run nani:forms`. Do not edit. -->',
    '',
    `This is everything Nani na Lini? can show: all ${used.length} verbs in four tenses (present,`,
    'past, future, perfect), for all eight subjects, positive and negative, plus have / don’t',
    `have. That’s ${formCount(rules, used).toLocaleString('en')} forms, each with its English and its parts`,
    '(*ha·tu·ku·soma*). Each verb also shows what its vocabulary card says: meaning, stem, note,',
    'example. Verbs the app leaves out of Nani na Lini? are listed too, with the reason.',
    '',
    'Please check every table, and say which forms or English are wrong. ✅ marks a table',
    'that has already been confirmed.',
    '',
    `**${checked} of ${tables.length} tables checked.**`,
    '',
    ...(fixtures.questions.length
      ? [
          '## Open questions',
          '',
          'Please answer these along with the tables.',
          '',
          ...fixtures.questions.map((q, i) => `${i + 1}. ${q}`),
          '',
        ]
      : []),
    ...subjectNotes.flatMap((line) => [line, '']),
    `Verbs: ${sections.map((s) => s.sw).join(' · ')}`,
    '',
    ...sections.flatMap((s) => s.blocks.flatMap((b) => b.lines)),
  ].join('\n');
};
