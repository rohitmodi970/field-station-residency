import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSearchPlan,
  expandSearchTerms,
  extractSearchTerms,
  scoreTextMatch,
  scoreVektoriResult,
  stemWord,
  termMatchesText,
} from '../utils/vektori/query.js';

test('extractSearchTerms removes filler words from natural questions', () => {
  assert.equal(extractSearchTerms('Do I have allergies?'), 'allergies');
  assert.equal(extractSearchTerms('what are my med timings'), 'med timings');
});

test('stemWord normalizes plural journal terms', () => {
  assert.equal(stemWord('allergies'), 'allergy');
  assert.equal(stemWord('medications'), 'medication');
});

test('expandSearchTerms links allergy-related words', () => {
  const expanded = expandSearchTerms('Do I have allergies?');
  assert.ok(expanded.includes('allergy'));
  assert.ok(expanded.includes('allergies'));
  assert.ok(expanded.includes('allergic'));
});

test('termMatchesText matches singular allergy text from plural query term', () => {
  const journalText = 'At 7 am I take a liquid homeopathic medicine for my allergy.';
  assert.equal(termMatchesText(journalText, 'allergies'), true);
  assert.equal(termMatchesText(journalText, 'allergy'), true);
});

test('termMatchesText matches medication wording from med timings query', () => {
  const journalText = 'At 6 am I need to have my meds for thyroid.';
  assert.equal(termMatchesText(journalText, 'med'), true);
  assert.equal(termMatchesText(journalText, 'medication'), true);
});

test('scoreTextMatch prefers entries that satisfy the question intent', () => {
  const allergyJournal = 'At 7 am I take a liquid homeopathic medicine for my allergy.';
  const unrelatedJournal = 'Today I went for a long intermediate run in the park.';
  const terms = ['allergies'];

  assert.ok(scoreTextMatch(allergyJournal, terms) > 0);
  assert.equal(scoreTextMatch(unrelatedJournal, terms), 0);
});

test('scoreTextMatch does not treat generic time words as medication timing matches', () => {
  const genericJournal = 'Today I spent time on my project management assignment before lunch.';
  assert.equal(scoreTextMatch(genericJournal, ['med', 'timings']), 0);
});

test('scoreVektoriResult prefers stronger journal matches', () => {
  const strong = scoreVektoriResult(
    {
      facts: [{ text: 'Title: My Meds cycle\nContent: At 6 am I take thyroid meds and allergy medicine.' }],
      episodes: [],
      sentences: [],
    },
    ['med', 'timings']
  );
  const weak = scoreVektoriResult(
    {
      facts: [{ text: 'Title: Project notes\nContent: I spent time on homework today.' }],
      episodes: [],
      sentences: [],
    },
    ['med', 'timings']
  );

  assert.ok(strong > weak);
});

test('buildSearchPlan creates alternate search queries', () => {
  const plan = buildSearchPlan('Do I have allergies?');
  assert.equal(plan.primary, 'allergies');
  assert.ok(plan.searchQueries.length >= 2);
  assert.ok(plan.expandedTerms.includes('allergy'));
});
