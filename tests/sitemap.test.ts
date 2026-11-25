import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRobotsTxt, buildSitemapXml } from '../src/lib/sitemap.ts';

test('the sitemap lists canonical URLs and a lastmod only where one is known', () => {
  assert.equal(buildSitemapXml([
    { path: '/' },
    { path: '/blog/jak-dbac-o-kurtke-skorzana', lastmod: new Date('2026-11-27') },
    { path: '/o-nas/', lastmod: '2026-07-01T10:00' },
  ]), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://monsunjackets.github.io/</loc>',
    '  </url>',
    '  <url>',
    '    <loc>https://monsunjackets.github.io/blog/jak-dbac-o-kurtke-skorzana/</loc>',
    '    <lastmod>2026-11-27T00:00:00+01:00</lastmod>',
    '  </url>',
    '  <url>',
    '    <loc>https://monsunjackets.github.io/o-nas/</loc>',
    '    <lastmod>2026-07-01T10:00:00+02:00</lastmod>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n'));
});

test('an empty sitemap is still a valid urlset', () => {
  assert.equal(buildSitemapXml([]),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n');
});

test('the sitemap escapes XML special characters in a location', () => {
  const xml = buildSitemapXml([{ path: "/blog/a&b'c\"d<e>/" }]);
  const loc = /<loc>(.*)<\/loc>/.exec(xml)?.[1];
  assert.equal(loc, 'https://monsunjackets.github.io/blog/a&amp;b&apos;c%22d%3Ce%3E/');
});

test('the sitemap refuses a page listed twice, even in another spelling', () => {
  assert.throws(() => buildSitemapXml([{ path: '/kolekcja/' }, { path: '/kolekcja' }]),
    /Sitemap lists https:\/\/monsunjackets\.github\.io\/kolekcja\/ twice/);
});

test('the sitemap refuses an invalid path or date', () => {
  assert.throws(() => buildSitemapXml([{ path: 'kolekcja/' }]), TypeError);
  assert.throws(() => buildSitemapXml([{ path: '/kolekcja/', lastmod: 'wczoraj' }]), RangeError);
});

test('the sitemap takes another site, such as Astro.site', () => {
  assert.match(buildSitemapXml([{ path: '/podpinka/' }], new URL('https://example.org')),
    /<loc>https:\/\/example\.org\/podpinka\/<\/loc>/);
});

test('robots.txt allows everything and points to the sitemap', () => {
  const expected = 'User-agent: *\nAllow: /\n\nSitemap: https://monsunjackets.github.io/sitemap.xml\n';
  assert.equal(buildRobotsTxt(), expected);
  assert.equal(buildRobotsTxt('https://monsunjackets.github.io'), expected);
  assert.equal(buildRobotsTxt(new URL('https://monsunjackets.github.io/')), expected);
});

test('robots.txt refuses a site that is not an origin', () => {
  assert.throws(() => buildRobotsTxt('https://monsunjackets.github.io/repo/'), TypeError);
  assert.throws(() => buildRobotsTxt('monsunjackets.github.io'), TypeError);
});
