// Reads the metadata in an image file that can place or identify the person who took it: EXIF (with its GPS
// IFD) and XMP, in JPEG, PNG and WebP. Node built-ins only, so check-images can also run on the host.
// It reads by structure, not by file extension, and reports what it cannot read rather than guessing: the
// public git history keeps whatever is pushed (ADR 0001 §9, "Public history").
import { inflateSync } from 'node:zlib';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'heif' | 'avif' | 'tiff';

export interface Metadata {
  format: ImageFormat;
  /** GPS fields found: EXIF GPS tag names, or "XMP <property>". Any entry means the file reveals a location. */
  gps: string[];
  /** Other EXIF tags found (names, or hex ids). */
  exif: string[];
  /** Number of XMP packets found. */
  xmp: number;
  /** Reasons the file could not be fully read; the check must then fail, since GPS cannot be ruled out. */
  unreadable: string[];
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, Math.min(start + length, bytes.length)));
const startsWith = (bytes: Uint8Array, prefix: string, at = 0) => ascii(bytes, at, prefix.length) === prefix;

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'mif2']);

/** The image format from the first bytes of a file (at least 32 are needed for HEIF/AVIF), or null. */
export function detectFormat(head: Uint8Array): ImageFormat | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (startsWith(head, '\x89PNG\r\n\x1a\n')) return 'png';
  if (startsWith(head, 'RIFF') && startsWith(head, 'WEBP', 8)) return 'webp';
  if (startsWith(head, 'GIF8')) return 'gif';
  if (startsWith(head, 'II*\0') || startsWith(head, 'MM\0*')) return 'tiff';
  if (startsWith(head, 'ftyp', 4)) {
    const size = Math.min(new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(0), head.length);
    const brands = [ascii(head, 8, 4)];
    for (let p = 16; p + 4 <= size; p += 4) brands.push(ascii(head, p, 4));
    if (brands.some((b) => b === 'avif' || b === 'avis')) return 'avif';
    if (brands.some((b) => HEIF_BRANDS.has(b))) return 'heif';
  }
  return null;
}

/** EXIF and XMP metadata of an image; null when the bytes are not an image format this module knows. */
export function readMetadata(bytes: Uint8Array): Metadata | null {
  const format = detectFormat(bytes.subarray(0, 64));
  if (format === null) return null;
  const found = new Found(format);
  try {
    if (format === 'jpeg') readJpeg(bytes, found);
    else if (format === 'png') readPng(bytes, found);
    else if (format === 'webp') readWebp(bytes, found);
    else if (format !== 'gif') found.unreadable.add(`${format.toUpperCase()} is not checked here; convert it to JPEG with scripts/strip-images.ts`);
  } catch (error) {
    found.unreadable.add(`unexpected structure (${error instanceof Error ? error.message : String(error)})`);
  }
  return found.result();
}

class Found {
  readonly gps = new Set<string>();
  readonly exif = new Set<string>();
  readonly unreadable = new Set<string>();
  xmp = 0;
  readonly format: ImageFormat;

  constructor(format: ImageFormat) {
    this.format = format;
  }

  result(): Metadata {
    return { format: this.format, gps: [...this.gps], exif: [...this.exif], xmp: this.xmp, unreadable: [...this.unreadable] };
  }
}

function readJpeg(bytes: Uint8Array, found: Found) {
  // Walk the leading segments to make sure the file is what it claims; metadata sits before the first scan.
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) {
      found.unreadable.add('broken JPEG segment structure');
      break;
    }
    const marker = bytes[p + 1]!;
    if (marker === 0xff) p += 1; // fill byte
    else if (marker === 0xd9 || marker === 0xda) break; // end of image, start of scan
    else if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) p += 2;
    else {
      const length = (bytes[p + 2]! << 8) | bytes[p + 3]!;
      if (length < 2 || p + 2 + length > bytes.length) {
        found.unreadable.add('truncated JPEG segment');
        break;
      }
      p += 2 + length;
    }
  }
  // Then every APP1 segment anywhere in the file: embedded images (thumbnails, HDR gain maps, MPF pictures)
  // carry their own EXIF. FF E1 cannot occur inside compressed scan data, where FF is followed by 00 or D0–D7.
  for (let i = 0; i + 4 <= bytes.length; i += 1) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xe1) continue;
    const end = i + 2 + ((bytes[i + 2]! << 8) | bytes[i + 3]!);
    const payload = bytes.subarray(i + 4, Math.min(end, bytes.length));
    if (startsWith(payload, 'Exif\0\0')) {
      if (end > bytes.length) found.unreadable.add('truncated EXIF segment');
      readExif(payload.subarray(6), found);
    } else if (startsWith(payload, 'http://ns.adobe.com/xap/1.0/\0') || startsWith(payload, 'http://ns.adobe.com/xmp/extension/\0')) {
      readXmp(new TextDecoder().decode(payload), found);
    }
  }
}

