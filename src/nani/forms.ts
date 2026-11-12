import { conjugate, skipReason, verbInfo, type NaniVerb } from './conjugate.ts';
import { english } from './english.ts';
import { verbFacts } from './facts.ts';
import { VERIFIED_SOURCE } from './fixtures.ts';
import {
  allPatterns,
  patternId,
  TENSES,
  type NaniTense,
  type Polarity,
} from './patterns.ts';
import type { NaniFixtures, NaniRules } from './schema.ts';
import { meaningOf } from '../content/display.ts';
import type { VerbEnglish, VocabCard, VocabDeck } from '../content/schema.ts';
import { keptLine } from '../session/views.ts';

// decks/nani-na-lini/forms.md: EVERYTHING Nani na Lini? can show, for review in one go: every verb
// card in every tense, all eight subjects, positive and negative, with the English and the part
// breakdown, plus what each verb's vocabulary card shows. Built from the real decks and rules, so
// a new verb card adds its tables by itself. Generated (`npm run nani:forms`); CI checks it's
// current.

export const FORMS_PATH = 'decks/nani-na-lini/forms.md';

const TENSE_TITLES: Record<NaniTense, string> = {
  present: 'Present (now)',
  past: 'Past',
  future: 'Future',
  perfect: 'Perfect (have done / not yet)',
  have: 'Have / don’t have',
};

type Table = NaniFixtures['paradigms'][number];
/** `counted: false` for a tense the verb is never used in: shown, but not a table to check. */
type Rendered = { checked: boolean; lines: string[]; counted?: false };

/** What a vocabulary card shows besides its headword, as a bullet list. */
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
  return lines;
};

