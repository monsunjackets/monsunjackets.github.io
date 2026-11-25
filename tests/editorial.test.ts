import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  byNewest,
  checkWayRange,
  initials,
  isListed,
  readingMinutes,
  SCALE_MAX_C,
  SCALE_MIN_C,
  shortDescription,
  WORDS_PER_MINUTE,
} from '../src/lib/editorial.ts';

test('a draft is listed in dev and left out of a production build', () => {
  const draft = { data: { draft: true } };
  assert.equal(isListed(draft, false), true);
  assert.equal(isListed(draft, true), false);
});

test('a published post is listed in both, including when the flag is absent', () => {
  for (const post of [{ data: { draft: false } }, { data: {} }, { data: { draft: undefined } }]) {
    assert.equal(isListed(post, true), true);
    assert.equal(isListed(post, false), true);
  }
});

test('posts sort newest first, and the same day falls back to the id', () => {
  const post = (id: string, published: string) => ({ id, data: { published: new Date(published) } });
  const sorted = [
    post('b', '2026-11-27'),
    post('old', '2026-11-20'),
    post('a', '2026-11-27'),
    post('new', '2026-12-01'),
  ].sort(byNewest);
  assert.deepEqual(sorted.map((p) => p.id), ['new', 'a', 'b', 'old']);
});

test('reading time rounds up to whole minutes and is at least one minute', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'słowo').join(' ');
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes(words(WORDS_PER_MINUTE)), 1);
  assert.equal(readingMinutes(words(WORDS_PER_MINUTE + 1)), 2);
  assert.equal(readingMinutes(words(WORDS_PER_MINUTE * 5)), 5);
});

test('reading time counts the words a reader reads, not the Markdown around them', () => {
  const markdown = [
    '## Do jakiej temperatury',
    '',
    'Zobacz [stronę produktu](/kolekcja/ramoneska-skorzana-z-podpinka/) i <abbr title="x">tabelę</abbr>.',
    '',
    '![Zdjęcie termometru na balkonie](./termometr.jpg)',
    '',
    '- −10°C',
    '> cytat',
    '---',
  ].join('\n');
  // Do, jakiej, temperatury, Zobacz, stronę, produktu, i, tabelę, −10°C, cytat
  const counted = 10;
  assert.equal(readingMinutes(`${markdown}\n${Array.from({ length: WORDS_PER_MINUTE - counted }, () => 'a').join(' ')}`), 1);
  assert.equal(readingMinutes(`${markdown}\n${Array.from({ length: WORDS_PER_MINUTE - counted + 1 }, () => 'a').join(' ')}`), 2);
});

test('initials take the first letter of the first two words, Polish letters included', () => {
  assert.equal(initials('Miłosz L.'), 'ML');
  assert.equal(initials('Nishanth E.'), 'NE');
  assert.equal(initials('łukasz żak'), 'ŁŻ');
  assert.equal(initials('Filip'), 'F');
  assert.equal(initials('  Anna   Maria Kowalska '), 'AM');
});

test('a short text is the description as it is, with whitespace collapsed', () => {
  assert.equal(shortDescription('  Student PWr.\n W projekcie   MONSUN prowadzi stronę. '), 'Student PWr. W projekcie MONSUN prowadzi stronę.');
});

test('a long text keeps the whole sentences that fit', () => {
  const first = `Student PWr i autor wpisu o kurtce skórzanej na zimę. ${'Pisze o pielęgnacji skóry. '.repeat(3)}`.trim();
  const text = `${first} ${'Ostatnie zdanie jest za długie, żeby się zmieścić w opisie strony. '.repeat(3)}`;
  const result = shortDescription(text);
  assert.equal(result, first);
  assert.ok([...result].length <= 160);
});

test('a sentence that ends exactly at the limit is kept whole', () => {
  const sentence = `${'a'.repeat(158)}.`; // 159 characters
  assert.equal(shortDescription(`x${sentence} Dalej.`), `x${sentence}`);
});

test('a long text without a sentence break is cut at a word, with an ellipsis, within the limit', () => {
  const text = Array.from({ length: 60 }, (_, i) => `słowo${i},`).join(' ');
  const result = shortDescription(text);
  assert.ok([...result].length <= 160, `${[...result].length} characters`);
  assert.match(result, /^słowo0, słowo1,.* słowo\d+…$/u);
});

test('a way on the scale passes; the axis ends are allowed', () => {
  checkWayRange({ name: 'Kurtka z podpinką', fromC: -10, toC: 5 });
  checkWayRange({ name: 'Cała skala', fromC: SCALE_MIN_C, toC: SCALE_MAX_C });
});

test('a way off the scale, fractional or reversed throws, naming the way', () => {
  for (const [fromC, toC] of [[-11, 5], [4, 21], [5, 5], [8, 4], [4.5, 18]] as const) {
    assert.throws(() => checkWayRange({ name: 'Sama kurtka', fromC, toC }), {
      name: 'RangeError',
      message: new RegExp(`^Sposób noszenia „Sama kurtka”: zakres ${fromC}…${toC}°C`),
    });
  }
});
