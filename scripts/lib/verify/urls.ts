// URL handling for verify-dist: which references stay on the site, which leave it, and which built file a
// site path is served from. GitHub Pages serves /x/ from x/index.html and answers /x with a redirect to /x/
// when only x/index.html exists (ADR 0001 §1: trailingSlash 'always', build.format 'directory').

/** The site's origin. Must match `site` in astro.config.ts (a test keeps the two in step). */
export const SITE_ORIGIN = 'https://monsunjackets.github.io';

export type UrlTarget =
  /** On this site; `path` is the decoded pathname. */
  | { kind: 'internal'; path: string }
  /** Another origin, a protocol-relative URL, or a scheme such as data:, blob: or mailto:. */
  | { kind: 'external' }
  /** A javascript: URL, which is inline script. */
  | { kind: 'script' }
  /** Only a fragment, so the same document. */
  | { kind: 'fragment' }
  | { kind: 'empty' }
  | { kind: 'invalid' };

const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** Classifies a URL as written in an attribute or stylesheet, relative to the absolute URL `base`. */
export function classifyUrl(raw: string, base: string): UrlTarget {
  // As the URL parser does: trim C0 controls and spaces, and drop tabs and newlines anywhere, so that
  // "java&#9;script:" is still a javascript: URL.
  const value = raw.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '').replace(/[\t\n\r]/g, '');
  if (value === '') return { kind: 'empty' };
  if (value.startsWith('#')) return { kind: 'fragment' };
  // Protocol-relative URLs count as external even when they name this host: they never belong in our output.
  if (/^[/\\]{2}/.test(value)) return { kind: 'external' };
  const scheme = SCHEME.exec(value)?.[1]?.toLowerCase();
  if (scheme === 'javascript') return { kind: 'script' };
  if (scheme !== undefined && scheme !== 'http' && scheme !== 'https') return { kind: 'external' };
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return { kind: 'invalid' };
  }
  if (url.origin !== SITE_ORIGIN) return { kind: 'external' };
  try {
    return { kind: 'internal', path: decodeURIComponent(url.pathname) };
  } catch {
    return { kind: 'invalid' };
  }
}

/** The URLs in a srcset attribute, without their width or density descriptors. */
export function srcsetUrls(value: string): string[] {
  const urls: string[] = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i]!)) i += 1;
    const start = i;
    while (i < value.length && !/\s/.test(value[i]!)) i += 1;
    const url = value.slice(start, i);
    if (url === '') break;
    if (url.endsWith(',')) {
      urls.push(url.replace(/,+$/, ''));
      continue;
    }
    urls.push(url);
    let depth = 0;
    while (i < value.length) {
      const c = value[i]!;
      i += 1;
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      else if (c === ',' && depth <= 0) break;
    }
  }
  return urls;
}

/** The URLs a stylesheet loads: every url(...) and every @import "...". */
export function cssUrls(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const urls: string[] = [];
  for (const m of code.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) urls.push(m[1] ?? m[2] ?? m[3] ?? '');
  for (const m of code.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) urls.push(m[1] ?? m[2] ?? '');
  return urls;
}

/**
 * The relative and root-relative modules a built script imports: `import … from "…"`, `export … from "…"`,
 * `import "…"` and `import("…")`. Bundler output only, so a pattern match is enough; bare specifiers (which a
 * browser cannot load) and full URLs are left out.
 */
export function scriptImports(code: string): string[] {
  const urls: string[] = [];
  for (const m of code.matchAll(/(?:\bimport|\bfrom)\s*\(?\s*(["'`])([^"'`\n]*)\1/g)) {
    if (/^(?:\.{1,2})?\//.test(m[2]!)) urls.push(m[2]!);
  }
  return urls;
}

/** The site path a built file is served at: `a/b/index.html` → `/a/b/`, `404.html` → `/404.html`. */
export function servedPath(file: string): string {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

export type Resolution = 'ok' | 'missing' | 'no-trailing-slash';

/** Whether a site path is served from a file in the build (`files` holds paths relative to dist, with "/"). */
export function resolvePath(path: string, files: ReadonlySet<string>): Resolution {
  const file = path.replace(/^\/+/, '');
  if (path.endsWith('/')) return files.has(`${file}index.html`) ? 'ok' : 'missing';
  if (files.has(file)) return 'ok';
  return files.has(`${file}/index.html`) ? 'no-trailing-slash' : 'missing';
}
