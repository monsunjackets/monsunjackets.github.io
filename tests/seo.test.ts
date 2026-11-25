import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DESCRIPTION_MAX_LENGTH, SITE_URL, TITLE_MAX_LENGTH, absoluteUrl, canonicalUrl, checkDescription, checkTitle,
  pageTitle,
} from '../src/lib/seo.ts';

test('SITE_URL matches site in astro.config.ts', () => {
  const config = readFileSync(new URL('../astro.config.ts', import.meta.url), 'utf8');
  const site = /\bsite:\s*'([^']+)'/.exec(config)?.[1];
  assert.ok(site, 'astro.config.ts has no literal site; point SITE_URL in src/lib/seo.ts at the shared config');
  assert.equal(SITE_URL, site);
});

test('canonicalUrl makes a page path absolute with a trailing slash', () => {
  assert.equal(canonicalUrl('/'), 'https://monsunjackets.github.io/');
  assert.equal(canonicalUrl('/podpinka/'), 'https://monsunjackets.github.io/podpinka/');
  assert.equal(
    canonicalUrl('/kolekcja/ramoneska-skorzana-z-podpinka'),
    'https://monsunjackets.github.io/kolekcja/ramoneska-skorzana-z-podpinka/',
  );
});

test('canonicalUrl drops the query and the fragment and resolves dot segments', () => {
  assert.equal(canonicalUrl('/podpinka/?utm_source=poster&utm_medium=qr'), 'https://monsunjackets.github.io/podpinka/');
  assert.equal(canonicalUrl('/podpinka#lista'), 'https://monsunjackets.github.io/podpinka/');
  assert.equal(canonicalUrl('/blog/../o-nas'), 'https://monsunjackets.github.io/o-nas/');
});

test('canonicalUrl keeps a file path as it is', () => {
  assert.equal(canonicalUrl('/404.html'), 'https://monsunjackets.github.io/404.html');
  assert.equal(canonicalUrl('/sitemap.xml'), 'https://monsunjackets.github.io/sitemap.xml');
});

test('canonicalUrl percent-encodes characters outside ASCII', () => {
  assert.equal(canonicalUrl('/blog/żółw'), 'https://monsunjackets.github.io/blog/%C5%BC%C3%B3%C5%82w/');
});

test('canonicalUrl takes another site, such as Astro.site', () => {
  assert.equal(canonicalUrl('/o-nas', new URL('http://127.0.0.1:4321')), 'http://127.0.0.1:4321/o-nas/');
  assert.equal(canonicalUrl('/o-nas', 'https://example.org/'), 'https://example.org/o-nas/');
});

test('canonicalUrl refuses anything that is not a site-root path', () => {
  for (const path of ['', 'kolekcja/', 'https://monsunjackets.github.io/', '//evil.example/', '/\\evil.example/',
    '/\t/evil.example/']) {
    assert.throws(() => canonicalUrl(path), TypeError, `accepted ${JSON.stringify(path)}`);
  }
});

test('canonicalUrl refuses a site with a path, a query or another scheme', () => {
  for (const site of ['https://example.org/repo/', 'https://example.org/?a=1', 'ftp://example.org/', 'example.org']) {
    assert.throws(() => canonicalUrl('/', site), TypeError, `accepted ${site}`);
  }
});

test('absoluteUrl resolves a path as it is and passes an http(s) URL through', () => {
  assert.equal(absoluteUrl('/_astro/ramoneska.Ab12.webp'), 'https://monsunjackets.github.io/_astro/ramoneska.Ab12.webp');
  assert.equal(absoluteUrl('/og-default.png'), 'https://monsunjackets.github.io/og-default.png');
  assert.equal(absoluteUrl('https://www.instagram.com/monsunjackets'), 'https://www.instagram.com/monsunjackets');
});

test('absoluteUrl refuses other schemes and relative paths', () => {
  for (const value of ['javascript:alert(1)', 'data:image/png;base64,AA', 'img/a.png', '//evil.example/a.png']) {
    assert.throws(() => absoluteUrl(value), TypeError, `accepted ${value}`);
  }
});

test('checkTitle collapses whitespace and allows exactly the limit', () => {
  assert.equal(checkTitle('  Jak dbać\no  kurtkę\u00a0skórzaną  '), 'Jak dbać o kurtkę skórzaną');
  const atLimit = 'ż'.repeat(TITLE_MAX_LENGTH);
  assert.equal(checkTitle(atLimit), atLimit);
});

test('checkTitle counts a decomposed Polish letter as one character', () => {
  const decomposed = 'z\u0307'.repeat(TITLE_MAX_LENGTH);
  assert.equal(checkTitle(decomposed), 'ż'.repeat(TITLE_MAX_LENGTH));
});

test('checkTitle refuses an empty or too long title, saying why', () => {
  assert.throws(() => checkTitle(' \n '), /Title is empty/);
  assert.throws(() => checkTitle('a'.repeat(TITLE_MAX_LENGTH + 1)), /Title has 71 characters, the limit is 70/);
});

test('checkDescription allows 160 characters and refuses 161', () => {
  assert.equal(checkDescription('a'.repeat(DESCRIPTION_MAX_LENGTH)).length, 160);
  assert.throws(() => checkDescription('a'.repeat(DESCRIPTION_MAX_LENGTH + 1)), /Description has 161 characters/);
  assert.throws(() => checkDescription(''), /Description is empty/);
});

test('pageTitle adds the brand everywhere but the home page', () => {
  assert.equal(pageTitle('MONSUN: skórzana kurtka z podpinką na cały rok', '/'),
    'MONSUN: skórzana kurtka z podpinką na cały rok');
  assert.equal(pageTitle('Podpinka', '/podpinka/'), 'Podpinka | MONSUN');
  assert.equal(pageTitle('Podpinka', '/podpinka/?utm_source=qr'), 'Podpinka | MONSUN');
  assert.throws(() => pageTitle('a'.repeat(71), '/podpinka/'), RangeError);
});
