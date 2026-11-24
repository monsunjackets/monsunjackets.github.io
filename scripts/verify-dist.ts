// Placeholder until chunk A1 replaces it with the full ADR 0001 §8 checks.
// For now it only fails when a built page lacks the CSP meta tag.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

function* htmlFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

let failures = 0;
for (const file of htmlFiles(dist)) {
  if (!/<meta http-equiv="content-security-policy"/i.test(readFileSync(file, 'utf8'))) {
    console.error(`missing CSP meta: ${file}`);
    failures += 1;
  }
}
console.log('verify-dist (placeholder until A1): CSP meta checked on every page.');
process.exit(failures === 0 ? 0 : 1);
