// scripts/strip-images.ts: generated photos carrying GPS come out upright, small enough and without metadata.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { checkImage } from '../scripts/lib/images/check.ts';
import { readMetadata } from '../scripts/lib/images/metadata.ts';
import { HEIC_REFUSAL, MAX_LONG_SIDE, RefusedError, stripDir, stripImage } from '../scripts/lib/images/strip.ts';
import { exifSegment, exifTiff, heic, png, withSegments, xmpSegment, XMP_WITH_GPS } from './fixtures/images.ts';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 31, g: 85, b: 98 } } }).jpeg().toBuffer();

/** A generated "phone photo": landscape pixels, EXIF Orientation 6 (rotate 90° clockwise), GPS in EXIF and XMP. */
async function phonePhoto(width = 40, height = 20) {
  return withSegments(await solid(width, height), exifSegment(exifTiff({ gps: true, camera: true, orientation: 6 })), xmpSegment(XMP_WITH_GPS));
}

async function assertClean(data: Uint8Array) {
  assert.deepEqual(checkImage('out.jpg', data), []);
  const metadata = await sharp(data).metadata();
  assert.equal(metadata.format, 'jpeg');
  for (const key of ['exif', 'xmp', 'iptc', 'icc'] as const) assert.equal(metadata[key], undefined, `${key} left in the output`);
}

describe('stripImage', () => {
  test('a JPEG with GPS comes out upright and with no metadata at all', async () => {
    const input = await phonePhoto();
    assert.ok(readMetadata(input)!.gps.length > 0, 'the fixture carries GPS');
    const { data, width, height } = await stripImage(input);
    assert.deepEqual([width, height], [20, 40]);
    await assertClean(data);
  });

  test('a PNG with GPS and transparency comes out as an opaque JPEG with no metadata', async () => {
    const input = png([{ type: 'eXIf', data: exifTiff({ gps: true }) }], { width: 6, height: 3, alpha: 0 });
    assert.ok(readMetadata(input)!.gps.length > 0, 'the fixture carries GPS');
    const { data, width, height, flattened } = await stripImage(input);
    assert.deepEqual([width, height, flattened], [6, 3, true]);
    await assertClean(data);
  });

  test(`the long side is cut to ${MAX_LONG_SIDE} px and small images are not enlarged`, async () => {
    const large = await stripImage(await solid(3000, 1000));
    assert.deepEqual([large.width, large.height], [MAX_LONG_SIDE, 800]);
    const small = await stripImage(await solid(300, 200));
    assert.deepEqual([small.width, small.height], [300, 200]);
  });

  test('HEIC is refused with export instructions, even under another name', async () => {
    await assert.rejects(stripImage(heic(), 'IMG_0001.jpg'), (error) => error instanceof RefusedError && error.message === HEIC_REFUSAL);
    await assert.rejects(stripImage(new Uint8Array(16), 'IMG_0001.heic'), RefusedError);
  });
});

describe('stripDir and the CLI', () => {
  const root = mkdtempSync(join(tmpdir(), 'strip-images-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const input = join(root, 'in');
  const script = fileURLToPath(new URL('../scripts/strip-images.ts', import.meta.url));
  const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

  test('converts a folder tree, keeps its layout, and skips symlinks and non-images', async () => {
    mkdirSync(join(input, 'ramoneska'), { recursive: true });
    writeFileSync(join(input, 'ramoneska', 'ramoneska__front__in.jpg'), await phonePhoto());
    writeFileSync(join(input, 'ramoneska', 'ramoneska__front__out.png'), png([{ type: 'eXIf', data: exifTiff({ gps: true }) }]));
    writeFileSync(join(input, 'notes.txt'), 'not an image');
    symlinkSync(join(input, 'notes.txt'), join(input, 'link.jpg'));
    const output = join(root, 'out');

    const report = await stripDir(input, output);
    assert.deepEqual(report.written.map((w) => w.file), ['ramoneska/ramoneska__front__in.jpg', 'ramoneska/ramoneska__front__out.jpg']);
    assert.deepEqual(report.skipped.map((s) => s.file), ['link.jpg', 'notes.txt']);
    assert.deepEqual(report.refused, []);
    for (const { file } of report.written) await assertClean(readFileSync(join(output, file)));
    assert.equal(existsSync(join(output, 'link.jpg')), false);
  });

  test('refuses HEIC, name clashes and existing outputs, and never writes inside the input', async () => {
    const other = join(root, 'in2');
    mkdirSync(other);
    writeFileSync(join(other, 'a.png'), png());
    writeFileSync(join(other, 'a.webp'), await sharp(png()).webp().toBuffer());
    writeFileSync(join(other, 'b.heic'), heic());
    const output = join(root, 'out2');
    mkdirSync(output);
    writeFileSync(join(output, 'c.jpg'), 'already here');
    writeFileSync(join(other, 'c.jpg'), await solid(10, 10));

    const report = await stripDir(other, output);
    assert.deepEqual(report.written.map((w) => w.file), ['a.jpg']);
    assert.deepEqual(report.refused.map((r) => r.file), ['a.webp', 'b.heic', 'c.jpg']);
    assert.equal(readFileSync(join(output, 'c.jpg'), 'utf8'), 'already here');
    await assert.rejects(stripDir(other, join(other, 'out')), /outside the input/);
  });

  test('the CLI exits 0 when everything is written, 1 when something is refused, 2 on bad usage', () => {
    assert.equal(run(input, join(root, 'cli-out')).status, 0);
    const refused = run(join(root, 'in2'), join(root, 'cli-out2'));
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /refused b\.heic: HEIC\/HEIF is not supported/);
    assert.equal(run(input).status, 2);
  });
});
