import { defineConfig } from 'astro/config';

// ADR 0001 §1 (static, no integrations) and §9 (CSP). Astro adds the script and style hashes per page
// and emits the policy as a meta tag; Pages cannot send headers.
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
    },
  },
});
