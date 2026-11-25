import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { csp } from './src/lib/csp.ts';

// The theme bootstrap is the one is:inline script (ADR 0001 §4). Astro does not hash is:inline scripts, so its
// SHA-256 is computed here from the same file the layout inlines.
const bootstrap = readFileSync(new URL('./src/scripts/theme-bootstrap.js', import.meta.url), 'utf8');
const bootstrapHash = `sha256-${createHash('sha256').update(bootstrap).digest('base64')}` as const;

// ADR 0001 §1 (static, no integrations) and §9 (CSP). Astro adds the script and style hashes per page
// and emits the policy as a meta tag; Pages cannot send headers. The policy itself is in src/lib/csp.ts,
// which verify-dist checks every built page against.
export default defineConfig({
  site: 'https://monsunjackets.github.io',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  // Shiki writes inline styles, which the CSP blocks; posts need no code highlighting.
  markdown: { syntaxHighlight: false },
  security: {
    csp: {
      ...csp,
      scriptDirective: { ...csp.scriptDirective, hashes: [...(csp.scriptDirective?.hashes ?? []), bootstrapHash] },
    },
  },
});
