import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoDateTime, polishDate, toInstant } from '../src/lib/dates.ts';

test('November is +01:00 and July is +02:00', () => {
  assert.equal(isoDateTime('2026-11-27T12:00:00Z'), '2026-11-27T13:00:00+01:00');
  assert.equal(isoDateTime('2026-07-01T12:00:00Z'), '2026-07-01T14:00:00+02:00');
});

test('a date-only string is that calendar day in Warsaw, from local midnight', () => {
  assert.equal(isoDateTime('2026-11-27'), '2026-11-27T00:00:00+01:00');
  assert.equal(isoDateTime('2026-07-01'), '2026-07-01T00:00:00+02:00');
  assert.equal(toInstant('2026-11-27').toISOString(), '2026-11-26T23:00:00.000Z');
});

test('a Date at UTC midnight, as YAML and z.coerce.date() give for a date-only value, is that calendar day', () => {
  assert.equal(isoDateTime(new Date('2026-11-27')), '2026-11-27T00:00:00+01:00');
  assert.equal(isoDateTime(new Date(Date.UTC(2026, 6, 1))), '2026-07-01T00:00:00+02:00');
  assert.equal(polishDate(new Date('2026-11-27')), '27 listopada 2026');
});

test('a Date that is not at UTC midnight is an instant', () => {
  assert.equal(isoDateTime(new Date('2026-11-27T00:00:01Z')), '2026-11-27T01:00:01+01:00');
  assert.equal(isoDateTime(new Date('2026-11-26T23:30:00Z')), '2026-11-27T00:30:00+01:00');
});

test('days around the switch to summer time on 29 March 2026', () => {
  assert.equal(isoDateTime('2026-03-28'), '2026-03-28T00:00:00+01:00');
  assert.equal(isoDateTime('2026-03-29'), '2026-03-29T00:00:00+01:00');
  assert.equal(isoDateTime('2026-03-30'), '2026-03-30T00:00:00+02:00');
});

test('the switch to summer time at 01:00 UTC on 29 March 2026', () => {
  assert.equal(isoDateTime('2026-03-29T00:59:59Z'), '2026-03-29T01:59:59+01:00');
  assert.equal(isoDateTime('2026-03-29T01:00:00Z'), '2026-03-29T03:00:00+02:00');
  // 02:30 does not exist in Warsaw that night; it resolves an hour later.
  assert.equal(isoDateTime('2026-03-29T02:30'), '2026-03-29T03:30:00+02:00');
});

test('days around the switch to winter time on 25 October 2026', () => {
  assert.equal(isoDateTime('2026-10-24'), '2026-10-24T00:00:00+02:00');
  assert.equal(isoDateTime('2026-10-25'), '2026-10-25T00:00:00+02:00');
  assert.equal(isoDateTime('2026-10-26'), '2026-10-26T00:00:00+01:00');
});

test('the switch to winter time at 01:00 UTC on 25 October 2026', () => {
  assert.equal(isoDateTime('2026-10-25T00:59:59Z'), '2026-10-25T02:59:59+02:00');
  assert.equal(isoDateTime('2026-10-25T01:00:00Z'), '2026-10-25T02:00:00+01:00');
});

test('a time without an offset is Warsaw wall-clock time', () => {
  assert.equal(isoDateTime('2026-11-27T09:30'), '2026-11-27T09:30:00+01:00');
  assert.equal(isoDateTime('2026-07-01 09:30:15'), '2026-07-01T09:30:15+02:00');
  assert.equal(toInstant('2026-07-01T09:30').toISOString(), '2026-07-01T07:30:00.000Z');
});

test('a time with an offset is that instant, shown in Warsaw', () => {
  assert.equal(isoDateTime('2026-11-27T09:30:00-05:00'), '2026-11-27T15:30:00+01:00');
  assert.equal(isoDateTime('2026-11-27T09:30:00.999+01:00'), '2026-11-27T09:30:00+01:00');
  assert.equal(toInstant('2026-11-27T09:30:00.5Z').getTime(), Date.UTC(2026, 10, 27, 9, 30, 0, 500));
});

test('polishDate names the Warsaw day with the month in the genitive', () => {
  const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  months.forEach((month, index) => {
    assert.equal(polishDate(`2026-${String(index + 1).padStart(2, '0')}-05`), `5 ${month} 2026`);
  });
});

test('polishDate uses the Warsaw calendar day, not the UTC one', () => {
  assert.equal(polishDate('2026-11-26T23:30:00Z'), '27 listopada 2026');
  assert.equal(polishDate('2026-12-31T23:00:00Z'), '1 stycznia 2027');
  assert.equal(polishDate('2026-07-31T22:30:00Z'), '1 sierpnia 2026');
});

test('invalid input throws a RangeError that quotes it', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-11-27T24:00', '27.11.2026', '2026-11-27T10:00+25:00',
    '']) {
    assert.throws(() => isoDateTime(value), RangeError, `accepted ${JSON.stringify(value)}`);
  }
  assert.throws(() => polishDate(new Date('nope')), /Not a date: an invalid Date/);
  assert.throws(() => toInstant('27.11.2026'), /Not a date: "27\.11\.2026"/);
});

test('toInstant returns a new Date for a Date input', () => {
  const input = new Date('2026-11-27T10:00:00Z');
  const result = toInstant(input);
  assert.notEqual(result, input);
  assert.equal(result.getTime(), input.getTime());
});
