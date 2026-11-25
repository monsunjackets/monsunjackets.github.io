// Builders for synthetic build outputs, for the verify-dist tests: a page that passes every rule by default,
// with options to break one thing at a time, and a temporary dist folder to hold the files.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { csp } from '../../src/lib/csp.ts';
import { hashSource } from '../../scripts/lib/verify/policy.ts';
import { SITE_ORIGIN } from '../../scripts/lib/verify/urls.ts';

export interface PageSpec {
  /** Site path the page is served at; sets the default canonical. */
  path?: string;
  lang?: string;
  /** null leaves the element out. */
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  /** Markup in <head> before the CSP meta. */
  beforeCsp?: string;
  /** Markup in <head> after the CSP meta. */
  head?: string;
  body?: string;
  /** Rewrites the policy text; null leaves the CSP meta out. */
  policy?: ((policy: string) => string) | null;
  /** Add the hashes of every plain inline <script> and <style> to the policy, as Astro does. */
  hashInline?: boolean;
}

/** The policy text as Astro writes it for src/lib/csp.ts, with the given hashes. */
export function policyText(scriptHashes: string[] = [], styleHashes: string[] = []): string {
  const script = [...csp.scriptDirective.resources, ...scriptHashes].join(' ');
  const style = [...csp.styleDirective.resources, ...styleHashes].join(' ');
  return `${csp.directives.join(';')}; script-src ${script}; style-src ${style};`;
}

export const cspMeta = (policy: string) => `<meta http-equiv="content-security-policy" content="${policy}">`;

const inline = (html: string, tag: 'script' | 'style') =>
  [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => hashSource(m[1]!));

export function page(spec: PageSpec = {}): string {
  const path = spec.path ?? '/';
  const title = spec.title === undefined ? 'MONSUN: kurtka z podpinką' : spec.title;
  const description = spec.description === undefined ? 'Skórzana kurtka z podpinką na cały rok.' : spec.description;
  const canonical = spec.canonical === undefined ? `${SITE_ORIGIN}${path}` : spec.canonical;
  const body = spec.body ?? '<h1>Kurtka na cały rok</h1>';
  const rest = [
    title === null ? '' : `<title>${title}</title>`,
    description === null ? '' : `<meta name="description" content="${description}">`,
    canonical === null ? '' : `<link rel="canonical" href="${canonical}">`,
    spec.head ?? '',
  ].join('');
  const all = `${spec.beforeCsp ?? ''}${rest}${body}`;
  const hashed = spec.hashInline ?? true;
  const policy = policyText(hashed ? inline(all, 'script') : [], hashed ? inline(all, 'style') : []);
  const meta = spec.policy === null ? '' : cspMeta(spec.policy ? spec.policy(policy) : policy);
  return `<!DOCTYPE html><html lang="${spec.lang ?? 'pl'}"><head><meta charset="utf-8">${spec.beforeCsp ?? ''}${meta}${rest}</head><body>${body}</body></html>`;
}

export type Files = Record<string, string | Uint8Array>;

/** Writes the files into a new temporary folder and returns its path. */
export function makeDist(files: Files): string {
  const dir = mkdtempSync(join(tmpdir(), 'verify-dist-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
}
