// Prepares photos for the public repo (plan 0002, chunks A1 and C4): turns the image upright from its EXIF
// orientation, drops every piece of metadata (EXIF with GPS, XMP, IPTC, ICC), converts to sRGB and writes a
// JPEG whose long side is at most 2400 px. HEIC is refused with a message on how to export a JPEG instead.
// Uses sharp, which Astro already installs; nothing else in scripts/ depends on it.
import { lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { detectFormat, readMetadata, type ImageFormat } from './metadata.ts';

export const MAX_LONG_SIDE = 2400;
const JPEG_QUALITY = 85;
const CONVERTED = new Set<ImageFormat>(['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif']);

export const HEIC_REFUSAL =
  'HEIC/HEIF is not supported: export the photo as JPEG and run again ' +
  '(iPhone: share it with Options > Format > "Most Compatible", or set Settings > Camera > Formats > Most Compatible)';

/** An input this tool will not convert; the message says what to do instead. */
export class RefusedError extends Error {}

export interface StrippedImage {
  data: Buffer;
  width: number;
  height: number;
  /** The input had transparent pixels, now on white. */
  flattened: boolean;
}

export async function stripImage(input: Uint8Array, name = ''): Promise<StrippedImage> {
  const format = detectFormat(input.subarray(0, 64));
  if (format === 'heif' || (format === null && /\.(heic|heif)$/i.test(name))) throw new RefusedError(HEIC_REFUSAL);
  if (format === null || !CONVERTED.has(format)) throw new RefusedError('not an image this tool converts (JPEG, PNG, WebP, AVIF, TIFF or GIF)');

  const options = { failOn: 'error' } as const;
  const { hasAlpha } = await sharp(input, options).metadata();
  const flattened = hasAlpha === true && !(await sharp(input, options).stats()).isOpaque;
  // Without keepMetadata/withMetadata, sharp writes no metadata at all and converts to sRGB.
  const { data, info } = await sharp(input, options)
    .autoOrient()
    .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const left = readMetadata(data);
  if (!left || left.gps.length > 0 || left.exif.length > 0 || left.xmp > 0 || left.unreadable.length > 0) {
    throw new Error('the converted image still carries metadata; not writing it');
  }
  return { data, width: info.width, height: info.height, flattened };
}

export interface StripReport {
  /** Output paths relative to the output folder, with the size written. */
  written: { file: string; width: number; height: number; flattened: boolean }[];
  /** Inputs that were not converted, with the reason. */
  refused: { file: string; reason: string }[];
  /** Entries left alone: symlinks and files that are not images. */
  skipped: { file: string; reason: string }[];
}

/**
 * Converts every image under `inputDir` into `outputDir`, keeping the folder layout and changing the extension
 * to .jpg. Never follows symlinks and never overwrites a file, so the output folder should start empty.
 */
export async function stripDir(inputDir: string, outputDir: string): Promise<StripReport> {
  const input = resolve(inputDir);
  const output = resolve(outputDir);
  if (!statSync(input, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`${inputDir} is not a directory`);
  if (output === input || output.startsWith(input + sep)) throw new Error('the output folder must be outside the input folder');
  if (input.startsWith(output + sep)) throw new Error('the input folder must be outside the output folder');
  mkdirSync(output, { recursive: true });

  const report: StripReport = { written: [], refused: [], skipped: [] };
  const claimed = new Map<string, string>();
  const visit = async (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      const file = relative(input, path).split(sep).join('/');
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) report.skipped.push({ file, reason: 'symlink, not followed' });
      else if (stat.isDirectory()) await visit(path);
      else if (!stat.isFile()) report.skipped.push({ file, reason: 'not a regular file' });
      else await convert(path, file);
    }
  };
  const convert = async (path: string, file: string) => {
    const bytes = readFileSync(path);
    if (detectFormat(bytes.subarray(0, 64)) === null && !/\.(heic|heif)$/i.test(file)) {
      report.skipped.push({ file, reason: 'not an image' });
      return;
    }
    const target = `${file.slice(0, file.length - extname(file).length)}.jpg`;
    if (claimed.has(target)) {
      report.refused.push({ file, reason: `${claimed.get(target)} already becomes ${target}; rename one of them` });
      return;
    }
    claimed.set(target, file);
    try {
      const image = await stripImage(bytes, file);
      mkdirSync(dirname(join(output, target)), { recursive: true });
      writeFileSync(join(output, target), image.data, { flag: 'wx' });
      report.written.push({ file: target, width: image.width, height: image.height, flattened: image.flattened });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const reason = code === 'EEXIST' ? `${target} already exists in the output folder; use an empty one` : error instanceof Error ? error.message : String(error);
      report.refused.push({ file, reason });
    }
  };
  await visit(input);
  return report;
}
