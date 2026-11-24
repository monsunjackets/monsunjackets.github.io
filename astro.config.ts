import { defineConfig } from 'astro/config';

// ADR 0001 §1 (static, no integrations) and §9 (CSP). Astro adds the script and style hashes per page
// and emits the policy as a meta tag; Pages cannot send headers.
export default defineConfig({
  site: 'https://monsunjackets.github.io',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' https://*.google-analytics.com https://*.googletagmanager.com",
        "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
        "font-src 'self'",
        "form-action 'self' https://docs.google.com",
        "base-uri 'none'",
        "object-src 'none'",
      ],
      scriptDirective: { resources: ["'self'", 'https://*.googletagmanager.com'] },
      styleDirective: { resources: ["'self'"] },
    },
  },
});
