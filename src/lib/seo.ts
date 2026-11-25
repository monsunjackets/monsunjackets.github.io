// Page-level SEO basics (ADR 0001 §2, §7; research §4, P0): absolute URLs and guards on the title and the meta
// description. Base.astro switches to these later.
//
// Contract:
// - SITE_URL is the production origin and must equal `site` in astro.config.ts (tests/seo.test.ts checks it).
//   Every function that builds a URL also takes the site as an optional last argument (a string or Astro.site).
// - canonicalUrl(path) takes a path from the site root ("/kolekcja/x") and returns the absolute URL ending in "/".
//   The query and the fragment are dropped and dot segments resolved. A last segment with a file extension
//   ("/404.html", "/sitemap.xml") is a file, not a page, and keeps its form.
// - absoluteUrl(pathOrUrl) resolves a site-root path without touching its end, and returns an absolute http(s)
//   URL as it is: for images and other files.
// - Anything that is not a site-root path or an http(s) URL throws, and so does a path that would leave the site.
// - checkTitle() and checkDescription() return the text in NFC with every whitespace run collapsed to one space,
//   or throw when it is empty or longer than 70 or 160 characters (the post schema's limits, counted in code
//   points). The title limit applies to the page's own title; pageTitle() adds the brand suffix after the check,
//   on every page but the home page.
// Pure functions with no astro:* imports, so Node runs them in tests.

export const SITE_URL = 'https://monsunjackets.github.io';
export const BRAND = 'MONSUN';
export const TITLE_MAX_LENGTH = 70;
export const DESCRIPTION_MAX_LENGTH = 160;

export type SiteUrl = string | URL;

/** The site's origin as a URL; refuses anything with a path, query, fragment or credentials. */
function siteBase(site: SiteUrl): URL {
  const url = new URL(String(site));
  const bare = url.pathname === '/' && url.search === '' && url.hash === '' && url.username === '' && url.password === '';
  if (!/^https?:$/.test(url.protocol) || !bare) {
    throw new TypeError(`Expected a site origin such as "${SITE_URL}", got ${JSON.stringify(String(site))}`);
  }
  return url;
}

/** Resolves a path from the site root against the site and refuses anything that would end up elsewhere. */
function resolvePath(path: string, site: SiteUrl): URL {
  const base = siteBase(site);
  if (!path.startsWith('/')) {
    throw new TypeError(`Expected a path from the site root, such as "/kolekcja/", got ${JSON.stringify(path)}`);
  }
  // URL parsing turns "\" into "/" and drops tabs and newlines, so "/\evil.example" would leave the site.
  const url = new URL(path, base);
  if (url.origin !== base.origin) {
    throw new TypeError(`Path ${JSON.stringify(path)} leaves the site ${base.origin}`);
  }
  return url;
}

function isFileName(segment: string): boolean {
  return segment.includes('.');
}

export function canonicalUrl(path: string, site: SiteUrl = SITE_URL): string {
  const url = resolvePath(path, site);
  url.search = '';
  url.hash = '';
  const last = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  if (last !== '' && !isFileName(last)) url.pathname += '/';
  return url.href;
}

export function absoluteUrl(pathOrUrl: string, site: SiteUrl = SITE_URL): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return new URL(pathOrUrl).href;
  return resolvePath(pathOrUrl, site).href;
}

function checkText(kind: string, text: string, max: number): string {
  const clean = text.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const length = [...clean].length;
  if (length === 0) throw new RangeError(`${kind} is empty`);
  if (length > max) throw new RangeError(`${kind} has ${length} characters, the limit is ${max}: ${JSON.stringify(clean)}`);
  return clean;
}

export function checkTitle(title: string): string {
  return checkText('Title', title, TITLE_MAX_LENGTH);
}

export function checkDescription(description: string): string {
  return checkText('Description', description, DESCRIPTION_MAX_LENGTH);
}

/** The <title> text: the checked page title, plus " | MONSUN" everywhere but the home page. */
export function pageTitle(title: string, path: string): string {
  const clean = checkTitle(title);
  return resolvePath(path, SITE_URL).pathname === '/' ? clean : `${clean} | ${BRAND}`;
}
