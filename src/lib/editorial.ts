// Helpers for the editorial pages: the blog, the author pages and the content pages (plan 0002, chunk B5).
//
// Contract:
// - isListed(post, production): drafts appear in `astro dev` only. A production build leaves them out of every
//   page, list and link, so every route and list that shows posts filters through this one rule.
// - byNewest: a sort comparator, newest `published` first; posts published on the same day keep a stable order
//   by id.
// - readingMinutes(markdown): whole minutes at 200 words a minute, at least 1. Link targets, image sources,
//   HTML tags and Markdown punctuation are not words.
// - initials(name): the avatar letters for a display name, „Miłosz L.” → „ML”.
// - shortDescription(text): a meta description from free text such as an author's bio: the text when it fits in
//   160 characters, otherwise the whole sentences that fit, otherwise whole words followed by „…”.
// - checkWayRange(way): the /podpinka/ scale draws whole degrees from SCALE_MIN_C to SCALE_MAX_C; a way outside
//   that axis, with a fractional bound or with from ≥ to throws, naming the way, instead of drawing a wrong bar.
// No astro:* imports, so Node runs these in tests.

import { toInstant } from './dates.ts';
import { DESCRIPTION_MAX_LENGTH } from './seo.ts';

export interface DraftFlag {
  data: { draft?: boolean | undefined };
}

export function isListed(post: DraftFlag, production: boolean): boolean {
  return !(production && post.data.draft === true);
}

export interface Dated {
  id: string;
  data: { published: Date };
}

export function byNewest(a: Dated, b: Dated): number {
  const diff = toInstant(b.data.published).getTime() - toInstant(a.data.published).getTime();
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export const WORDS_PER_MINUTE = 200;

export function readingMinutes(markdown: string): number {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images: the alt text is not read
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links: keep the text, drop the target
    .replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function initials(name: string): string {
  return name
    .split(/\s+/u)
    .map((part) => part.match(/\p{L}/u)?.[0] ?? '')
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('pl');
}

export function shortDescription(text: string, max = DESCRIPTION_MAX_LENGTH): string {
  const clean = text.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const chars = [...clean];
  if (chars.length <= max) return clean;
  const head = chars.slice(0, max).join('');
  if (/[.!?]$/u.test(head) && chars[max] === ' ') return head;
  const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentenceEnd > 0) return head.slice(0, sentenceEnd + 1);
  const room = chars.slice(0, max - 1).join('');
  const space = room.lastIndexOf(' ');
  return `${(space > 0 ? room.slice(0, space) : room).replace(/[\s,;:–-]+$/u, '')}…`;
}

export const SCALE_MIN_C = -10;
export const SCALE_MAX_C = 20;

export interface WayRange {
  name: string;
  fromC: number;
  toC: number;
}

export function checkWayRange(way: WayRange): void {
  const { name, fromC, toC } = way;
  const whole = Number.isInteger(fromC) && Number.isInteger(toC);
  if (!whole || fromC < SCALE_MIN_C || toC > SCALE_MAX_C || fromC >= toC) {
    throw new RangeError(
      `Sposób noszenia „${name}”: zakres ${fromC}…${toC}°C nie mieści się na skali. ` +
        `Podaj pełne stopnie od ${SCALE_MIN_C} do ${SCALE_MAX_C}, „od” mniejsze niż „do”.`,
    );
  }
}
