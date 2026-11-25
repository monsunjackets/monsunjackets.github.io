import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { KEYWORDS, containsKeyword, type Keyword } from '../src/lib/keywords.ts';

describe('containsKeyword', () => {
  test('ignores case, including Polish capitals', () => {
    for (const keyword of KEYWORDS) {
      assert.ok(containsKeyword(keyword.toLocaleUpperCase('pl'), keyword), keyword);
      assert.ok(containsKeyword(`Poradnik: ${keyword[0].toLocaleUpperCase('pl')}${keyword.slice(1)}`, keyword), keyword);
    }
    assert.ok(containsKeyword('JAK DBAĆ O KURTKĘ SKÓRZANĄ', 'jak dbać o kurtkę skórzaną'));
    assert.ok(containsKeyword('Kurtka Skórzana Z Podpinką', 'kurtka skórzana z podpinką'));
  });

  test('keeps Polish letters distinct from their bases', () => {
    assert.equal(containsKeyword('Kurtka skorzana na zime', 'kurtka skórzana na zimę'), false);
    assert.equal(containsKeyword('jak dbac o kurtke skorzana', 'jak dbać o kurtkę skórzaną'), false);
  });

  test('treats composed (NFC) and decomposed (NFD) letters as equal', () => {
    for (const keyword of KEYWORDS) {
      const decomposed = keyword.normalize('NFD');
      assert.ok(containsKeyword(decomposed, keyword), keyword);
      assert.ok(containsKeyword(decomposed.toLocaleUpperCase('pl'), keyword), keyword);
    }
    assert.ok(containsKeyword('Kurtka skórzana z podpinką', 'kurtka skórzana z podpinką'));
  });

  test('keeps the keywords in NFC, the form the schema enum compares', () => {
    for (const keyword of KEYWORDS) assert.equal(keyword, keyword.normalize('NFC'), keyword);
  });

  test('treats non-breaking and repeated spaces, tabs and line breaks as one space', () => {
    const keyword = 'jak dobrać rozmiar kurtki skórzanej';
    assert.ok(containsKeyword('Jak dobrać rozmiar kurtki skórzanej', keyword));
    assert.ok(containsKeyword('Jak dobrać rozmiar kurtki skórzanej', keyword));
    assert.ok(containsKeyword('Jak  dobrać\trozmiar\nkurtki   skórzanej', keyword));
    assert.ok(containsKeyword(`  ${keyword}  `, keyword));
  });

  test('finds the keyword inside a longer heading', () => {
    assert.ok(containsKeyword('Ramoneska skórzana: trzy rzeczy, które sprawdziłem', 'ramoneska skórzana'));
    assert.ok(containsKeyword('Zanim kupisz: kurtka skórzana na zimę', 'kurtka skórzana na zimę'));
  });

  test('does not match inflected forms', () => {
    const inflected: [string, Keyword][] = [
      ['kurtki skórzanej na zimę', 'kurtka skórzana na zimę'],
      ['Kurtkę skórzaną na zimę kupisz u nas', 'kurtka skórzana na zimę'],
      ['Kurtki skórzane na zimę', 'kurtka skórzana na zimę'],
      ['O kurtce skórzanej z podpinką', 'kurtka skórzana z podpinką'],
      ['Ramoneską skórzaną przez cały rok', 'ramoneska skórzana'],
      ['Ramoneski skórzane', 'ramoneska skórzana'],
      ['Jak dbać o kurtki skórzane', 'jak dbać o kurtkę skórzaną'],
      ['Jak dobrać rozmiar kurtek skórzanych', 'jak dobrać rozmiar kurtki skórzanej'],
    ];
    for (const [text, keyword] of inflected) assert.equal(containsKeyword(text, keyword), false, text);
  });

  test('does not match reordered words or punctuation between them', () => {
    assert.equal(containsKeyword('Skórzana kurtka na zimę', 'kurtka skórzana na zimę'), false);
    assert.equal(containsKeyword('Kurtka skórzana, na zimę', 'kurtka skórzana na zimę'), false);
    assert.equal(containsKeyword('Kurtka-skórzana na zimę', 'kurtka skórzana na zimę'), false);
  });
});
