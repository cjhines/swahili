import { conjugate } from './conjugate.ts';
import { english } from './english.ts';
import { patternId, type NaniTense, type Polarity } from './patterns.ts';
import type { NaniFixtures, NaniRules } from './schema.ts';

// decks/nani-na-lini/forms.md: every fixture table with English and the part breakdown, for
// checking against grammar sheets. Generated (`npm run nani:forms`); CI checks it's current.

export const FORMS_PATH = 'decks/nani-na-lini/forms.md';

const TENSE_TITLES: Record<NaniTense, string> = {
  present: 'Present (now)',
  past: 'Past',
  future: 'Future',
  perfect: 'Perfect (have done / not yet)',
  have: 'Have / don’t have',
};

export const renderForms = (rules: NaniRules, fixtures: NaniFixtures) => {
  const subjects = new Map(rules.subjects.map((s) => [s.id, s]));
  const total = fixtures.paradigms.length;
  const verified = fixtures.paradigms.filter((t) => t.verified).length;

  const out = [
    '# Nani na Lini?: the forms to check',
    '',
    '<!-- Generated from rules.yaml and fixtures.yaml by `npm run nani:forms`. Do not edit. -->',
    '',
    'Every form below is what the app will produce. Check each table against your grammar sheets;',
    'when one is right, set `verified: true` on it in `fixtures.yaml` (or tell Claude which).',
    'If one is wrong, say which: the fix goes in `rules.yaml`, and the table shows the correct forms.',
    '',
    `**${verified} of ${total} tables checked.**`,
    '',
  ];

  for (const table of fixtures.paradigms) {
    const verb = table.verb
      ? { sw: table.verb, en: fixtures.verbs[table.verb]! }
      : undefined;
    const title = `${verb ? `${verb.sw} (to ${verb.en.base})` : 'kuwa na'}: ${TENSE_TITLES[table.tense]}`;
    out.push(`## ${table.verified ? '✅' : '⬜'} ${title}`, '');
    if (table.note) out.push(`> ${table.note}`, '');
    out.push(
      '| | Positive | | Negative | |',
      '| --- | --- | --- | --- | --- |'
    );

    for (const subjectId of table.subjects ?? [...subjects.keys()]) {
      const cells = (['pos', 'neg'] as Polarity[]).flatMap((polarity) => {
        if (!table[polarity]) return ['', '']; // this table lists only the other polarity
        const pattern = {
          id: patternId(subjectId, table.tense, polarity),
          subject: subjectId,
          tense: table.tense,
          polarity,
        };
        const { parts } = conjugate(rules, pattern, verb);
        return [
          `**${parts.map((p) => p.text).join('·')}**`,
          english(rules, pattern, verb),
        ];
      });
      out.push(
        `| ${subjects.get(subjectId)?.en ?? subjectId} | ${cells.join(' | ')} |`
      );
    }
    out.push('');
  }

  return `${out.join('\n')}`;
};
