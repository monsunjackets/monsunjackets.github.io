// Links from product content to pages that exist only when their content does.
//
// A product benefit links its proof to a page on this site (research §5). Some of those pages are generated from
// content that lands in other chunks: a product page needs its product entry, and /o-nas/, /gwarancja/ and
// /prywatnosc/ need their page entry and the generic page route. Until such a page is built, the proof is shown
// without its link, so the site never ships a dead link (verify-dist rule missing-target).
// Every other href is returned unchanged; verify-dist still checks it.
// Pure functions with no astro:* imports, so Node runs them in tests.

/** Generic pages generated from the `pages` collection by `src/pages/[page].astro` (plan 0002, B5). */
export const GENERIC_PAGES = ['o-nas', 'gwarancja', 'prywatnosc'] as const;

const CONTENT_PAGE = new RegExp(`^/(?:kolekcja/[^/]+|${GENERIC_PAGES.join('|')})/$`);

/**
 * `href` when it can be linked, or null when it points to a content-dependent page missing from `built`
 * (paths such as "/gwarancja/"). The query and fragment are ignored for the check and kept in the result.
 */
export function linkTarget(href: string, built: ReadonlySet<string>): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const { pathname } = new URL(href, 'https://monsun.invalid');
  return CONTENT_PAGE.test(pathname) && !built.has(pathname) ? null : href;
}
