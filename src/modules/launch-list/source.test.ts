import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSource, sourceWithUtm, utmValue } from './source.ts';

test('accepts page labels and paths the pages pass as source', () => {
  for (const source of ['home', 'podpinka', 'kolekcja/ramoneska-skorzana-z-podpinka', 'blog/kurtka_na-zime.2', 'a']) {
    assert.equal(checkSource(source), source);
  }
});

test('rejects a source that is empty, upper-case, non-ASCII, too long or framed by punctuation', () => {
  for (const source of ['', 'Home', 'podpinką', 'home page', '/podpinka', 'podpinka/', '-home', 'a'.repeat(61)]) {
    assert.throws(() => checkSource(source), TypeError, source);
  }
  assert.equal(checkSource('a'.repeat(60)), 'a'.repeat(60));
});

test('keeps campaign values that are short lower-case labels, normalising case and surrounding spaces', () => {
  assert.equal(utmValue('poster'), 'poster');
  assert.equal(utmValue('  Instagram '), 'instagram');
  assert.equal(utmValue('fb_ads.2026-11'), 'fb_ads.2026-11');
  assert.equal(utmValue('x'.repeat(30)), 'x'.repeat(30));
});

test('drops a campaign value whole when anything in it is outside the allowed set, never trimming it down', () => {
  for (const raw of [null, '', '   ', 'jan@example.com', 'two words', 'plakat-wrocław', '<script>', '_poster',
    'x'.repeat(31), 'a/b', 'a?b=c']) {
    assert.equal(utmValue(raw), null, String(raw));
  }
});

test('appends utm_source and utm_medium in a fixed order, as a query after the source', () => {
  assert.equal(sourceWithUtm('podpinka', '?utm_source=poster&utm_medium=qr'), 'podpinka?utm_source=poster&utm_medium=qr');
  assert.equal(sourceWithUtm('podpinka', 'utm_medium=QR&utm_source=Flyer'), 'podpinka?utm_source=flyer&utm_medium=qr');
  assert.equal(sourceWithUtm('home', '?utm_medium=social'), 'home?utm_medium=social');
});

test('returns the source alone when the URL carries no usable campaign', () => {
  assert.equal(sourceWithUtm('home', ''), 'home');
  assert.equal(sourceWithUtm('home', '?'), 'home');
  assert.equal(sourceWithUtm('home', '?fbclid=abc&utm_campaign=zima'), 'home');
  assert.equal(sourceWithUtm('home', '?utm_source=jan%40example.com'), 'home');
});

test('keeps only the accepted value when one of the two is rejected, and reads the first of repeated keys', () => {
  assert.equal(sourceWithUtm('home', '?utm_source=jan%40example.com&utm_medium=qr'), 'home?utm_medium=qr');
  assert.equal(sourceWithUtm('home', '?utm_source=poster&utm_source=flyer'), 'home?utm_source=poster');
});

test('decodes the query before checking it, so an encoded e-mail is still refused', () => {
  assert.equal(sourceWithUtm('home', '?utm_source=jan%2Bmonsun%40gmail.com'), 'home');
  assert.equal(sourceWithUtm('home', '?utm_source=poster%20a3'), 'home');
  assert.equal(sourceWithUtm('home', '?utm_source=poster+a3'), 'home');
});