function readPng(bytes: Uint8Array, found: Found) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  while (p + 8 <= bytes.length) {
    const length = view.getUint32(p);
    const type = ascii(bytes, p + 4, 4);
    if (p + 12 + length > bytes.length) {
      found.unreadable.add(`truncated PNG chunk ${JSON.stringify(type)}`);
      return;
    }
    const data = bytes.subarray(p + 8, p + 8 + length);
    if (type === 'eXIf') readExif(withoutExifHeader(data), found);
    else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') readPngText(type, data, found);
    p += 12 + length;
    if (type === 'IEND') return;
  }
  found.unreadable.add('PNG ends without an IEND chunk');
}

function readPngText(type: string, data: Uint8Array, found: Found) {
  const nul = data.indexOf(0);
  if (nul < 0) return;
  const keyword = ascii(data, 0, nul);
  let text: string;
  try {
    if (type === 'tEXt') text = latin1(data.subarray(nul + 1));
    else if (type === 'zTXt') text = latin1(inflateSync(data.subarray(nul + 2)));
    else {
      const compressed = data[nul + 1] === 1;
      const lang = data.indexOf(0, nul + 3);
      const translated = lang < 0 ? -1 : data.indexOf(0, lang + 1);
      if (translated < 0) throw new Error('malformed iTXt');
      const body = data.subarray(translated + 1);
      text = new TextDecoder().decode(compressed ? inflateSync(body) : body);
    }
  } catch {
    found.unreadable.add(`unreadable PNG text chunk ${JSON.stringify(keyword)}`);
    return;
  }
  // ImageMagick and exiftool keep EXIF and XMP as hex "raw profiles" in text chunks.
  const profile = /^Raw profile type (exif|app1|xmp)$/i.exec(keyword)?.[1]?.toLowerCase();
  if (profile) {
    const hex = text.split('\n').slice(3).join('').replace(/\s/g, '');
    const raw = Uint8Array.from(Buffer.from(hex, 'hex'));
    if (profile === 'xmp') readXmp(latin1(raw), found);
    else readExif(withoutExifHeader(raw), found);
  } else if (keyword === 'XML:com.adobe.xmp') {
    readXmp(text, found);
  } else {
    gpsInText(text, `PNG text "${keyword}"`, found);
  }
}

function readWebp(bytes: Uint8Array, found: Found) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = Math.min(8 + view.getUint32(4, true), bytes.length);
  let p = 12;
  while (p + 8 <= end) {
    const type = ascii(bytes, p, 4);
    const length = view.getUint32(p + 4, true);
    if (p + 8 + length > bytes.length) {
      found.unreadable.add(`truncated WebP chunk ${JSON.stringify(type)}`);
      return;
    }
    const data = bytes.subarray(p + 8, p + 8 + length);
    if (type === 'EXIF') readExif(withoutExifHeader(data), found);
    else if (type === 'XMP ') readXmp(new TextDecoder().decode(data), found);
    p += 8 + length + (length & 1);
  }
}

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
const withoutExifHeader = (bytes: Uint8Array) => (startsWith(bytes, 'Exif\0\0') ? bytes.subarray(6) : bytes);

function readXmp(text: string, found: Found) {
  found.xmp += 1;
  gpsInText(text, 'XMP', found);
}

/** GPS coordinates written as text: XMP exif:GPSLatitude, DJI's drone-dji:GpsLongitude and the like. */
function gpsInText(text: string, where: string, found: Found) {
  for (const m of text.matchAll(/[\w-]*:?gps(?:dest)?(?:latitude|longitude|altitude)\b/gi)) found.gps.add(`${where} ${m[0]}`);
}

