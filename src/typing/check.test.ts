import { describe, expect, test } from 'vitest';

import {
  checkAnswer,
  isSlip,
  markDifferences,
  type Expected,
} from './check.ts';
import { englishForms, keysOf, numberValue } from './forms.ts';

const sw = (...answers: string[]): Expected => ({ lang: 'sw', answers });
const en = (answers: string[], others: string[] = []): Expected => ({
  lang: 'en',
  answers,
  others: () => others,
});
const right = (typed: string, expected: Expected) =>
  checkAnswer(typed, expected).correct;

describe('Swahili: letter-perfect', () => {
  test.each([
    ['sisomi', 'sisomi'],
    ['Sisomi', 'sisomi'], // capitals
    ['  sisomi. ', 'sisomi'], // spaces, punctuation
    ['jumatatu', 'Jumatatu'],
    ['kumi  na moja', 'kumi na moja'],
    ['ng’ombe', "ng'ombe"], // the iPhone's curly apostrophe
  ])('%s for %s is right', (typed, answer) => {
    expect(right(typed, sw(answer))).toBe(true);
  });

  test.each([
    ['sisoma', 'sisomi'], // one letter is the grammar
    ['hatukusma', 'hatukusoma'],
    ['ngombe', "ng'ombe"],
    ['kuminamoja', 'kumi na moja'],
  ])('%s for %s is wrong', (typed, answer) => {
    expect(right(typed, sw(answer))).toBe(false);
  });

  test('alternatives on the card count', () => {
    expect(right('kusubiri', sw('kungoja', 'kusubiri'))).toBe(true);
    expect(right('alfu moja', sw('elfu moja', 'alfu moja'))).toBe(true);
  });

  test('nothing typed is giving up: wrong, with no nearest answer', () => {
    expect(checkAnswer('  ', sw('sisomi'))).toEqual({
      correct: false,
      typed: '',
      typedMarks: [],
      nearestMarks: [],
    });
  });
});

describe('English: the lenient rules', () => {
  test.each([
    // " / " separates meanings
    ['to look at', 'to look / to look at / to be careful'],
    ['be careful', 'to look / to look at / to be careful'],
    // "to", "a", "the" are optional
    ['look', 'to look / to look at / to be careful'],
    ['wait', 'to wait'],
    ['a clock', 'clock'],
    ['the clock', 'clock'],
    // contractions, with or without the apostrophe
    ['we did not read', "We didn't read"],
    ['we didnt read', "We didn't read"],
    ['We didn’t read.', "We didn't read"],
    ["we won't eat", 'We will not eat'],
    ['we wont eat', "We won't eat"],
    ['i cannot', "I can't"],
    ["I'm reading", 'I am reading'],
    ['im reading', 'I am reading'],
    ["we're reading", 'We are reading'],
    ["they've eaten", 'They have eaten'],
    ["he's eaten", 'He has eaten'],
    ["he's eating", 'He is eating'],
    // he/she
    ['he reads', 'He/she reads'],
    ['she reads', 'He/she reads'],
    ['he or she reads', 'He/she reads'],
    ['he/she reads', 'He/she reads'],
    // brackets are optional; "(plural)" may be "all"
    ['you read', 'You (plural) read'],
    ['you all read', 'You (plural) read'],
    ['it is eating', 'It (N-class) is eating'],
    ["they don't have", "They (N-class) don't have"],
    ['I am putting', 'I am putting (something)'],
    ['I am putting something', 'I am putting (something)'],
    ['I like it', 'I like it (now)'],
    // "yet" after haven't / hasn't
    ["we haven't read", "We haven't read yet"],
    ['we have not read', "We haven't read yet"],
    ["he hasn't eaten", "He/she hasn't eaten yet"],
    // numbers in digits, or without the hyphen
    ['22', 'twenty-two'],
    ['twenty two', 'twenty-two'],
    ['1000', 'one thousand'],
    ['1,000', 'one thousand'],
    ['100', 'one hundred'],
    ['0', 'zero'],
    // the second half of kutoka's present
    ['we come from', 'We are going out / we come from'],
  ])('%s for "%s" is right', (typed, answer) => {
    expect(right(typed, en([answer]))).toBe(true);
  });

  test.each([
    // "yet" stays when dropping it gives the present: sijajua is not sijui
    ["I don't know", "I don't know yet"],
    ['two', 'twenty-two'],
    ['look careful', 'to look / to look at / to be careful'],
    ['we were reading', 'We are reading'],
    ["we're", 'We are reading'],
    ['22', 'twenty-three'],
  ])('%s for "%s" is wrong', (typed, answer) => {
    expect(right(typed, en([answer]))).toBe(false);
  });

  test('a slip: one letter wrong, missing, extra or swapped, in a word of 4 letters or more', () => {
    expect(right('wiat', en(['to wait']))).toBe(true); // swapped
    expect(right('we didnt reed', en(["We didn't read"]))).toBe(true); // wrong
    expect(right('thre', en(['three']))).toBe(true); // missing
    expect(right('fourty', en(['forty']))).toBe(true); // extra
    expect(right('they are waking up', en(['They are waking up']))).toBe(true);
  });

  test('no slips in short words: there one letter is a different word', () => {
    expect(right('he read', en(['We read']))).toBe(false);
    expect(right('sxi', en(['six']))).toBe(false);
    expect(right('we did nto read', en(["We didn't read"]))).toBe(false);
  });

  test('two slips are wrong', () => {
    expect(right('wiat fro', en(['wait for']))).toBe(false);
    expect(right('thee', en(['three four']))).toBe(false);
  });

  test("a slip that spells another card's answer is that answer, not a slip", () => {
    // anasoma: "He/she reads" is one letter from "He/she read", which is alisoma.
    const anasoma = ['He/she is reading', 'He/she reads'];
    expect(right('he read', en(anasoma))).toBe(true);
    expect(right('he read', en(anasoma, ['He/she read']))).toBe(false);
    expect(right('he reeds', en(anasoma, ['He/she read']))).toBe(true);
  });

  test('a slip shows the right spelling', () => {
    expect(checkAnswer('wiat', en(['to wait']))).toEqual({
      correct: true,
      typed: 'wiat',
      typedMarks: [1, 2],
      nearest: 'wait',
      nearestMarks: [1, 2],
    });
  });

  test('exactly right needs nothing shown', () => {
    expect(checkAnswer('we did not read', en(["We didn't read"]))).toEqual({
      correct: true,
      typed: 'we did not read',
      typedMarks: [],
      nearestMarks: [],
    });
  });
});

