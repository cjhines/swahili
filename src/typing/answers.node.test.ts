// @vitest-environment node
//
// Typing mode against the real decks: every card accepts its own answer, every Nani na Lini? form
// is told apart from the same verb's other forms, and the choices made for what else counts.
import { describe, expect, test } from 'vitest';

import { checkAnswer } from './check.ts';
import { englishForms, keysOf } from './forms.ts';
import { indexCards } from '../content/display.ts';
import { realContent } from '../content/node/real-content.ts';
import type { Direction } from '../domain.ts';
import { allPatterns, pattern } from '../nani/patterns.ts';
import type { ReviewItem } from '../session/queue.ts';
import { naniView, vocabView } from '../session/views.ts';

const { decks, rules, cards, naniVerbs } = realContent();
const vocab = vocabView(indexCards(decks), rules);
const nani = naniView(rules, naniVerbs);

const item = (
  cardId: string,
  direction: Direction,
  verbId?: string
): ReviewItem => ({
  key: `${cardId}:${direction}`,
  cardId,
  direction,
  ...(verbId && { verbId }),
});

const naniCard = (
  subject: string,
  tense: Parameters<typeof pattern>[1],
  polarity: Parameters<typeof pattern>[2],
  sw: string | undefined,
  direction: Direction
) =>
  nani(
    item(
      pattern(subject, tense, polarity).id,
      direction,
      sw && naniVerbs.find((v) => v.verb.sw === sw)!.id
    )
  )!;

test('every vocabulary card accepts what its answer side shows, both ways', () => {
  for (const card of cards)
    for (const direction of ['sw-en', 'en-sw'] as const) {
      const view = vocab(item(card.id, direction))!;
      const shown = [
        view.answer.text,
        ...(direction === 'en-sw' ? (view.answer.alt ?? []) : []),
      ];
      for (const answer of shown)
        expect(
          checkAnswer(answer, view.expected).correct,
          `${card.id} ${direction}: ${answer}`
        ).toBe(true);
    }
});

describe('Nani na Lini?', () => {
  const forms = naniVerbs.flatMap((verb) =>
    allPatterns(rules)
      .filter((p) => p.tense !== 'have')
      .map((p) => ({ p, verb }))
  );
  const have = allPatterns(rules)
    .filter((p) => p.tense === 'have')
    .map((p) => ({ p, verb: undefined }));

  test('every form accepts its own answer, both ways', () => {
    for (const { p, verb } of [...forms, ...have])
      for (const direction of ['sw-en', 'en-sw'] as const) {
        const view = nani(item(p.id, direction, verb?.id))!;
        expect(
          checkAnswer(view.answer.text, view.expected).correct,
          `${p.id} ${verb?.verb.sw ?? ''} ${direction}: ${view.answer.text}`
        ).toBe(true);
      }
  });

  // A slip can't land on another form (checkAnswer rules that out), so only exact matches can.
  const accepted = (view: ReturnType<typeof nani>) =>
    new Set(
      view!.expected.answers
        .flatMap(englishForms)
        .flatMap((form) => keysOf(form, 'en'))
    );

  test("a form's English isn't accepted for the same verb's other tenses, except the simple present", () => {
    const overlaps = new Set<string>();
    for (const verb of [...naniVerbs, undefined]) {
      const patterns = allPatterns(rules).filter((p) =>
        verb ? true : p.tense === 'have'
      );
      const keys = new Map(
        patterns.map((p) => [
          p.id,
          accepted(nani(item(p.id, 'sw-en', verb?.id))),
        ])
      );
      for (const a of patterns) {
        const typed = nani(item(a.id, 'en-sw', verb?.id))!.prompt.text;
        const typedKeys = keysOf(typed, 'en');
        for (const b of patterns) {
          if (a.tense === b.tense && a.polarity === b.polarity) continue;
          if (typedKeys.some((key) => keys.get(b.id)!.has(key)))
            overlaps.add(
              `${verb?.verb.sw}: "${typed}" (${a.tense}-${a.polarity}) for ${b.tense}-${b.polarity}`
            );
        }
      }
    }
    // Chose on purpose (2026-11-16): "we hit" counts for tunapiga, though it's also the past.
    // Only verbs whose past is spelled like their base can do this.
    expect(
      [...overlaps].every((o) => / \(past-pos\) for present-pos$/.test(o)),
      [...overlaps].join('\n')
    ).toBe(true);
    expect([...overlaps].map((o) => o.split(':')[0])).toEqual(
      expect.arrayContaining(['kupiga', 'kuacha', 'kuweka'])
    );
  });

  test.each([
    // The simple present, and "don't" in the present negative
    ['we', 'present', 'pos', 'kula', 'we eat'],
    ['heshe', 'present', 'pos', 'kula', 'she eats'],
    ['we', 'present', 'neg', 'kula', "we don't eat"],
    ['heshe', 'present', 'neg', 'kula', 'he does not eat'],
    ['they', 'present', 'pos', 'kutoka', 'they come from'],
    // "yet" is optional after haven't
    ['we', 'perfect', 'neg', 'kula', "we haven't eaten"],
    ['i', 'perfect', 'neg', 'kupata', "I haven't got it"],
    // labels are optional
    ['youpl', 'past', 'neg', 'kula', "you didn't eat"],
    ['youpl', 'past', 'neg', 'kula', "you all didn't eat"],
    ['things', 'have', 'neg', undefined, "they don't have"],
    ['heshe', 'present', 'pos', 'kuweka', 'he is putting'],
    // a slip
    ['they', 'future', 'pos', 'kusikiliza', 'they will listne'],
  ] as const)(
    '%s %s %s (%s): "%s" is right',
    (subject, tense, polarity, sw, typed) => {
      const view = naniCard(subject, tense, polarity, sw, 'sw-en');
      expect(checkAnswer(typed, view.expected).correct).toBe(true);
    }
  );

  test.each([
    // Without "yet", sijajua would be sijui: "I don't know"
    ['i', 'perfect', 'neg', 'kujua', "I don't know"],
    // A stative verb's present isn't "-ing"
    ['i', 'present', 'pos', 'kutaka', 'I am wanting'],
    // One letter from "He/she arrives", but that's alifika: "He/she arrived"
    ['heshe', 'present', 'pos', 'kufika', 'he arrived'],
    // A slip in a short word changes the subject
    ['we', 'past', 'pos', 'kula', 'he ate'],
  ] as const)(
    '%s %s %s (%s): "%s" is wrong',
    (subject, tense, polarity, sw, typed) => {
      const view = naniCard(subject, tense, polarity, sw, 'sw-en');
      expect(checkAnswer(typed, view.expected).correct).toBe(false);
    }
  );

  test('Swahili is exact: the form, nothing else', () => {
    const view = naniCard('i', 'present', 'neg', 'kula', 'en-sw');
    expect(view.answer.text).toBe('sili');
    expect(checkAnswer('sili', view.expected).correct).toBe(true);
    expect(checkAnswer('sila', view.expected).correct).toBe(false);
  });
});

test('numbers can be typed in digits', () => {
  const view = vocab(item('vocab-ishirini-na-mbili', 'sw-en'))!;
  expect(checkAnswer('22', view.expected).correct).toBe(true);
  expect(checkAnswer('twenty two', view.expected).correct).toBe(true);
});
