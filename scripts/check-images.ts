// Fails when an image in the repo carries GPS data, and warns on any other EXIF or XMP metadata
// (ADR 0001 §9, "Public history"; plan 0002, chunk A1). Runs as `npm run images:check` in the CI build job.
// Usage: node scripts/check-images.ts [path...]   (default: src and public next to this scripts/ folder)
//
// Node built-ins only, so it can also run on the host (for example from a pre-commit hook) without npm.
// JPEG, PNG and WebP are read; HEIC, AVIF and TIFF fail because their metadata is not read here.
// To clean an image, use scripts/strip-images.ts. Exit codes: 0 clean (warnings allowed), 1 errors, 2 usage.
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPaths } from './lib/images/check.ts';

const args = process.argv.slice(2);
if (args.some((a) => a.startsWith('-'))) {
  console.error('usage: node scripts/check-images.ts [path...]');
  process.exit(2);
}
const paths = args.length > 0 ? args : ['src', 'public'].map((dir) => fileURLToPath(new URL(`../${dir}`, import.meta.url)));
const missing = paths.filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.error(`check-images: no such file or directory: ${missing.join(', ')}`);
  process.exit(2);
}

const { images, problems } = checkPaths(paths);
for (const { file, level, message } of problems) console.error(`${relative(process.cwd(), file) || file}: ${level}: ${message}`);
const errors = problems.filter((p) => p.level === 'error').length;
const warnings = problems.length - errors;
const summary = `check-images: ${images} image(s) checked, ${errors} error(s), ${warnings} warning(s)`;
if (errors > 0) {
  console.error(summary);
  process.exitCode = 1;
} else {
  console.log(summary);
}
