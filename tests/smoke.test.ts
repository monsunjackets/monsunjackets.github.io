import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEYWORDS, containsKeyword } from '../src/lib/keywords.ts';

test('every keyword is found in a title that contains it', () => {
  for (const keyword of KEYWORDS) assert.ok(containsKeyword(`Poradnik: ${keyword} krok po kroku`, keyword));
});

test('matching ignores case and non-breaking spaces', () => {
  assert.ok(containsKeyword('Kurtka Skórzana na zimę: jak ją nosić', 'kurtka skórzana na zimę'));
});

test('an inflected form is not a match', () => {
  assert.equal(containsKeyword('Kurtki skórzane na zimę', 'kurtka skórzana na zimę'), false);
});
