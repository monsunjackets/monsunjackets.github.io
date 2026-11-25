// CSP policies for verify-dist: the policy Astro should emit for src/lib/csp.ts, parsing the emitted one, the
// comparison between them (ignoring the per-page sha256 hashes) and the hash of an inline script or style.
import { createHash } from 'node:crypto';
import type { CspConfig } from '../../../src/lib/csp.ts';

/** Directive name → its sources, in order. */
export type Policy = Map<string, string[]>;

const HASH = /^'sha256-[A-Za-z0-9+/]{43}='$/;
/** Directives that carry Astro's per-page hashes. */
const HASHED = new Set(['script-src', 'script-src-elem', 'style-src', 'style-src-elem']);

export function parsePolicy(text: string): { policy: Policy; duplicates: string[] } {
  const policy: Policy = new Map();
  const duplicates: string[] = [];
  for (const part of text.split(';')) {
    const [name, ...sources] = part.trim().split(/[\t\n\f\r ]+/).filter(Boolean);
    if (name === undefined) continue;
    const key = name.toLowerCase();
    // Browsers use the first occurrence of a directive and ignore the rest.
    if (policy.has(key)) duplicates.push(key);
    else policy.set(key, sources);
  }
  return { policy, duplicates };
}

/** The policy Astro emits for this config, without the hashes it adds per page (see Astro's renderCspContent). */
export function expectedPolicy(config: CspConfig): Policy {
  const { policy } = parsePolicy(config.directives.join(';'));
  const resources = (list: string[]) => (list.length > 0 ? list : ["'self'"]);
  policy.set('script-src', resources(config.scriptDirective.resources));
  policy.set('style-src', resources(config.styleDirective.resources));
  return policy;
}

/** The differences between an emitted policy and the expected one, ignoring sha256 hashes; empty when equal. */
export function comparePolicy(emitted: Policy, expected: Policy): string[] {
  const differences: string[] = [];
  for (const [name, sources] of expected) {
    if (!emitted.has(name)) differences.push(`${name} is missing`);
    else differences.push(...compareSources(name, emitted.get(name)!, sources));
  }
  for (const name of emitted.keys()) if (!expected.has(name)) differences.push(`${name} is not configured`);
  return differences;
}

function compareSources(name: string, emitted: string[], expected: string[]): string[] {
  const actual = new Set(HASHED.has(name) ? emitted.filter((s) => !HASH.test(s)) : emitted);
  const wanted = new Set(expected);
  const differences: string[] = [];
  for (const source of actual) if (!wanted.has(source)) differences.push(`${name} has extra ${source}`);
  for (const source of wanted) if (!actual.has(source)) differences.push(`${name} lacks ${source}`);
  return differences;
}

/** The CSP source that allows an inline script or style with exactly this content. */
export function hashSource(content: string): string {
  return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;
}

/** Whether the policy allows an inline <script> or <style> with this content through a hash. */
export function allowsInline(policy: Policy, kind: 'script' | 'style', content: string): boolean {
  const sources = policy.get(`${kind}-src-elem`) ?? policy.get(`${kind}-src`) ?? policy.get('default-src') ?? [];
  return sources.includes(hashSource(content));
}
