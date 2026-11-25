// The images:check rules (ADR 0001 §9, "Public history"; plan 0002, chunk A1): an image with GPS data, or one
// whose metadata cannot be read, fails; any other EXIF or XMP is a warning. Files are recognised by their
// bytes, so a renamed HEIC is caught too. Node built-ins only.
import { closeSync, lstatSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { detectFormat, readMetadata } from './metadata.ts';

export interface ImageProblem {
  file: string;
  level: 'error' | 'warning';
  message: string;
}

export interface CheckResult {
  images: number;
  problems: ImageProblem[];
}

const SKIPPED_DIRS = new Set(['node_modules', '.git']);
const STRIP_HINT = 'run it through scripts/strip-images.ts';

/** The problems of one image file's bytes; an empty list for a clean image or a file that is not an image. */
export function checkImage(file: string, bytes: Uint8Array): ImageProblem[] {
  const metadata = readMetadata(bytes);
  if (metadata === null) {
    return /\.(heic|heif)$/i.test(file) ? [{ file, level: 'error', message: `HEIC/HEIF photo cannot be checked or shown on the site; ${STRIP_HINT} as JPEG` }] : [];
  }
  const problems: ImageProblem[] = [];
  if (metadata.gps.length > 0) problems.push({ file, level: 'error', message: `GPS location data (${metadata.gps.join(', ')}); ${STRIP_HINT}` });
  for (const reason of metadata.unreadable) problems.push({ file, level: 'error', message: `cannot rule out GPS data: ${reason}` });
  if (metadata.gps.length === 0 && metadata.exif.length > 0) {
    problems.push({ file, level: 'warning', message: `EXIF metadata without GPS (${metadata.exif.join(', ')}); consider stripping it` });
  }
  if (metadata.gps.length === 0 && metadata.xmp > 0) problems.push({ file, level: 'warning', message: 'XMP metadata without GPS; consider stripping it' });
  return problems;
}

/** Checks files and directories (recursively; symlinks are reported, never followed). Paths are kept as given. */
export function checkPaths(paths: string[]): CheckResult {
  const result: CheckResult = { images: 0, problems: [] };
  const visit = (path: string) => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      result.problems.push({ file: path, level: 'warning', message: 'symlink, not followed' });
    } else if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) if (!SKIPPED_DIRS.has(entry)) visit(join(path, entry));
    } else if (stat.isFile()) {
      const isImage = detectFormat(readHead(path)) !== null || /\.(heic|heif)$/i.test(path);
      if (!isImage) return;
      result.images += 1;
      result.problems.push(...checkImage(path, readFileSync(path)));
    }
  };
  for (const path of paths) visit(path);
  return result;
}

function readHead(path: string): Uint8Array {
  const head = new Uint8Array(64);
  const fd = openSync(path, 'r');
  try {
    return head.subarray(0, readSync(fd, head, 0, head.length, 0));
  } finally {
    closeSync(fd);
  }
}
