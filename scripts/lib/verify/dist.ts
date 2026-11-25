// verify-dist over a whole build: walks dist/, applies the page rules to every HTML file, checks stylesheets
// and the sitemap, and resolves every same-origin reference against the files that will be deployed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodeEntities } from '../html.ts';
import { checkPage, type Reference, type Rule } from './page.ts';
import type { Policy } from './policy.ts';
import { classifyUrl, cssUrls, resolvePath, servedPath, SITE_ORIGIN } from './urls.ts';

export interface Finding {
  /** Path relative to the dist directory, with "/". */
  file: string;
  rule: Rule;
  message: string;
}

export interface VerifyOptions {
  /** MONSUN_LAB=1: the /lab/ demos are allowed in this build. */
  lab: boolean;
  /** The configured policy (see expectedPolicy). */
  expected: Policy;
}

export interface VerifyResult {
  pages: number;
  findings: Finding[];
}

export function verifyDist(dist: string, options: VerifyOptions): VerifyResult {
  if (!statSync(dist, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`${dist} is not a directory; build first`);
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const add = (file: string, rule: Rule, message: string) => {
    const key = `${file}\0${rule}\0${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ file, rule, message });
  };

  const { files, symlinks } = walk(dist);
  for (const link of symlinks) add(link, 'symlink', 'a symlink in the build output; the Pages artifact would copy its target');
  if (statSync(join(dist, 'lab'), { throwIfNoEntry: false }) && !options.lab) {
    add('lab/', 'lab', 'the /lab/ demos are in the build; they are built only with MONSUN_LAB=1 and never deployed');
  }

  const pages = [...files].filter((f) => f.endsWith('.html')).sort();
  if (pages.length === 0) add('.', 'no-pages', 'the build has no HTML pages');

  const check = (file: string, references: Reference[]) => {
    for (const { path, from } of references) {
      const resolution = resolvePath(path, files);
      if (resolution === 'missing') add(file, 'missing-target', `${from} points to ${path}, which is not in the build`);
      else if (resolution === 'no-trailing-slash') add(file, 'trailing-slash', `${from} points to ${path} without the trailing "/"; Pages answers with a redirect`);
    }
  };

  for (const file of pages) {
    const url = new URL(servedPath(file), SITE_ORIGIN).href;
    const html = readFileSync(join(dist, file), 'utf8');
    const { problems, references } = checkPage(html, { url, expected: options.expected, notFoundPage: file === '404.html' });
    for (const { rule, message } of problems) add(file, rule, message);
    check(file, references);
  }

  for (const file of [...files].filter((f) => f.endsWith('.css')).sort()) {
    const base = new URL(`/${file}`, SITE_ORIGIN).href;
    const references: Reference[] = [];
    for (const raw of cssUrls(readFileSync(join(dist, file), 'utf8'))) {
      const target = classifyUrl(raw, base);
      if (target.kind === 'internal') references.push({ path: target.path, from: `url("${raw}")` });
      else if (target.kind === 'external' || target.kind === 'script') add(file, 'external-load', `url("${raw}") loads from another origin`);
      else if (target.kind === 'invalid') add(file, 'missing-target', `url("${raw}") is not a valid URL`);
    }
    check(file, references);
  }

  if (files.has('sitemap.xml')) {
    const references: Reference[] = [];
    const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
    const locs = [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]!));
    if (locs.length === 0) add('sitemap.xml', 'sitemap', 'the sitemap lists no <loc>');
    for (const loc of locs) {
      const target = loc.startsWith(`${SITE_ORIGIN}/`) ? classifyUrl(loc, SITE_ORIGIN) : undefined;
      if (target?.kind === 'internal') references.push({ path: target.path, from: `<loc>${loc}</loc>` });
      else add('sitemap.xml', 'sitemap', `<loc>${loc}</loc> is not an absolute URL on ${SITE_ORIGIN}`);
    }
    check('sitemap.xml', references);
  }

  findings.sort((a, b) => (a.file === b.file ? a.rule.localeCompare(b.rule) : a.file.localeCompare(b.file)));
  return { pages: pages.length, findings };
}

/** Every regular file under `root` (relative, with "/"), and every symlink, which is never followed. */
function walk(root: string): { files: Set<string>; symlinks: string[] } {
  const files = new Set<string>();
  const symlinks: string[] = [];
  const visit = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) symlinks.push(rel);
      else if (entry.isDirectory()) visit(join(dir, entry.name), `${rel}/`);
      else if (entry.isFile()) files.add(rel);
    }
  };
  visit(root, '');
  return { files, symlinks };
}
