import { defineConfig } from 'astro/config';
import { csp } from './src/lib/csp.ts';

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
  security: { csp },
});