const POINTERS: Record<number, string> = { 0x8769: 'Exif IFD', 0xa005: 'Interoperability IFD' };
const TAGS: Record<number, string> = {
  0x010e: 'ImageDescription', 0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x011a: 'XResolution',
  0x011b: 'YResolution', 0x0128: 'ResolutionUnit', 0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist',
  0x0201: 'JPEGInterchangeFormat', 0x0202: 'JPEGInterchangeFormatLength', 0x0213: 'YCbCrPositioning',
  0x8298: 'Copyright', 0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8827: 'ISOSpeedRatings', 0x9000: 'ExifVersion',
  0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized', 0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal',
  0x920a: 'FocalLength', 0x927c: 'MakerNote', 0x9286: 'UserComment', 0xa001: 'ColorSpace', 0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension', 0xa420: 'ImageUniqueID', 0xa430: 'CameraOwnerName', 0xa431: 'BodySerialNumber',
  0xa433: 'LensMake', 0xa434: 'LensModel',
};
const GPS_TAGS: Record<number, string> = {
  0x00: 'GPSVersionID', 0x01: 'GPSLatitudeRef', 0x02: 'GPSLatitude', 0x03: 'GPSLongitudeRef', 0x04: 'GPSLongitude',
  0x05: 'GPSAltitudeRef', 0x06: 'GPSAltitude', 0x07: 'GPSTimeStamp', 0x10: 'GPSImgDirectionRef', 0x11: 'GPSImgDirection',
  0x12: 'GPSMapDatum', 0x13: 'GPSDestLatitudeRef', 0x14: 'GPSDestLatitude', 0x15: 'GPSDestLongitudeRef',
  0x16: 'GPSDestLongitude', 0x1b: 'GPSProcessingMethod', 0x1d: 'GPSDateStamp', 0x1f: 'GPSHPositioningError',
};
const hex = (tag: number) => `0x${tag.toString(16).padStart(4, '0')}`;
const MAX_IFDS = 32;

/**
 * Walks a TIFF structure (the body of an EXIF block): IFD0 and the IFDs chained after it, the Exif and
 * Interoperability sub-IFDs, and the GPS IFD. A GPSInfo pointer counts as GPS even when its IFD is empty or
 * unreadable.
 */
function readExif(tiff: Uint8Array, found: Found) {
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const order = ascii(tiff, 0, 2);
  if ((order !== 'II' && order !== 'MM') || tiff.length < 8) {
    found.unreadable.add('EXIF block without a valid TIFF header');
    return;
  }
  const little = order === 'II';
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  if (u16(2) !== 42) {
    found.unreadable.add('EXIF block without a valid TIFF header');
    return;
  }

  const queue: { offset: number; gps: boolean; chained: boolean }[] = [{ offset: u32(4), gps: false, chained: true }];
  const visited = new Set<number>();
  while (queue.length > 0) {
    const { offset, gps, chained } = queue.shift()!;
    if (offset === 0 && !gps) continue; // end of the IFD chain
    if (visited.has(offset)) continue;
    if (visited.size >= MAX_IFDS) {
      found.unreadable.add('EXIF block with too many IFDs');
      return;
    }
    visited.add(offset);
    if (offset < 8 || offset + 2 > tiff.length || offset + 2 + 12 * u16(offset) > tiff.length) {
      if (gps) found.gps.add('GPSInfo (IFD unreadable)');
      found.unreadable.add('EXIF IFD outside the block');
      continue;
    }
    const count = u16(offset);
    if (gps && count === 0) found.gps.add('GPSInfo (empty IFD)');
    for (let e = 0; e < count; e += 1) {
      const entry = offset + 2 + 12 * e;
      const tag = u16(entry);
      if (gps) found.gps.add(GPS_TAGS[tag] ?? `GPS tag ${hex(tag)}`);
      else if (tag === 0x8825) queue.push({ offset: u32(entry + 8), gps: true, chained: false });
      else if (POINTERS[tag]) queue.push({ offset: u32(entry + 8), gps: false, chained: false });
      else found.exif.add(TAGS[tag] ?? hex(tag));
    }
    const next = offset + 2 + 12 * count;
    if (chained && next + 4 <= tiff.length) queue.push({ offset: u32(next), gps: false, chained: true });
  }
}
