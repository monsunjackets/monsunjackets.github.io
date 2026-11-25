// Dates for pages, JSON-LD and the sitemap, always in Europe/Warsaw (ADR 0001 §3, §7; research §4, P1).
//
// Contract:
// - DateInput is a Date (an instant) or one of these strings ("T" may be a space):
//   "YYYY-MM-DD" is a calendar day in Warsaw, from local midnight;
//   "YYYY-MM-DDTHH:MM[:SS[.sss]]" is Warsaw wall-clock time;
//   the same with "Z" or "±HH:MM" is an instant.
// - A date-only front-matter value means that calendar day in Warsaw. YAML and z.coerce.date() turn "2026-11-27"
//   into a Date at 00:00:00.000 UTC, so a Date at exactly UTC midnight is read as that calendar day too. A true
//   instant at 00:00 UTC looks the same and moves to Warsaw midnight: front-matter times should carry an offset.
// - isoDateTime() gives ISO 8601 with the Warsaw offset in force at that moment, in whole seconds:
//   "2026-11-27T00:00:00+01:00", "2026-07-01T12:00:00+02:00".
// - polishDate() gives the Warsaw calendar day with the month in the genitive: "27 listopada 2026".
// - toInstant() gives the Date an input stands for, for sorting and comparing.
// - Invalid input throws a RangeError that quotes it.
// Time-zone rules come from the runtime's Intl data, which Node ships. No astro:* imports.

export type DateInput = Date | string;

export const TIME_ZONE = 'Europe/Warsaw';

const MONTHS_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
] as const;

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

function wallTimeInWarsaw(epochMs: number): WallTime {
  const part: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const { type, value } of wallClock.formatToParts(epochMs)) {
    if (type !== 'literal') part[type] = Number(value);
  }
  const { year, month, day, hour, minute, second } = part;
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined
    || second === undefined) {
    throw new RangeError(`No Warsaw wall-clock time for ${new Date(epochMs).toISOString()}`);
  }
  return { year, month, day, hour, minute, second };
}

function wallTimeAsUtc(t: WallTime): number {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}

/** Minutes east of UTC in Warsaw at that moment (60 in winter, 120 in summer). */
function warsawOffsetMinutes(epochMs: number): number {
  const wholeSecond = Math.floor(epochMs / 1000) * 1000;
  return (wallTimeAsUtc(wallTimeInWarsaw(wholeSecond)) - wholeSecond) / 60_000;
}

/**
 * The instant a Warsaw wall-clock time names. Midnight always exists exactly once; a time skipped in March resolves
 * an hour later, and a time repeated in October resolves to its second occurrence.
 */
function warsawWallTimeToEpoch(t: WallTime, ms = 0): number {
  const asUtc = wallTimeAsUtc(t) + ms;
  const guess = asUtc - warsawOffsetMinutes(asUtc) * 60_000;
  return asUtc - warsawOffsetMinutes(guess) * 60_000;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/;

function invalid(input: DateInput): RangeError {
  const shown = input instanceof Date ? 'an invalid Date' : JSON.stringify(input);
  return new RangeError(`Not a date: ${shown}. Use YYYY-MM-DD, or YYYY-MM-DDTHH:MM with an optional offset.`);
}

/** Checks that the fields name a real calendar day and time, e.g. no 31 April or 24:00. */
function validWallTime(t: WallTime): boolean {
  const back = new Date(wallTimeAsUtc(t));
  return back.getUTCFullYear() === t.year && back.getUTCMonth() === t.month - 1 && back.getUTCDate() === t.day
    && back.getUTCHours() === t.hour && back.getUTCMinutes() === t.minute && back.getUTCSeconds() === t.second;
}

function parseString(input: string): number {
  const dateOnly = DATE_ONLY.exec(input);
  const dateTime = dateOnly ? null : DATE_TIME.exec(input);
  const m = dateOnly ?? dateTime;
  if (!m) throw invalid(input);
  const t: WallTime = {
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
    hour: Number(m[4] ?? 0), minute: Number(m[5] ?? 0), second: Number(m[6] ?? 0),
  };
  if (!validWallTime(t)) throw invalid(input);
  const ms = Number((m[7] ?? '').padEnd(3, '0'));
  const zone = m[8];
  if (zone === undefined) return warsawWallTimeToEpoch(t, ms);
  if (zone === 'Z') return wallTimeAsUtc(t) + ms;
  const sign = zone.startsWith('-') ? -1 : 1;
  const [hours, minutes] = zone.slice(1).split(':').map(Number) as [number, number];
  if (hours > 23 || minutes > 59) throw invalid(input);
  return wallTimeAsUtc(t) + ms - sign * (hours * 60 + minutes) * 60_000;
}

function isUtcMidnight(date: Date): boolean {
  return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;
}

function toEpoch(input: DateInput): number {
  if (typeof input === 'string') return parseString(input);
  if (!(input instanceof Date) || Number.isNaN(input.getTime())) throw invalid(input);
  if (!isUtcMidnight(input)) return input.getTime();
  return warsawWallTimeToEpoch({
    year: input.getUTCFullYear(), month: input.getUTCMonth() + 1, day: input.getUTCDate(),
    hour: 0, minute: 0, second: 0,
  });
}

export function toInstant(input: DateInput): Date {
  return new Date(toEpoch(input));
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

export function isoDateTime(input: DateInput): string {
  const epoch = Math.floor(toEpoch(input) / 1000) * 1000;
  const t = wallTimeInWarsaw(epoch);
  const offset = (wallTimeAsUtc(t) - epoch) / 60_000;
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${pad(t.year, 4)}-${pad(t.month)}-${pad(t.day)}T${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}`
    + `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function polishDate(input: DateInput): string {
  const t = wallTimeInWarsaw(toEpoch(input));
  return `${t.day} ${MONTHS_GENITIVE[t.month - 1]} ${t.year}`;
}
