import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expiredCookies,
  gaCookieNames,
  isMeasurementId,
  parseConsent,
  serializeConsent,
  showBarOnLoad,
  tagUrl,
} from './consent.ts';

const AT = '2026-11-25T14:00:00.000Z';

test('a stored choice round-trips through serialise and parse', () => {
  for (const analytics of [true, false]) {
    const raw = serializeConsent(analytics, new Date(AT));
    assert.deepEqual(JSON.parse(raw), { v: 1, analytics, at: AT });
    assert.deepEqual(parseConsent(raw), { v: 1, analytics, at: AT });
  }
});

test('nothing stored means no choice', () => {
  assert.equal(parseConsent(null), null);
});

test('a corrupt value is no choice, never consent', () => {
  for (const raw of ['', '{', 'true', '1', 'null', '"granted"', '[]', '[1,true,"x"]', 'undefined', '{"v":1,"analytics":true']) {
    assert.equal(parseConsent(raw), null, raw);
  }
});

test('a value of another version is no choice', () => {
  for (const v of [0, 2, '1', null]) {
    assert.equal(parseConsent(JSON.stringify({ v, analytics: true, at: AT })), null, `v=${String(v)}`);
  }
  assert.equal(parseConsent(JSON.stringify({ analytics: true, at: AT })), null, 'no v');
});

test('a value with a malformed field is no choice', () => {
  const cases = [
    { v: 1, analytics: 'true', at: AT },
    { v: 1, analytics: 1, at: AT },
    { v: 1, at: AT },
    { v: 1, analytics: true },
    { v: 1, analytics: true, at: 'yesterday' },
    { v: 1, analytics: true, at: 1764079200000 },
  ];
  for (const value of cases) assert.equal(parseConsent(JSON.stringify(value)), null, JSON.stringify(value));
});

test('unknown extra fields are dropped', () => {
  assert.deepEqual(parseConsent(JSON.stringify({ v: 1, analytics: false, at: AT, extra: 'x' })), { v: 1, analytics: false, at: AT });
});

test('the bar opens by itself only while there is no valid choice', () => {
  assert.equal(showBarOnLoad(null), true);
  assert.equal(showBarOnLoad(parseConsent('{')), true);
  assert.equal(showBarOnLoad(parseConsent(serializeConsent(true, new Date(AT)))), false);
  assert.equal(showBarOnLoad(parseConsent(serializeConsent(false, new Date(AT)))), false);
});

test('the GA4 cookie names drop the "G-" prefix from the measurement id', () => {
  assert.deepEqual(gaCookieNames('G-TEST000000'), ['_ga', '_ga_TEST000000']);
  assert.deepEqual(gaCookieNames('G-AB12CD34EF'), ['_ga', '_ga_AB12CD34EF']);
});

test('withdrawal expires each GA4 cookie host-only and on the site domain', () => {
  assert.deepEqual(expiredCookies('G-AB12CD34EF', 'monsunjackets.github.io'), [
    '_ga=; Max-Age=0; Path=/',
    '_ga=; Max-Age=0; Path=/; Domain=.monsunjackets.github.io',
    '_ga_AB12CD34EF=; Max-Age=0; Path=/',
    '_ga_AB12CD34EF=; Max-Age=0; Path=/; Domain=.monsunjackets.github.io',
  ]);
});

test('only GA4 measurement ids are accepted', () => {
  for (const id of ['G-TEST000000', 'G-AB12CD34EF']) assert.ok(isMeasurementId(id), id);
  for (const id of ['', 'G-', 'g-ab12cd34ef', 'UA-12345-1', 'GT-AB12CD3', 'AW-123456789', ' G-AB12CD34EF', 'G-AB12CD34EF\n', 'G-AB12&x=1']) {
    assert.equal(isMeasurementId(id), false, JSON.stringify(id));
  }
});

test('the tag loads from www.googletagmanager.com with the id as the only parameter', () => {
  assert.equal(tagUrl('G-AB12CD34EF'), 'https://www.googletagmanager.com/gtag/js?id=G-AB12CD34EF');
  assert.equal(new URL(tagUrl('G-AB12CD34EF')).origin, 'https://www.googletagmanager.com');
});
