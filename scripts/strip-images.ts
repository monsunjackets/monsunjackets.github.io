// Image intake (plan 0002, chunk C4): converts every photo in <inputDir> into a metadata-free sRGB JPEG in
// <outputDir>, upright, with a long side of at most 2400 px, keeping the folder layout. HEIC is refused.
// Usage: node scripts/strip-images.ts <inputDir> <outputDir>
//
// It is not an npm script and does not run through scripts/dock: no container ever gets a writable checkout
// (ADR 0001, amendments after review G1). Run it in a throwaway container that sees the incoming folder
// read-only, a fresh output folder outside the checkout, and this checkout's scripts/ and node_modules/
// read-only (for sharp), then copy back regular .jpg files only. From the site checkout:
//
//   docker run --rm --network none --user "$(id -u):$(id -g)" --cap-drop=ALL --security-opt=no-new-privileges \
//     --read-only --tmpfs /tmp \
//     --mount type=bind,src="$PWD/scripts",dst=/app/scripts,readonly \
//     --mount type=bind,src="$PWD/node_modules",dst=/app/node_modules,readonly \
//     --mount type=bind,src="$PWD/package.json",dst=/app/package.json,readonly \
//     --mount type=bind,src="$IN",dst=/in,readonly --mount type=bind,src="$OUT",dst=/out \
//     <the node image pinned in scripts/dock> node /app/scripts/strip-images.ts /in /out
//
// Exit codes: 0 all images written, 1 some refused, 2 usage error.
import { stripDir, type StripReport } from './lib/images/strip.ts';

const args = process.argv.slice(2);
if (args.length !== 2 || args.some((a) => a.startsWith('-'))) {
  console.error('usage: node scripts/strip-images.ts <inputDir> <outputDir>');
  process.exit(2);
}

let report: StripReport;
try {
  report = await stripDir(args[0]!, args[1]!);
} catch (error) {
  console.error(`strip-images: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

for (const { file, width, height, flattened } of report.written) {
  console.log(`wrote ${file} (${width}×${height}${flattened ? ', transparency flattened onto white' : ''})`);
}
for (const { file, reason } of report.skipped) console.log(`skipped ${file}: ${reason}`);
for (const { file, reason } of report.refused) console.error(`refused ${file}: ${reason}`);
console.log(`strip-images: ${report.written.length} written, ${report.refused.length} refused, ${report.skipped.length} skipped`);
if (report.refused.length > 0) process.exitCode = 1;
