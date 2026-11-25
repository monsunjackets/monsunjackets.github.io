// The `zrodlo` value of a launch-list sign-up (ADR 0001 §5): where it happened, and the campaign that brought the
// visitor when the page URL says so. The Form's Sheet stores it next to the e-mail, so it attributes sign-ups to
// posters, posts and ads without any analytics consent.
//
// Contract:
// - A source is the page's label passed by the page, e.g. "home", "podpinka" or "kolekcja/ramoneska-skorzana-z-
//   podpinka": lower-case ASCII letters, digits and . _ - /, starting and ending with a letter or digit, at most 60
//   characters. checkSource() throws on anything else, so a bad label fails the build.
// - utmValue() accepts a utm_source or utm_medium value only if, trimmed and lower-cased, it is 1–30 characters of
//   a-z, 0-9, . _ - starting with a letter or digit. Anything else is dropped whole, never trimmed down: an e-mail
//   address pasted into a link ("jan@example.com") must not reach the Sheet as "janexample.com".
// - sourceWithUtm() appends the accepted values as a query: "podpinka?utm_source=poster&utm_medium=qr". Without
//   accepted values it returns the source unchanged.
// - Nothing is stored in the browser: the campaign counts only on the page the visitor signs up on.
// No astro:* imports: Node runs the tests directly, and the browser bundle imports sourceWithUtm.

const SOURCE = /^[a-z0-9](?:[a-z0-9._/-]{0,58}[a-z0-9])?$/;
const UTM = /^[a-z0-9][a-z0-9._-]{0,29}$/;

/** The UTM parameters copied into `zrodlo`, in this order. */
export const UTM_KEYS = ['utm_source', 'utm_medium'] as const;

export function checkSource(source: string): string {
  if (!SOURCE.test(source)) {
    throw new TypeError(
      `launch-list: source ${JSON.stringify(source)} must be 1–60 lower-case ASCII letters, digits, ".", "_", "-" or "/",`
      + ' starting and ending with a letter or digit, e.g. "podpinka"',
    );
  }
  return source;
}

export function utmValue(raw: string | null): string | null {
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  return UTM.test(value) ? value : null;
}

/** `search` is a page's query string, with or without the leading "?" (as in `location.search`). */
export function sourceWithUtm(source: string, search: string): string {
  const params = new URLSearchParams(search);
  const kept: string[] = [];
  for (const key of UTM_KEYS) {
    const value = utmValue(params.get(key));
    if (value !== null) kept.push(`${key}=${value}`);
  }
  return kept.length === 0 ? source : `${source}?${kept.join('&')}`;
}
