// The Content Security Policy of every page (ADR 0001 §9), in the shape of Astro's `security.csp` option.
// astro.config.ts hands it to Astro, which adds the script and style hashes per page and emits a meta tag;
// scripts/verify-dist.ts checks that every built page carries exactly this policy apart from those hashes.
// No imports and no logic: the verify job runs this file with plain Node and no node_modules.

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

export const csp: CspConfig = {
  algorithm: 'SHA-256',
  // Google origins for GA4 are added by the consent chunk (B2), the code that needs them.
  directives: [
    "default-src 'self'",
    "img-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self' https://docs.google.com",
    "base-uri 'none'",
    "object-src 'none'",
  ],
  scriptDirective: { resources: ["'self'"] },
  styleDirective: { resources: ["'self'"] },
};