export const renderForms = (
  rules: NaniRules,
  fixtures: NaniFixtures,
  decks: readonly VocabDeck[]
) => {
  const subjects = rules.subjects;
  const subjectLabel = new Map(subjects.map((s) => [s.id, s.en]));
  const fixtureFor = (verb: string | undefined, tense: NaniTense) =>
    fixtures.paradigms.find((t) => t.verb === verb && t.tense === tense);
  const cards = decks.flatMap((deck) => deck.cards);

  /** One table: the given subjects and polarities, with English and parts. */
  const table = (
    tense: NaniTense,
    verb: NaniVerb | undefined,
    subjectIds: readonly string[],
    polarities: Record<Polarity, boolean>,
    checked: boolean,
    heading: string,
    note: string | undefined
  ): Rendered => {
    const lines = [
      `${heading} ${checked ? '✅' : '⬜'} ${TENSE_TITLES[tense]}`,
      '',
    ];
    if (note) lines.push(`> ${note}`, '');
    lines.push(
      '| | Positive | | Negative | |',
      '| --- | --- | --- | --- | --- |'
    );
    for (const subject of subjectIds) {
      const cells = (['pos', 'neg'] as const).flatMap((polarity) => {
        if (!polarities[polarity]) return ['', '']; // listed for the other polarity only
        const pattern = {
          id: patternId(subject, tense, polarity),
          subject,
          tense,
          polarity,
        };
        const { parts } = conjugate(rules, pattern, verb);
        return [
          `**${parts.map((p) => p.text).join('·')}**`,
          english(rules, pattern, verb),
        ];
      });
      lines.push(
        `| ${subjectLabel.get(subject) ?? subject} | ${cells.join(' | ')} |`
      );
    }
    lines.push('');
    return { checked, lines };
  };

  /**
   * The full table for a verb (or "have") the app conjugates. ✅ only when a verified fixture
   * covers the whole of it; a partly confirmed one says which forms were confirmed.
   */
  const fullTable = (
    tense: NaniTense,
    verb: NaniVerb | undefined
  ): Rendered => {
    // rules.yaml `skip`: a tense or one polarity this verb is never used in.
    const skipped = (polarity: Polarity) =>
      verb && skipReason(rules, verb.sw, { tense, polarity });
    const [skipPos, skipNeg] = [skipped('pos'), skipped('neg')];
    if (skipPos && skipNeg)
      return {
        checked: false,
        counted: false,
        lines: [`### ${TENSE_TITLES[tense]}: not used`, '', `> ${skipPos}`, ''],
      };
    const skipNote = skipPos
      ? `Positive not used: ${skipPos}`
      : skipNeg
        ? `Negative not used: ${skipNeg}`
        : undefined;
    const fixture = fixtureFor(verb?.sw, tense);
    const whole =
      !!fixture?.verified &&
      !!fixture.pos &&
      !!fixture.neg &&
      (!fixture.subjects || fixture.subjects.length === subjects.length);
    let note = fixture?.note;
    if (fixture?.verified && !whole) {
      const source = VERIFIED_SOURCE.exec(fixture.note ?? '')?.[1];
      const rest = (fixture.note ?? '')
        .slice(source?.length ?? 0)
        .replace(/^[.:;,]?\s*/, '');
      const forms = [...(fixture.pos ?? []), ...(fixture.neg ?? [])].join(', ');
      note = `${source}: ${forms}. The rest still needs checking.${rest ? ` ${rest}` : ''}`;
    }
    return table(
      tense,
      verb,
      subjects.map((s) => s.id),
      { pos: !skipPos, neg: !skipNeg },
      whole,
      '###',
      [note, skipNote].filter(Boolean).join(' ') || undefined
    );
  };

  /** A fixture table exactly as written (for verbs the app doesn't conjugate, like kuwa). */
  const fixtureTable = (fixture: Table, verb: NaniVerb) =>
    table(
      fixture.tense,
      verb,
      fixture.subjects ?? subjects.map((s) => s.id),
      { pos: !!fixture.pos, neg: !!fixture.neg },
      fixture.verified,
      '###',
      fixture.note
    );

  type Section = { sw: string; lines: string[]; tables: Rendered[] };
  const sections: Section[] = [];

  // Every verb on a card, plus any verb only fixtures.yaml uses.
  const verbCards = new Map(
    cards.flatMap((c) => (c.kind === 'verb' ? [[c.sw, c] as const] : []))
  );
  const verbNames = [
    ...new Set([
      ...verbCards.keys(),
      ...fixtures.paradigms.flatMap((t) => (t.verb ? [t.verb] : [])),
    ]),
  ];
  for (const sw of verbNames) {
    const card = verbCards.get(sw);
    const en: VerbEnglish | undefined = card?.en ?? fixtures.verbs[sw];
    if (!en) continue; // checkFixtures reports a fixture verb with no English
    const info = verbInfo(rules, sw);
    const lines = [`## ${sw} · ${meaningOf(en)}`, ''];
    if (card) lines.push(...cardLines(rules, card), '');
    let tables: Rendered[];
    if (card && !info.exclude) {
      tables = TENSES.map((tense) => fullTable(tense, { sw, en }));
    } else {
      const why = rules.verbs[sw]?.why;
      lines.push(
        card
          ? `**Not in Nani na Lini?**${why ? ` ${why}` : ''}${
              fixtures.paradigms.some((t) => t.verb === sw)
                ? ' The forms below are the ones its card or the tutor gave.'
                : ''
            }`
          : '**Not in the app.** A test verb with no card: fixtures.yaml uses it to check the ' +
              'rules, so its tables still count.',
        ''
      );
      // Fixture English first: it's what the fixture's English lines were checked against.
      const fixtureVerb = { sw, en: fixtures.verbs[sw] ?? en };
      tables = fixtures.paradigms
        .filter((t) => t.verb === sw)
        .map((t) => fixtureTable(t, fixtureVerb));
    }
    sections.push({ sw, lines, tables });
  }

  const haveCard = cards.find((c) => c.sw === 'kuwa na');
  sections.push({
    sw: 'kuwa na',
    lines: [
      '## kuwa na · to have',
      '',
      ...(haveCard ? [...cardLines(rules, haveCard), ''] : []),
    ],
    tables: [fullTable('have', undefined)],
  });

  sections.sort((a, b) => (a.sw < b.sw ? -1 : a.sw > b.sw ? 1 : 0));

  const naniVerbNames = [...verbCards.keys()].filter(
    (sw) => !verbInfo(rules, sw).exclude
  );
  const naniVerbCount = naniVerbNames.length;
  const patterns = allPatterns(rules);
  // Every pattern for every verb, less the ones rules.yaml skips, plus have / don't have.
  const formCount = patterns.reduce(
    (sum, p) =>
      sum +
      (p.tense === 'have'
        ? 1
        : naniVerbNames.filter((sw) => !skipReason(rules, sw, p)).length),
    0
  );
  const allTables = sections
    .flatMap((s) => s.tables)
    .filter((t) => t.counted !== false);
  const checked = allTables.filter((t) => t.checked).length;
  const notes = [
    ...new Set(subjects.flatMap((s) => (s.note ? [s.note] : []))),
  ].map(
    (note) =>
      `**${subjects
        .filter((s) => s.note === note)
        .map((s) => s.en)
        .join(', ')}:** ${note}`
  );

  const out = [
    '# Nani na Lini?: every form, to check',
    '',
    '<!-- Generated from the decks, rules.yaml and fixtures.yaml by `npm run nani:forms`. Do not edit. -->',
    '',
    `This is everything Nani na Lini? can show: all ${naniVerbCount} verbs in four tenses (present,`,
    'past, future, perfect), for all eight subjects, positive and negative, plus have / don’t',
    `have. That’s ${formCount.toLocaleString('en')} forms, each with its English and its parts`,
    '(*ha·tu·ku·soma*). Each verb also shows what its vocabulary card says: meaning, stem, note,',
    'example. Verbs the app leaves out of Nani na Lini? are listed too, with the reason.',
    '',
    'Please check every table, and say which forms or English are wrong. ✅ means Chris’s tutor',
    '(or his grammar sheets) has already confirmed that whole table.',
    '',
    `**${checked} of ${allTables.length} tables checked.**`,
    '',
    ...(fixtures.questions.length
      ? [
          '## Questions from Claude',
          '',
          'Things Claude wasn’t sure of while writing these out. Please answer them along with the tables.',
          '',
          ...fixtures.questions.map((q, i) => `${i + 1}. ${q}`),
          '',
        ]
      : []),
    ...notes.flatMap((line) => [line, '']),
    `Verbs: ${sections.map((s) => s.sw).join(' · ')}`,
    '',
    ...sections.flatMap((s) => [
      ...s.lines,
      ...s.tables.flatMap((t) => t.lines),
    ]),
  ];

  return `${out.join('\n')}`;
};
