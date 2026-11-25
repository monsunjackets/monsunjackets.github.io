// images:check (scripts/check-images.ts): GPS data fails, unreadable metadata fails, other EXIF/XMP warns.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkImage, checkPaths, type ImageProblem } from '../scripts/lib/images/check.ts';
import { detectFormat, readMetadata } from '../scripts/lib/images/metadata.ts';
import {
  exifSegment, exifTiff, heic, jpeg, png, pngText, rawExifProfile, webp, xmpSegment, XMP_WITH_GPS, XMP_WITHOUT_GPS,
} from './fixtures/images.ts';

const levels = (problems: ImageProblem[]) => problems.map((p) => p.level);
const errorsOf = (file: string, bytes: Uint8Array) => checkImage(file, bytes).filter((p) => p.level === 'error');
const exifChunk = (spec: Parameters<typeof exifTiff>[0]) => ({ type: 'eXIf', data: exifTiff(spec) });

describe('format detection', () => {
  test('recognises images by their bytes, not their names', () => {
    assert.equal(detectFormat(jpeg()), 'jpeg');
    assert.equal(detectFormat(png()), 'png');
    assert.equal(detectFormat(webp([])), 'webp');
    assert.equal(detectFormat(heic()), 'heif');
    assert.equal(detectFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  });
});

describe('JPEG', () => {
  test('GPS in EXIF fails, little- and big-endian', () => {
    for (const bigEndian of [false, true]) {
      const [error, ...rest] = errorsOf('a.jpg', jpeg(exifSegment(exifTiff({ gps: true, bigEndian }))));
      assert.equal(rest.length, 0);
      assert.match(error!.message, /GPSLatitude.*GPSLongitude/);
    }
  });

  test('EXIF without GPS only warns, and names the tags', () => {
    const problems = checkImage('a.jpg', jpeg(exifSegment(exifTiff({ camera: true, orientation: 6 }))));
    assert.deepEqual(levels(problems), ['warning']);
    assert.match(problems[0]!.message, /Make, Model, Orientation/);
  });

  test('a JPEG without metadata is clean', () => {
    assert.deepEqual(checkImage('a.jpg', jpeg()), []);
  });

  test('GPS in XMP fails; XMP without GPS warns', () => {
    assert.match(errorsOf('a.jpg', jpeg(xmpSegment(XMP_WITH_GPS)))[0]!.message, /XMP exif:GPSLatitude/);
    assert.deepEqual(levels(checkImage('a.jpg', jpeg(xmpSegment(XMP_WITHOUT_GPS)))), ['warning']);
  });

  test('GPS in an embedded image after the main one fails (thumbnails, gain maps)', () => {
    const second = jpeg(exifSegment(exifTiff({ gps: true })));
    const bytes = Uint8Array.from([...jpeg(), ...second]);
    assert.equal(errorsOf('a.jpg', bytes).length, 1);
  });

  test('a GPSInfo pointer that leads nowhere still fails', () => {
    const errors = errorsOf('a.jpg', jpeg(exifSegment(exifTiff({ brokenGpsPointer: true }))));
    assert.ok(errors.some((e) => /GPSInfo/.test(e.message)));
  });

  test('a truncated EXIF segment fails closed', () => {
    const whole = jpeg(exifSegment(exifTiff({ camera: true })));
    const errors = errorsOf('a.jpg', whole.subarray(0, 40));
    assert.ok(errors.some((e) => /cannot rule out GPS/.test(e.message)));
  });
});

describe('PNG', () => {
  test('GPS in eXIf fails; eXIf without GPS warns; no metadata is clean', () => {
    assert.equal(errorsOf('a.png', png([exifChunk({ gps: true })])).length, 1);
    assert.deepEqual(levels(checkImage('a.png', png([exifChunk({ camera: true })]))), ['warning']);
    assert.deepEqual(checkImage('a.png', png()), []);
  });

  test('GPS in an ImageMagick raw EXIF profile (zTXt) fails', () => {
    const chunk = pngText('zTXt', 'Raw profile type exif', rawExifProfile(exifTiff({ gps: true })));
    assert.match(errorsOf('a.png', png([chunk]))[0]!.message, /GPSLatitude/);
  });

  test('GPS in XMP (iTXt) or in a plain text chunk fails', () => {
    assert.equal(errorsOf('a.png', png([pngText('iTXt', 'XML:com.adobe.xmp', XMP_WITH_GPS)])).length, 1);
    assert.equal(errorsOf('a.png', png([pngText('tEXt', 'Comment', 'exif:GPSLongitude=17.03')])).length, 1);
  });

  test('a truncated PNG fails closed', () => {
    const whole = png([exifChunk({ camera: true })]);
    assert.ok(errorsOf('a.png', whole.subarray(0, whole.length - 30)).length > 0);
  });
});

describe('WebP', () => {
  test('GPS in EXIF or XMP fails; EXIF without GPS warns; no metadata is clean', () => {
    assert.equal(errorsOf('a.webp', webp([{ type: 'EXIF', data: exifTiff({ gps: true }) }])).length, 1);
    assert.equal(errorsOf('a.webp', webp([{ type: 'XMP ', data: new TextEncoder().encode(XMP_WITH_GPS) }])).length, 1);
    assert.deepEqual(levels(checkImage('a.webp', webp([{ type: 'EXIF', data: exifTiff({ camera: true }) }]))), ['warning']);
    assert.deepEqual(checkImage('a.webp', webp([])), []);
  });
});

describe('formats that are not read', () => {
  test('HEIC fails, even under a .jpg name', () => {
    assert.equal(errorsOf('IMG_0001.jpg', heic()).length, 1);
    assert.equal(errorsOf('IMG_0001.HEIC', new Uint8Array(16)).length, 1);
  });

  test('files that are not images are ignored', () => {
    assert.deepEqual(checkImage('logo.svg', new TextEncoder().encode('<svg/>')), []);
    assert.equal(readMetadata(new TextEncoder().encode('plain text')), null);
  });
});

describe('checkPaths and the CLI', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-images-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const clean = join(root, 'clean');
  const dirty = join(root, 'dirty');
  mkdirSync(join(clean, 'nested'), { recursive: true });
  mkdirSync(dirty);
  writeFileSync(join(clean, 'nested', 'photo.jpg'), jpeg());
  writeFileSync(join(clean, 'camera.png'), png([exifChunk({ camera: true })]));
  writeFileSync(join(clean, 'notes.txt'), 'not an image');
  symlinkSync('/etc/hostname', join(clean, 'link.jpg'));
  writeFileSync(join(dirty, 'phone.jpg'), jpeg(exifSegment(exifTiff({ gps: true }))));
  const script = fileURLToPath(new URL('../scripts/check-images.ts', import.meta.url));
  const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

  test('walks folders, counts images only, and reports symlinks without following them', () => {
    const { images, problems } = checkPaths([clean]);
    assert.equal(images, 2);
    assert.deepEqual(
      problems.map((p) => [p.file.slice(root.length), p.level]),
      [['/clean/camera.png', 'warning'], ['/clean/link.jpg', 'warning']],
    );
  });

  test('exits 0 on warnings, 1 on GPS (naming the file), 2 on a missing path', () => {
    assert.equal(run(clean).status, 0);
    const failed = run(clean, dirty);
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /phone\.jpg: error: GPS location data/);
    assert.equal(run(join(root, 'missing')).status, 2);
  });

  test('without arguments it checks src and public, which are clean', () => {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
  });
});
