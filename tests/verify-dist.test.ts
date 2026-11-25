// verify-dist (scripts/verify-dist.ts): every rule has a fixture that breaks it and one that passes, and the
// passing fixtures must pass every rule, not only the one under test.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csp } from '../src/lib/csp.ts';
import { tokenize, type StartTag } from '../scripts/lib/html.ts';
import { verifyDist, type Finding } from '../scripts/lib/verify/dist.ts';
import type { Rule } from '../scripts/lib/verify/page.ts';
import { comparePolicy, expectedPolicy, parsePolicy } from '../scripts/lib/verify/policy.ts';
import { classifyUrl, SITE_ORIGIN, srcsetUrls } from '../scripts/lib/verify/urls.ts';
import { cspMeta, makeDist, page, policyText, type Files } from './fixtures/dist.ts';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function verify(files: Files, lab = false): Finding[] {
  const dir = makeDist(files);
  dirs.push(dir);
  return verifyDist(dir, { lab, expected: expectedPolicy(csp) }).findings;
}

/** Files every fixture site has, so links between them resolve. */
const site = (files: Files = {}): Files => ({
  'index.html': page(),
  'kolekcja/index.html': page({ path: '/kolekcja/' }),
  'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'img/kurtka.jpg': '',
  'img/kurtka-2x.jpg': '',
  'fonts/AnekLatin-VF.woff2': '',
  ...files,
});
const withBody = (body: string, spec = {}) => site({ 'index.html': page({ body: `<h1>Kurtka</h1>${body}`, ...spec }) });
const withHead = (head: string) => site({ 'index.html': page({ head }) });

interface Case {
  name: string;
  bad: Files;
  good: Files;
  /** The bad fixture's message, when worth pinning. */
  message?: RegExp;
}

