// The per-page rules of verify-dist (ADR 0001 §7–§9 and plan 0002, chunk A1). checkPage reads one built HTML
// page and returns the rules it breaks, plus the same-origin URLs it references, which the caller checks
// against the whole build.
import { attr, describeTag, tokenize, type StartTag } from '../html.ts';
import { allowsInline, comparePolicy, parsePolicy, type Policy } from './policy.ts';
import { classifyUrl, cssUrls, scriptImports, SITE_ORIGIN, srcsetUrls } from './urls.ts';

/**
 * The rules, as printed in failures. Per page: html-lang (`<html lang="pl">`); csp-meta (exactly one CSP meta,
 * in <head>); csp-position (no script, style or link before it, since a meta policy covers only what follows);
 * csp-policy (the policy equals src/lib/csp.ts apart from sha256 hashes); csp-hash (every inline script and
 * style has its hash in the policy); h1, title, description (exactly one, not empty); canonical (one, absolute,
 * ending in "/", this page's own URL; not on 404.html); inline-style and inline-handler (no style or on…
 * attributes); javascript-url; external-load (everything the browser fetches is same-origin; data: and
 * protocol-relative URLs count as external; links to other sites are fine); form-action (this site or
 * https://docs.google.com/forms/ only). Whole build (dist.ts): missing-target and trailing-slash (every
 * same-origin URL in pages, stylesheets and the sitemap is served by a file in the build, pages with their "/");
 * sitemap (every <loc> is on this site); lab (no /lab/ without MONSUN_LAB=1); unused-script (every _astro/*.js is
 * loaded by a page, directly or through the imports of another script); no-pages; symlink.
 */
export type Rule =
  | 'html-lang'
  | 'csp-meta'
  | 'csp-position'
  | 'csp-policy'
  | 'csp-hash'
  | 'h1'
  | 'title'
  | 'description'
  | 'canonical'
  | 'inline-style'
  | 'inline-handler'
  | 'javascript-url'
  | 'external-load'
  | 'form-action'
  | 'missing-target'
  | 'trailing-slash'
  | 'sitemap'
  | 'lab'
  | 'unused-script'
  | 'no-pages'
  | 'symlink';

export interface Problem {
  rule: Rule;
  message: string;
}

/** A same-origin URL found on the page, to be checked against the build. */
export interface Reference {
  path: string;
  /** What referenced it, for the error message. */
  from: string;
}

export interface PageContext {
  /** Absolute URL the page is served at. */
  url: string;
  /** The configured policy (see expectedPolicy). */
  expected: Policy;
  /**
   * The 404 page has no URL of its own (Pages serves it for every missing path), so its canonical and og:url
   * are neither required nor checked.
   */
  notFoundPage: boolean;
}

