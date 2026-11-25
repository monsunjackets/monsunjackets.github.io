// Checks the built site before it deploys (ADR 0001 §8, amended after review G1; plan 0002, chunk A1).
// Usage: node scripts/verify-dist.ts [distDir]   (default: dist/ next to this scripts/ folder)
//
// It runs in its own CI job on the downloaded Pages artifact, from a clean checkout with no npm ci, so it
// imports only Node built-ins and dependency-free files from this repo. Each failure names the file and the
// rule; the rules are in scripts/lib/verify/page.ts and dist.ts. With MONSUN_LAB=1 the /lab/ demos may be in
// the build (and are checked like any page); without it their presence fails.
// Exit codes: 0 clean, 1 rule failures, 2 usage error or no build.
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csp } from '../src/lib/csp.ts';
import { verifyDist, type VerifyResult } from './lib/verify/dist.ts';
import { expectedPolicy } from './lib/verify/policy.ts';

const args = process.argv.slice(2);
if (args.length > 1 || args.some((a) => a.startsWith('-'))) {
  console.error('usage: node scripts/verify-dist.ts [distDir]');
  process.exit(2);
}
const dist = args[0] ? resolve(args[0]) : fileURLToPath(new URL('../dist/', import.meta.url));

let result: VerifyResult;
try {
  result = verifyDist(dist, { lab: process.env.MONSUN_LAB === '1', expected: expectedPolicy(csp) });
} catch (error) {
  console.error(`verify-dist: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const shown = relative(process.cwd(), dist) || '.';
for (const { file, rule, message } of result.findings) console.error(`${join(shown, file)}: [${rule}] ${message}`);
const files = new Set(result.findings.map((f) => f.file)).size;
if (result.findings.length > 0) {
  console.error(`verify-dist: ${result.findings.length} problem(s) in ${files} file(s); ${result.pages} page(s) checked`);
  process.exitCode = 1;
} else {
  console.log(`verify-dist: ${result.pages} page(s) checked, no problems`);
}