const cases: Partial<Record<Rule, Case[]>> = {
  'html-lang': [{ name: 'lang must be pl', bad: site({ 'index.html': page({ lang: 'en' }) }), good: site() }],
  'csp-meta': [
    { name: 'a page without the meta', bad: site({ 'index.html': page({ policy: null }) }), good: site(), message: /no <meta/ },
    { name: 'two metas', bad: withHead(cspMeta(policyText())), good: site(), message: /2 CSP meta tags/ },
    { name: 'a meta outside <head>', bad: site({ 'index.html': page({ policy: null, body: `<h1>K</h1>${cspMeta(policyText())}` }) }), good: site(), message: /outside <head>/ },
  ],
  'csp-position': [
    { name: 'a link before the meta', bad: site({ 'index.html': page({ beforeCsp: '<link rel="icon" href="/favicon.svg">' }) }), good: withHead('<link rel="icon" href="/favicon.svg">') },
    { name: 'a script before the meta', bad: site({ 'index.html': page({ beforeCsp: '<script>window.x=1</script>' }) }), good: withHead('<script>window.x=1</script>') },
    { name: 'a style before the meta', bad: site({ 'index.html': page({ beforeCsp: '<style>p{margin:0}</style>' }) }), good: withHead('<style>p{margin:0}</style>') },
    { name: 'JSON-LD may come first', bad: site({ 'index.html': page({ beforeCsp: '<link rel="canonical" href="https://monsunjackets.github.io/">', canonical: null }) }), good: site({ 'index.html': page({ beforeCsp: '<script type="application/ld+json">{"@type":"Organization"}</script>' }) }) },
  ],
  'csp-policy': [
    { name: 'an extra source', bad: site({ 'index.html': page({ policy: (p) => p.replace("img-src 'self'", "img-src 'self' https://evil.example") }) }), good: site(), message: /img-src has extra https:\/\/evil\.example/ },
    { name: 'a missing directive', bad: site({ 'index.html': page({ policy: (p) => p.replace("object-src 'none';", '') }) }), good: site(), message: /object-src is missing/ },
    { name: "'unsafe-inline' in script-src", bad: site({ 'index.html': page({ policy: (p) => p.replace('script-src', "script-src 'unsafe-inline'") }) }), good: site(), message: /script-src has extra 'unsafe-inline'/ },
    { name: 'a directive twice', bad: site({ 'index.html': page({ policy: (p) => `${p} img-src *;` }) }), good: site(), message: /img-src appears twice/ },
    { name: 'a directive that is not configured', bad: site({ 'index.html': page({ policy: (p) => `${p} worker-src 'self';` }) }), good: site(), message: /worker-src is not configured/ },
  ],
  'csp-hash': [
    { name: 'an inline script without its hash', bad: site({ 'index.html': page({ head: '<script>alert(1)</script>', hashInline: false }) }), good: withHead('<script>alert(1)</script>'), message: /inline <script> "alert\(1\)"/ },
    { name: 'an inline style without its hash', bad: site({ 'index.html': page({ head: '<style>p{color:red}</style>', hashInline: false }) }), good: withHead('<style>p{color:red}</style>') },
    { name: 'a module script without its hash', bad: site({ 'index.html': page({ body: '<h1>K</h1><script type="module">import "/a.js"</script>', hashInline: false }) }), good: site({ 'index.html': page({ body: '<h1>K</h1><script type="module" src="/a.js"></script>' }), 'a.js': '' }) },
  ],
  h1: [
    { name: 'no h1', bad: site({ 'index.html': page({ body: '<p>Brak</p>' }) }), good: site(), message: /0 <h1>/ },
    { name: 'two h1', bad: withBody('<h1>Drugi</h1>'), good: withBody('<h2>Drugi</h2>'), message: /2 <h1>/ },
  ],
  title: [
    { name: 'no title', bad: site({ 'index.html': page({ title: null }) }), good: site() },
    { name: 'an empty title', bad: site({ 'index.html': page({ title: ' ' }) }), good: site(), message: /empty/ },
    { name: 'two titles; an SVG title does not count', bad: withHead('<title>Drugi</title>'), good: withBody('<svg role="img"><title>Logo MONSUN</title></svg>') },
  ],
  description: [
    { name: 'no description', bad: site({ 'index.html': page({ description: null }) }), good: site() },
    { name: 'an empty description', bad: site({ 'index.html': page({ description: '' }) }), good: site() },
    { name: 'two descriptions', bad: withHead('<meta name="description" content="Druga">'), good: site() },
  ],
  canonical: [
    { name: 'no canonical', bad: site({ 'index.html': page({ canonical: null }) }), good: site() },
    { name: 'a relative canonical', bad: site({ 'index.html': page({ canonical: '/' }) }), good: site(), message: /not an absolute URL/ },
    { name: 'a canonical without the trailing slash', bad: site({ 'kolekcja/index.html': page({ path: '/kolekcja/', canonical: `${SITE_ORIGIN}/kolekcja` }) }), good: site(), message: /does not end in "\/"/ },
    { name: "another page's canonical", bad: site({ 'kolekcja/index.html': page({ path: '/kolekcja/', canonical: `${SITE_ORIGIN}/` }) }), good: site(), message: /not this page's URL/ },
    // Astro gives the 404 page the canonical and og:url /404/, which Pages never serves.
    { name: 'only the root 404 page may skip it, or have one that leads nowhere', bad: site({ 'blog/404.html': page({ path: '/blog/404.html', canonical: null }) }), good: site({ '404.html': page({ canonical: `${SITE_ORIGIN}/404/`, head: `<meta property="og:url" content="${SITE_ORIGIN}/404/">` }) }) },
    { name: 'the root 404 page without one', bad: site({ 'index.html': page({ canonical: null }) }), good: site({ '404.html': page({ canonical: null }) }) },
  ],
  'inline-style': [
    { name: 'a style attribute', bad: withBody('<p style="color:red">x</p>'), good: withBody('<p data-style="red">x</p><style>p{color:red}</style>') },
    { name: 'a style attribute in SVG', bad: withBody('<svg><rect style="fill:red"/></svg>'), good: withBody('<svg><rect fill="currentColor"/></svg>') },
  ],
  'inline-handler': [
    { name: 'an on… attribute', bad: withBody('<button onclick="go()">x</button>'), good: withBody('<button data-on="go">x</button>'), message: /onclick attribute on <button>/ },
    { name: 'an SVG onload', bad: withBody('<svg onload="go()"></svg>'), good: withBody('<svg></svg>') },
    { name: 'markup inside a script or comment is not markup', bad: withBody('<p ONMOUSEOVER=go()>x</p>'), good: withBody('<!-- <p onclick="x"> --><script>document.body.insertAdjacentHTML("beforeend", "<p onclick=\\"x\\">")</script>') },
  ],
  'javascript-url': [
    { name: 'a javascript: link', bad: withBody('<a href="javascript:go()">x</a>'), good: withBody('<a href="mailto:wearmonsun@gmail.com">x</a><a href="tel:+48000000000">y</a>') },
    { name: 'a javascript: form action', bad: withBody('<form action=" JavaScript:go()"></form>'), good: withBody('<form></form>') },
  ],
  'external-load': [
    { name: 'an image from a CDN', bad: withBody('<img src="https://cdn.example/a.jpg" alt="">'), good: withBody('<img src="/img/kurtka.jpg" alt="">') },
    { name: 'a protocol-relative URL, even to this host', bad: withBody('<img src="//monsunjackets.github.io/img/kurtka.jpg" alt="">'), good: withBody(`<img src="${SITE_ORIGIN}/img/kurtka.jpg" alt="">`) },
    { name: 'the second srcset candidate', bad: withBody('<img src="/img/kurtka.jpg" srcset="/img/kurtka.jpg 1x, https://cdn.example/b.jpg 2x" alt="">'), good: withBody('<picture><source srcset="/img/kurtka.jpg 800w,/img/kurtka-2x.jpg 1600w"><img src="/img/kurtka.jpg" alt=""></picture>') },
    { name: 'a Google Fonts stylesheet', bad: withHead('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Latin">'), good: withHead('<link rel="alternate" href="https://example.com/feed"><link rel="me" href="https://www.instagram.com/monsunjackets/">') },
    { name: 'a preconnect or a font preload', bad: withHead('<link rel="preconnect" href="https://fonts.gstatic.com"><link rel="preload" as="font" href="https://fonts.gstatic.com/a.woff2">'), good: withHead('<link rel="preload" as="font" href="/fonts/AnekLatin-VF.woff2" crossorigin>') },
    { name: 'an icon from another origin', bad: withHead('<link rel="apple-touch-icon" href="https://cdn.example/icon.png">'), good: withHead('<link rel="icon" href="/favicon.svg">') },
    { name: 'a third-party script', bad: withHead('<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>'), good: site({ 'index.html': page({ head: '<script type="module" src="/_astro/a.js"></script>' }), '_astro/a.js': '' }) },
    { name: 'an embed, a frame, a poster and an object', bad: withBody('<iframe src="https://www.youtube.com/embed/x"></iframe><video poster="https://cdn.example/p.jpg"></video><object data="https://cdn.example/x"></object><embed src="https://cdn.example/y">'), good: withBody('<video poster="/img/kurtka.jpg" muted></video>') },
    { name: 'a data: image, which the CSP blocks', bad: withBody('<img src="data:image/png;base64,iVBORw0KGgo=" alt="">'), good: withBody('<img src="/img/kurtka.jpg" alt="">') },
    { name: 'an SVG image from another origin', bad: withBody('<svg><image href="https://cdn.example/a.png"/><use xlink:href="https://cdn.example/s.svg#i"/></svg>'), good: withBody('<svg><defs><linearGradient id="g"/></defs><use href="#g"/></svg>') },
    { name: 'url() and @import in an inline style', bad: withHead('<style>@import "https://fonts.googleapis.com/css";@font-face{src:url(https://fonts.gstatic.com/a.woff2)}</style>'), good: withHead('<style>@font-face{src:url("/fonts/AnekLatin-VF.woff2")}.a{fill:url(#g)}</style>') },
    { name: 'url() in a built stylesheet', bad: site({ '_astro/a.css': 'body{background:url( "https://cdn.example/bg.png" )}' }), good: site({ '_astro/a.css': '/* url(https://ignored.example) */@font-face{src:url(../fonts/AnekLatin-VF.woff2)}' }) },
    { name: 'links to other sites are fine, loads are not', bad: withBody('<a href="https://www.instagram.com/monsunjackets/"><img src="https://scontent.cdninstagram.com/a.jpg" alt=""></a>'), good: withBody('<a href="https://www.instagram.com/monsunjackets/"><img src="/img/kurtka.jpg" alt=""></a>') },
  ],
  'form-action': [
    { name: 'a form posting to another site', bad: withBody('<form action="https://evil.example/collect" method="post"></form>'), good: withBody('<form action="https://docs.google.com/forms/d/e/1FAIpQL/formResponse" method="post"></form>') },
    { name: 'Google, but not Forms', bad: withBody('<form action="https://docs.google.com/spreadsheets/d/x"></form>'), good: withBody('<form action="/kolekcja/"></form>') },
    { name: 'a look-alike host', bad: withBody('<form action="https://docs.google.com.evil.example/forms/x"></form>'), good: site() },
    { name: 'a path that leaves /forms/', bad: withBody('<form action="https://docs.google.com/forms/../x"></form>'), good: site() },
    { name: 'plain http', bad: withBody('<form action="http://docs.google.com/forms/d/e/x/formResponse"></form>'), good: site() },
    { name: 'a button formaction', bad: withBody('<form><button formaction="https://evil.example/">x</button></form>'), good: withBody('<form><button>x</button></form>') },
  ],
  'missing-target': [
    { name: 'a link to a page that does not exist', bad: withBody('<a href="/nie-ma/">x</a>'), good: withBody(`<a href="/kolekcja/?utm_source=poster#lista">x</a><a href="kolekcja/">y</a><a href="${SITE_ORIGIN}/kolekcja/">z</a><a href="#top">t</a>`), message: /<a> href "\/nie-ma\/" points to \/nie-ma\/, which is not in the build/ },
    { name: 'a missing image', bad: withBody('<img src="/img/brak.jpg" alt="">'), good: site({ 'index.html': page({ body: '<h1>K</h1><img src="/img/a%20b.jpg" alt="">' }), 'img/a b.jpg': '' }) },
    { name: 'a missing link-preview image', bad: withHead(`<meta property="og:image" content="${SITE_ORIGIN}/og.png">`), good: site({ 'index.html': page({ head: `<meta property="og:image" content="${SITE_ORIGIN}/og.png"><meta property="og:url" content="${SITE_ORIGIN}/">` }), 'og.png': '' }) },
    { name: 'a missing font in a stylesheet', bad: site({ '_astro/a.css': '@font-face{src:url(/fonts/Brak.woff2)}' }), good: site({ '_astro/a.css': '@font-face{src:url(/fonts/AnekLatin-VF.woff2)}' }) },
    { name: 'relative links resolve against the page', bad: site({ 'kolekcja/index.html': page({ path: '/kolekcja/', body: '<h1>K</h1><a href="kurtka/">x</a>' }) }), good: site({ 'kolekcja/index.html': page({ path: '/kolekcja/', body: '<h1>K</h1><a href="../">x</a><img src="../img/kurtka.jpg" alt="">' }) }) },
  ],
  'trailing-slash': [
    { name: 'a page link without the slash', bad: withBody('<a href="/kolekcja">x</a>'), good: withBody('<a href="/kolekcja/">x</a>'), message: /without the trailing "\/"/ },
  ],
  sitemap: [
    { name: 'a <loc> on another site', bad: site({ 'sitemap.xml': '<urlset><url><loc>https://example.com/</loc></url></urlset>' }), good: site({ 'sitemap.xml': `<urlset><url><loc>${SITE_ORIGIN}/</loc></url><url><loc>${SITE_ORIGIN}/kolekcja/?a=1&amp;b=2</loc></url></urlset>` }) },
    { name: 'a sitemap with no <loc>', bad: site({ 'sitemap.xml': '<urlset></urlset>' }), good: site() },
  ],
  'no-pages': [{ name: 'a build without pages', bad: { 'favicon.svg': '<svg/>' }, good: site() }],
};

describe('rules', () => {
  for (const [rule, list] of Object.entries(cases)) {
    for (const { name, bad, good, message } of list!) {
      test(`${rule}: ${name}`, () => {
        const failing = verify(bad);
        const hit = failing.filter((f) => f.rule === rule);
        assert.ok(hit.length > 0, `expected a ${rule} failure, got ${JSON.stringify(failing)}`);
        if (message) assert.ok(hit.some((f) => message.test(f.message)), JSON.stringify(hit));
        assert.deepEqual(verify(good), []);
      });
    }
  }

  test('sitemap: a <loc> to a missing page or without the slash fails like a link', () => {
    const findings = verify(site({ 'sitemap.xml': `<urlset><url><loc>${SITE_ORIGIN}/brak/</loc></url><url><loc>${SITE_ORIGIN}/kolekcja</loc></url></urlset>` }));
    assert.deepEqual(findings.map((f) => [f.file, f.rule]), [['sitemap.xml', 'missing-target'], ['sitemap.xml', 'trailing-slash']]);
  });

  test('lab: /lab/ fails unless MONSUN_LAB=1, and lab pages are then checked like any page', () => {
    const files = site({ 'lab/hero-temp/index.html': page({ path: '/lab/hero-temp/' }) });
    assert.deepEqual(verify(files).map((f) => [f.file, f.rule]), [['lab/', 'lab']]);
    assert.deepEqual(verify(files, true), []);
    const broken = site({ 'lab/hero-temp/index.html': page({ path: '/lab/hero-temp/', body: '<h1 style="x">K</h1>' }) });
    assert.deepEqual(verify(broken, true).map((f) => f.rule), ['inline-style']);
  });

  test('symlink: a symlink in the build fails and is not followed', () => {
    const dir = makeDist(site());
    dirs.push(dir);
    symlinkSync('/etc/passwd', join(dir, 'passwd.html'));
    const { pages, findings } = verifyDist(dir, { lab: false, expected: expectedPolicy(csp) });
    assert.equal(pages, 2);
    assert.deepEqual(findings.map((f) => [f.file, f.rule]), [['passwd.html', 'symlink']]);
  });

  test('every finding names the file, and repeated problems are reported once', () => {
    const findings = verify(site({ 'kolekcja/index.html': page({ path: '/kolekcja/', body: '<h1>K</h1><a href="/x/">1</a><a href="/x/">2</a>' }) }));
    assert.deepEqual(findings.map((f) => [f.file, f.rule]), [['kolekcja/index.html', 'missing-target']]);
  });

  test('a missing dist folder is an error, not a pass', () => {
    assert.throws(() => verifyDist('/nonexistent-dist', { lab: false, expected: expectedPolicy(csp) }), /build first/);
  });
});

describe('tokenizer', () => {
  const starts = (html: string) => tokenize(html).filter((t): t is StartTag => t.kind === 'start');

  test('reads quoted, unquoted and valueless attributes, lower-cases names and decodes values', () => {
    const [a] = starts('<A HREF=/kolekcja/?a=1&amp;b=2 data-x=\'&#34;q&#x22;\' hidden>');
    assert.deepEqual(a!.attrs, [{ name: 'href', value: '/kolekcja/?a=1&b=2' }, { name: 'data-x', value: '"q"' }, { name: 'hidden', value: '' }]);
  });

  test('raw text and RCDATA hide markup; foreign <title> does not', () => {
    const names = starts('<title><h1>x</h1></title><script>"</script >"</script><style>a<b></style><svg><title>t</title><p></svg><h2>').map((t) => t.name);
    assert.deepEqual(names, ['title', 'script', 'style', 'svg', 'title', 'p', 'h2']);
  });

  test('script text is kept exactly, for hashing', () => {
    const text = tokenize('<script>\n  a < b && c("</p>");\n</script>').find((t) => t.kind === 'text');
    assert.deepEqual(text, { kind: 'text', text: '\n  a < b && c("</p>");\n', parent: 'script' });
  });

  test('legacy named references without a semicolon stay as written in attributes', () => {
    const [a] = starts('<a href="/?a=1&lt=2&amp;c=3">');
    assert.equal(a!.attrs[0]!.value, '/?a=1&lt=2&c=3');
  });
});

describe('URLs and policies', () => {
  test('srcset candidates, with and without descriptors', () => {
    assert.deepEqual(srcsetUrls('/a.jpg 1x, /b.jpg 2x'), ['/a.jpg', '/b.jpg']);
    assert.deepEqual(srcsetUrls('/a.jpg 1x,/b.jpg 2x'), ['/a.jpg', '/b.jpg']);
    assert.deepEqual(srcsetUrls('/a.jpg, /b.jpg 800w'), ['/a.jpg', '/b.jpg']);
    assert.deepEqual(srcsetUrls(' /a.jpg '), ['/a.jpg']);
  });

  test('classification of URLs', () => {
    const base = `${SITE_ORIGIN}/kolekcja/`;
    assert.deepEqual(classifyUrl(' ../img/a%20b.jpg ', base), { kind: 'internal', path: '/img/a b.jpg' });
    assert.equal(classifyUrl('\\\\evil.example/x', base).kind, 'external');
    assert.equal(classifyUrl('http://monsunjackets.github.io/', base).kind, 'external');
    assert.equal(classifyUrl('blob:https://monsunjackets.github.io/x', base).kind, 'external');
    assert.equal(classifyUrl('java\tscript:x', base).kind, 'script'); // browsers drop tabs and newlines first
    assert.equal(classifyUrl('#lista', base).kind, 'fragment');
  });

  test('the comparison ignores sha256 hashes only where Astro puts them', () => {
    const hash = "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";
    const expected = expectedPolicy(csp);
    assert.deepEqual(comparePolicy(parsePolicy(policyText([hash], [hash])).policy, expected), []);
    const inImgSrc = parsePolicy(policyText().replace("img-src 'self'", `img-src 'self' ${hash}`)).policy;
    assert.deepEqual(comparePolicy(inImgSrc, expected), [`img-src has extra ${hash}`]);
  });

  test("SITE_ORIGIN matches the site in astro.config.ts", () => {
    const config = readFileSync(new URL('../astro.config.ts', import.meta.url), 'utf8');
    assert.equal(/\bsite:\s*'([^']+)'/.exec(config)?.[1], SITE_ORIGIN);
  });
});

describe('CLI', () => {
  const script = fileURLToPath(new URL('../scripts/verify-dist.ts', import.meta.url));
  const run = (args: string[], env: NodeJS.ProcessEnv = {}) =>
    spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, MONSUN_LAB: '', ...env } });

  test('exit 0 on a clean build, 1 with "file: [rule] message" lines, 2 without a build', () => {
    const good = makeDist(site());
    const bad = makeDist(withBody('<p style="x">x</p>'));
    dirs.push(good, bad);
    assert.equal(run([good]).status, 0);
    const failed = run([bad]);
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /index\.html: \[inline-style\] style attribute on <p>/);
    assert.equal(run(['/nonexistent-dist']).status, 2);
    assert.equal(run([good, bad]).status, 2);
  });

  test('MONSUN_LAB=1 allows /lab/', () => {
    const dir = makeDist(site({ 'lab/x/index.html': page({ path: '/lab/x/' }) }));
    dirs.push(dir);
    assert.equal(run([dir]).status, 1);
    assert.equal(run([dir], { MONSUN_LAB: '1' }).status, 0);
  });
});