/** `<link rel>` values that make the browser fetch or connect to the URL. */
const FETCHING_RELS = new Set(['stylesheet', 'preload', 'modulepreload', 'prefetch', 'preconnect', 'dns-prefetch', 'prerender', 'manifest']);
/** SVG elements whose href loads a resource. */
const SVG_LOADS = new Set(['image', 'use', 'feimage']);
/** <script type> values the browser runs; any other type is a data block (JSON-LD among them) and is ignored. */
const SCRIPT_TYPES = new Set(['', 'module', 'importmap', 'speculationrules', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript', 'application/x-javascript', 'text/jscript']);

export function isExecutableScript(tag: StartTag): boolean {
  const type = (attr(tag, 'type') ?? '').trim().toLowerCase();
  return SCRIPT_TYPES.has(type.split(';')[0]!.trim());
}

/** Google Forms is the one place a form may post to (ADR 0001 §5). */
export function isGoogleFormAction(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' && url.host === 'docs.google.com' && url.username === '' && url.password === '' && url.pathname.startsWith('/forms/');
  } catch {
    return false;
  }
}

export function checkPage(html: string, ctx: PageContext): { problems: Problem[]; references: Reference[] } {
  const tokens = tokenize(html);
  const problems: Problem[] = [];
  const references: Reference[] = [];
  const problem = (rule: Rule, message: string) => problems.push({ rule, message });

  /** A URL the browser fetches: it must stay on this site. */
  const load = (tag: StartTag, name: string, raw: string) => {
    const target = classifyUrl(raw, ctx.url);
    const what = describeUrl(tag, name, raw);
    if (target.kind === 'internal') references.push({ path: target.path, from: what });
    else if (target.kind === 'external') problem('external-load', `${what} loads from another origin`);
    else if (target.kind === 'script') problem('javascript-url', `${what} uses a javascript: URL`);
    else if (target.kind === 'invalid') problem('missing-target', `${what} is not a valid URL`);
  };
  /** A URL the visitor may follow: other origins are fine, this site's must exist. */
  const link = (tag: StartTag, name: string, raw: string) => {
    const target = classifyUrl(raw, ctx.url);
    const what = describeUrl(tag, name, raw);
    if (target.kind === 'internal') references.push({ path: target.path, from: what });
    else if (target.kind === 'script') problem('javascript-url', `${what} uses a javascript: URL`);
    else if (target.kind === 'invalid') problem('missing-target', `${what} is not a valid URL`);
  };
  const formAction = (tag: StartTag, name: string, raw: string) => {
    const target = classifyUrl(raw, ctx.url);
    const what = describeUrl(tag, name, raw);
    if (target.kind === 'script') problem('javascript-url', `${what} uses a javascript: URL`);
    else if ((target.kind === 'external' || target.kind === 'invalid') && !isGoogleFormAction(raw)) {
      problem('form-action', `${what} posts somewhere other than this site or https://docs.google.com/forms/`);
    }
  };

  let head: 'before' | 'in' | 'after' = 'before';
  let htmlTag: StartTag | undefined;
  const cspMetas: { tag: StartTag; inHead: boolean }[] = [];
  const beforeCsp: StartTag[] = [];
  const inlineScripts: string[] = [];
  const inlineStyles: string[] = [];
  const titles: string[] = [];
  const descriptions: string[] = [];
  const canonicals: string[] = [];
  let h1 = 0;

  for (let k = 0; k < tokens.length; k += 1) {
    const token = tokens[k]!;
    if (token.kind === 'end') {
      if (token.name === 'head' && head === 'in') head = 'after';
      continue;
    }
    if (token.kind === 'text') continue;
    const tag = token;
    const next = tokens[k + 1];
    const content = next?.kind === 'text' && next.parent === tag.name ? next.text : '';

    if (tag.name === 'html') htmlTag ??= tag;
    else if (tag.name === 'head' && head === 'before') head = 'in';
    else if (tag.name === 'body') head = 'after';

    const dataBlock = tag.name === 'script' && !isExecutableScript(tag);
    if (dataBlock) continue; // JSON-LD and other data blocks are never run, so no rule applies to them

    for (const a of tag.attrs) {
      if (a.name === 'style') problem('inline-style', `style attribute on ${describeTag(tag)}`);
      else if (a.name.startsWith('on')) problem('inline-handler', `${a.name} attribute on ${describeTag(tag)}`);
    }
    if (cspMetas.length === 0 && (tag.name === 'script' || tag.name === 'style' || tag.name === 'link')) beforeCsp.push(tag);

    // Resource loads, whatever the element.
    for (const a of tag.attrs) {
      if (a.name === 'src' || a.name === 'poster') load(tag, a.name, a.value);
      else if (a.name === 'srcset' || a.name === 'imagesrcset') for (const url of srcsetUrls(a.value)) load(tag, a.name, url);
      else if (a.name === 'data' && tag.name === 'object') load(tag, a.name, a.value);
      else if ((a.name === 'href' || a.name === 'xlink:href') && tag.foreign && SVG_LOADS.has(tag.name)) load(tag, a.name, a.value);
      else if ((a.name === 'href' || a.name === 'xlink:href') && (tag.name === 'a' || tag.name === 'area')) link(tag, a.name, a.value);
      else if (a.name === 'formaction') formAction(tag, a.name, a.value);
    }

    switch (tag.name) {
      case 'meta': {
        const equiv = (attr(tag, 'http-equiv') ?? '').trim().toLowerCase();
        const value = attr(tag, 'content') ?? '';
        const property = (attr(tag, 'property') ?? '').trim().toLowerCase();
        if (equiv === 'content-security-policy') cspMetas.push({ tag, inHead: head !== 'after' && !tag.foreign });
        else if ((attr(tag, 'name') ?? '').trim().toLowerCase() === 'description') descriptions.push(value);
        else if (value.trim().startsWith(`${SITE_ORIGIN}/`) && !(ctx.notFoundPage && property === 'og:url')) {
          link(tag, 'content', value); // og:url, og:image and the like
        }
        break;
      }
      case 'link': {
        const rels = (attr(tag, 'rel') ?? '').toLowerCase().split(/[\t\n\f\r ]+/).filter(Boolean);
        const href = attr(tag, 'href');
        if (rels.includes('canonical')) canonicals.push(href ?? '');
        if (href === undefined || (ctx.notFoundPage && rels.includes('canonical'))) break;
        if (rels.some((rel) => FETCHING_RELS.has(rel) || rel.includes('icon'))) load(tag, 'href', href);
        else link(tag, 'href', href);
        break;
      }
      case 'form':
        if (attr(tag, 'action') !== undefined) formAction(tag, 'action', attr(tag, 'action')!);
        break;
      case 'script':
        if (attr(tag, 'src') === undefined) {
          inlineScripts.push(content);
          for (const url of scriptImports(content)) load(tag, 'import', url); // an inline module importing a chunk
        }
        break;
      case 'style':
        inlineStyles.push(content);
        for (const url of cssUrls(content)) load(tag, 'url()', url);
        break;
      case 'title':
        if (!tag.foreign) titles.push(content);
        break;
      case 'h1':
        h1 += 1;
        break;
    }
  }

  if (!htmlTag) problem('html-lang', 'no <html> element');
  else if (attr(htmlTag, 'lang') !== 'pl') problem('html-lang', `${describeTag(htmlTag, 'lang')} is not <html lang="pl">`);

  checkCsp(ctx, cspMetas, beforeCsp, inlineScripts, inlineStyles, problem);

  if (h1 !== 1) problem('h1', `${h1} <h1> elements; a page has exactly one`);
  if (titles.length !== 1) problem('title', `${titles.length} <title> elements; a page has exactly one`);
  else if (titles[0]!.trim() === '') problem('title', 'the <title> is empty');
  if (descriptions.length !== 1) problem('description', `${descriptions.length} meta descriptions; a page has exactly one`);
  else if (descriptions[0]!.trim() === '') problem('description', 'the meta description is empty');
  if (!ctx.notFoundPage) checkCanonical(ctx.url, canonicals, problem);

  return { problems, references };
}

function checkCsp(
  ctx: PageContext,
  metas: { tag: StartTag; inHead: boolean }[],
  beforeCsp: StartTag[],
  inlineScripts: string[],
  inlineStyles: string[],
  problem: (rule: Rule, message: string) => void,
) {
  if (metas.length === 0) {
    problem('csp-meta', 'no <meta http-equiv="content-security-policy">');
    return;
  }
  // Every meta policy applies, so a second one can only narrow the first; Astro emits exactly one.
  if (metas.length > 1) problem('csp-meta', `${metas.length} CSP meta tags; a page has exactly one`);
  if (metas.some((m) => !m.inHead)) problem('csp-meta', 'a CSP meta tag outside <head>, where browsers ignore it');
  // A meta policy covers only what comes after it, so nothing that loads or runs code or styles may precede it.
  for (const tag of beforeCsp) {
    problem('csp-position', `${describeTag(tag, 'rel', 'href', 'src')} comes before the CSP meta, so the policy does not cover it`);
  }

  const { policy, duplicates } = parsePolicy(attr(metas[0]!.tag, 'content') ?? '');
  for (const name of duplicates) problem('csp-policy', `${name} appears twice; browsers ignore the second`);
  const differences = comparePolicy(policy, ctx.expected);
  if (differences.length > 0) problem('csp-policy', `policy differs from src/lib/csp.ts: ${differences.join('; ')}`);

  for (const script of inlineScripts) {
    if (!allowsInline(policy, 'script', script)) problem('csp-hash', `inline <script> "${preview(script)}" has no hash in script-src; browsers block it`);
  }
  for (const style of inlineStyles) {
    if (!allowsInline(policy, 'style', style)) problem('csp-hash', `inline <style> "${preview(style)}" has no hash in style-src; browsers block it`);
  }
}

function checkCanonical(pageUrl: string, canonicals: string[], problem: (rule: Rule, message: string) => void) {
  if (canonicals.length !== 1) {
    problem('canonical', `${canonicals.length} <link rel="canonical"> elements; a page has exactly one`);
    return;
  }
  const href = canonicals[0]!.trim();
  if (!href.startsWith(`${SITE_ORIGIN}/`)) problem('canonical', `canonical "${href}" is not an absolute URL on ${SITE_ORIGIN}`);
  else if (!href.endsWith('/')) problem('canonical', `canonical "${href}" does not end in "/"`);
  else if (new URL(href).href !== new URL(pageUrl).href) problem('canonical', `canonical "${href}" is not this page's URL (${pageUrl})`);
}

function describeUrl(tag: StartTag, name: string, url: string): string {
  const shown = url.length > 100 ? `${url.slice(0, 97)}...` : url;
  return `<${tag.name}> ${name} "${shown}"`;
}

function preview(code: string): string {
  const flat = code.replace(/\s+/g, ' ').trim();
  return flat.length > 40 ? `${flat.slice(0, 37)}...` : flat;
}