describe('marking the letters that differ', () => {
  test('one wrong letter', () => {
    expect(markDifferences('sisoma', 'sisomi')).toEqual({
      typed: [5],
      nearest: [5],
    });
  });

  test('a missing letter is marked in the right answer only', () => {
    expect(markDifferences('kusubri', 'kusubiri')).toEqual({
      typed: [],
      nearest: [5],
    });
  });

  test('capitals, spaces and punctuation are never marked', () => {
    expect(markDifferences('we didnt read', "We didn't read.")).toEqual({
      typed: [],
      nearest: [],
    });
  });

  test('nothing is marked when the two are too different to compare', () => {
    expect(markDifferences('kitabu', 'sisomi')).toBeUndefined();
    expect(checkAnswer('kitabu', sw('sisomi'))).toEqual({
      correct: false,
      typed: 'kitabu',
      typedMarks: [],
      nearestMarks: [],
    });
  });

  test('a wrong answer shows the nearest right one, marked', () => {
    expect(checkAnswer('kusubri', sw('kungoja', 'kusubiri'))).toMatchObject({
      correct: false,
      nearest: 'kusubiri',
      typedMarks: [],
      nearestMarks: [5],
    });
  });
});

describe('the pieces', () => {
  test('englishForms', () => {
    expect(englishForms("He/she hasn't read yet")).toEqual(
      expect.arrayContaining([
        "He/she hasn't read yet",
        "He hasn't read",
        'She has not read yet',
        "He or she hasn't read",
      ])
    );
  });

  test('keysOf: "he\'s" is "he is" or "he has"', () => {
    expect(keysOf("He's read", 'en')).toEqual(['he is read', 'he has read']);
    expect(keysOf("Let's go!", 'en')).toEqual(['let us go']);
  });

  test('numberValue', () => {
    expect(numberValue('thelathini')).toBeUndefined();
    expect(numberValue('thirty-three')).toBe(33);
    expect(numberValue('one thousand')).toBe(1000);
    expect(numberValue('ninety')).toBe(90);
    expect(numberValue('to wait')).toBeUndefined();
  });

  test('isSlip', () => {
    expect(isSlip('we raed', 'we read')).toBe(true);
    expect(isSlip('he read', 'we read')).toBe(false);
    expect(isSlip('we read it', 'we read')).toBe(false);
  });
});
