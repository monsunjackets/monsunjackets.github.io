// Bodies of /sitemap.xml and /robots.txt (ADR 0001 §7; research §4, P0).
//
// Contract:
// - buildSitemapXml(entries) lists each page once, in the given order, by its canonical URL (canonicalUrl() in
//   seo.ts). <lastmod> appears only when the entry has one: a content date (published, updated), never the build
//   time. It is written as ISO 8601 with the Europe/Warsaw offset (dates.ts). Text is XML-escaped. A page listed
//   twice throws, since it means the endpoint collected it twice.
// - buildRobotsTxt(siteUrl) allows every crawler everywhere and names <siteUrl>/sitemap.xml.
// - Both take the site as an optional argument (a string or Astro.site), defaulting to SITE_URL, and return the
//   whole file as a string ending in a newline; the endpoints in src/pages/ only add the content type.
// No astro:* imports.

import { isoDateTime, type DateInput } from './dates.ts';
import { SITE_URL, absoluteUrl, canonicalUrl, type SiteUrl } from './seo.ts';

export interface SitemapEntry {
  /** Page path from the site root, e.g. "/kolekcja/". */
  path: string;
  /** Last real change to the content, when known. */
  lastmod?: DateInput;
}

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

export function buildSitemapXml(entries: readonly SitemapEntry[], siteUrl: SiteUrl = SITE_URL): string {
  const seen = new Set<string>();
  const urls = entries.map(({ path, lastmod }) => {
    const loc = canonicalUrl(path, siteUrl);
    if (seen.has(loc)) throw new Error(`Sitemap lists ${loc} twice`);
    seen.add(loc);
    const lastmodLine = lastmod === undefined ? '' : `\n    <lastmod>${escapeXml(isoDateTime(lastmod))}</lastmod>`;
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodLine}\n  </url>\n`;
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.join('')
    + '</urlset>\n';
}

export function buildRobotsTxt(siteUrl: SiteUrl = SITE_URL): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml', siteUrl)}\n`;
}
