import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_LABEL, formatCelsius, formatNumber, formatPln, labelledAlt, linerLabel } from '../src/components/shop/format.ts';
import { cardImage, gallerySlots } from '../src/components/shop/gallery.ts';
import { linkTarget } from '../src/components/shop/links.ts';
import { linerFitNote, sizeColumns } from '../src/components/shop/sizes.ts';

const NBSP = '\u00a0';

test('prices group thousands and keep „zł” on the same line', () => {
  assert.equal(formatPln(1099), `1${NBSP}099${NBSP}zł`);
  assert.equal(formatPln(449), `449${NBSP}zł`);
  assert.equal(formatPln(1234567), `1${NBSP}234${NBSP}567${NBSP}zł`);
  assert.throws(() => formatPln(99.5), RangeError);
  assert.throws(() => formatPln(-1), RangeError);
});

test('every liner label is a plan in the future tense, never a fact about a product that exists', () => {
  assert.equal(linerLabel('included'), 'Planowany zestaw z podpinką zimową');
  assert.equal(linerLabel('compatible'), 'Będzie pasować każda podpinka MONSUN w tym samym rozmiarze');
  assert.equal(linerLabel('liner'), 'Będzie pasować do wszystkich kurtek MONSUN');
  for (const liner of ['included', 'compatible', 'liner'] as const) {
    assert.doesNotMatch(linerLabel(liner), /w zestawie|^Do |pasuje/u, liner);
  }
});

test('an AI image keeps its label in alt text shown away from the caption', () => {
  assert.equal(AI_LABEL, 'Wizualizacja AI');
  assert.equal(labelledAlt({ alt: 'Ramoneska z wpiętą podpinką', ai: true }), 'Ramoneska z wpiętą podpinką (Wizualizacja AI)');
  assert.equal(labelledAlt({ alt: 'Ramoneska z wpiętą podpinką', ai: false }), 'Ramoneska z wpiętą podpinką');
});

test('measurements use a decimal comma, temperatures a true minus and an explicit plus', () => {
  assert.equal(formatNumber(52), '52');
  assert.equal(formatNumber(52.5), '52,5');
  assert.equal(formatNumber(1100), '1100');
  assert.equal(formatCelsius(-10), '\u221210°C');
  assert.equal(formatCelsius(0), '0°C');
  assert.equal(formatCelsius(15), '+15°C');
});

type Image = { name: string; state?: 'in' | 'out' };
const image = (name: string, state?: 'in' | 'out'): Image => (state ? { name, state } : { name });
const names = (slots: ReturnType<typeof gallerySlots<Image>>) =>
  slots.map((slot) => (slot.kind === 'single' ? slot.image.name : `${slot.in.name}+${slot.out.name}`));

test('a liner pair shares one slot, with in before out, and pairs lead the gallery', () => {
  const slots = gallerySlots([image('card'), image('worn-out', 'out'), image('worn-in', 'in'), image('flat-in', 'in'), image('flat-out', 'out')]);
  assert.deepEqual(names(slots), ['worn-in+worn-out', 'flat-in+flat-out', 'card']);
  // Pairing goes by order only: the first in with the first out, the second with the second.
  const shuffled = gallerySlots([image('worn-out', 'out'), image('flat-in', 'in'), image('worn-in', 'in'), image('flat-out', 'out')]);
  assert.deepEqual(names(shuffled), ['flat-in+worn-out', 'worn-in+flat-out']);
});

test('photos without a state, and state photos without a partner, get a slot each', () => {
  assert.deepEqual(names(gallerySlots([image('a'), image('b', 'in')])), ['a', 'b']);
  assert.deepEqual(names(gallerySlots([image('x', 'out'), image('y', 'out'), image('z', 'in')])), ['z+x', 'y']);
  assert.deepEqual(names(gallerySlots([image('a'), image('b', 'in'), image('c')])), ['a', 'b', 'c'], 'singles keep content order');
  assert.deepEqual(gallerySlots([]), []);
});

test('the catalogue card shows the first image, or none', () => {
  assert.equal(cardImage([image('a'), image('b')])?.name, 'a');
  assert.equal(cardImage([]), undefined);
});

test('optional size columns appear when any size has a value', () => {
  assert.deepEqual(sizeColumns([{ size: 'S', chest: 52, back: 62 }]), { chestWithLiner: false, sleeve: false });
  assert.deepEqual(
    sizeColumns([{ size: 'S', chest: 52, back: 62 }, { size: 'M', chest: 55, chestWithLiner: 53, back: 64, sleeve: 63 }]),
    { chestWithLiner: true, sleeve: true },
  );
});

test('the fit note states only what every row of the table shows', () => {
  const row = (chest: number, chestWithLiner?: number) => ({ size: 'M', chest, chestWithLiner, back: 64 });
  assert.equal(linerFitNote([row(52, 50), row(55, 53)]), 'Z wpiętą podpinką kurtka będzie w środku o 2 cm węższa.');
  assert.equal(linerFitNote([row(52, 50), row(55.5, 52.5)]), 'Z wpiętą podpinką kurtka będzie w środku o 2–3 cm węższa.');
  assert.equal(linerFitNote([row(52.4, 50.2)]), 'Z wpiętą podpinką kurtka będzie w środku o 2,2 cm węższa.');
  assert.equal(linerFitNote([row(52, 50), row(55)]), null, 'a size without the liner width');
  assert.equal(linerFitNote([row(52, 52)]), null, 'the liner does not narrow it');
  assert.equal(linerFitNote([]), null);
});


test('links to content pages render only when the page is built', () => {
  const built = new Set(['/kolekcja/ramoneska-skorzana-z-podpinka/', '/gwarancja/']);
  assert.equal(linkTarget('/gwarancja/', built), '/gwarancja/');
  assert.equal(linkTarget('/gwarancja/#zwroty', built), '/gwarancja/#zwroty');
  assert.equal(linkTarget('/prywatnosc/', built), null);
  assert.equal(linkTarget('/o-nas/?utm_source=x', built), null);
  assert.equal(linkTarget('/kolekcja/ramoneska-skorzana-z-podpinka/', built), '/kolekcja/ramoneska-skorzana-z-podpinka/');
  assert.equal(linkTarget('/kolekcja/podpinka-pikowana/', built), null);
});

test('other links pass through for verify-dist to check', () => {
  const built = new Set<string>();
  for (const href of ['/podpinka/', '/rozmiary/', '/kolekcja/', '/', '/blog/x/', 'https://example.com/', '#lista', 'mailto:a@b.c', '//evil.example/']) {
    assert.equal(linkTarget(href, built), href);
  }
});
