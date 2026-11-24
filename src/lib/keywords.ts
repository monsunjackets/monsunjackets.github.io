// SEO keywords from report section 4. A post's `keyword` must be one of these, in the form people type it.
export const KEYWORDS = [
  'kurtka skórzana na zimę',
  'kurtka skórzana z podpinką',
  'ramoneska skórzana',
  'jak dbać o kurtkę skórzaną',
  'jak dobrać rozmiar kurtki skórzanej',
] as const;

export type Keyword = (typeof KEYWORDS)[number];

/** Text as a reader sees it: NFC, every run of whitespace (NBSP included) as one space, Polish lower case. */
export function normalize(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('pl');
}

export function containsKeyword(text: string, keyword: Keyword): boolean {
  return normalize(text).includes(normalize(keyword));
}
