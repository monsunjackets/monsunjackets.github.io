// The Content Security Policy of every page (ADR 0001 §9), in the shape of Astro's `security.csp` option.
// astro.config.ts hands it to Astro, which adds the script and style hashes per page and emits a meta tag;
// scripts/verify-dist.ts checks that every built page carries exactly this policy apart from those hashes.
// The verify job runs this file with plain Node and no node_modules, so its only import is src/config/site.ts,
// which has no imports of its own.
import { site } from '../config/site.ts';

/**
 * Directives a meta CSP honours and Astro accepts here. `script-src` and `style-src` come from the objects
 * below; `frame-ancestors`, `report-uri` and `sandbox` are left out because browsers ignore them in a meta tag.
 */
type DirectiveName =
  | 'base-uri'
  | 'child-src'
  | 'connect-src'
  | 'default-src'
  | 'font-src'
  | 'form-action'
  | 'frame-src'
  | 'img-src'
  | 'manifest-src'
  | 'media-src'
  | 'object-src'
  | 'worker-src';

export type CspDirective = `${DirectiveName} ${string}`;
export type CspHash = `sha256-${string}`;

export interface CspConfig {
  algorithm: 'SHA-256';
  directives: CspDirective[];
  /** Sources for `script-src`. Astro adds a hash for every script it emits inline. */
  scriptDirective: { resources: string[]; hashes?: CspHash[] };
  /** Sources for `style-src`. Astro adds a hash for every style it emits inline. */
  styleDirective: { resources: string[]; hashes?: CspHash[] };
}

/**
 * What the consent module's GA4 needs (ADR 0001 §6, §9 and the G1 amendment): gtag.js and its pings on
 * www.googletagmanager.com, hits on region<N>.google-analytics.com. With Google signals off nothing goes to
 * doubleclick.net or www.google.com, and the tag uses no other googletagmanager.com host, so the single host
 * replaces the `*.googletagmanager.com` of Google's CSP guide.
 */
export const GA4_SOURCES = {
  script: ['https://www.googletagmanager.com'],
  img: ['https://*.google-analytics.com', 'https://www.googletagmanager.com'],
  connect: ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com'],
} as const;

/** The policy, with the GA4 origins only when the tag can load. */
export function buildCsp(ga4: boolean): CspConfig {
  const sources = (extra: readonly string[]) => ["'self'", ...(ga4 ? extra : [])].join(' ');
  return {
    algorithm: 'SHA-256',
    directives: [
      "default-src 'self'",
      `img-src ${sources(GA4_SOURCES.img)}`,
      `connect-src ${sources(GA4_SOURCES.connect)}`,
      "font-src 'self'",
      "form-action 'self' https://docs.google.com",
      "base-uri 'none'",
      "object-src 'none'",
    ],
    scriptDirective: { resources: ["'self'", ...(ga4 ? GA4_SOURCES.script : [])] },
    styleDirective: { resources: ["'self'"] },
  };
}

/**
 * GA4 origins are in the policy exactly when GA4 is configured, so the policy depends on committed config only and
 * the build and verify-dist always agree. Lab builds use the same policy as the site; to check the consent demo's
 * test id under CSP before the real id exists, see src/modules/consent/README.md.
 */
export const csp: CspConfig = buildCsp(site.ga4Id !== null);
