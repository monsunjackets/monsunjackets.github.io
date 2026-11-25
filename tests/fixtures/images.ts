// Builders for tiny synthetic image files with chosen metadata, for the image tests. No real photos: every
// byte is generated here. JPEG and WebP fixtures are structurally valid containers but carry no decodable
// picture; png() makes a real, decodable PNG.
import { crc32, deflateSync } from 'node:zlib';

const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => [...p]));

export interface ExifSpec {
  /** Add a GPS IFD with latitude and longitude. */
  gps?: boolean;
  /** Add Make and Model. */
  camera?: boolean;
  /** EXIF Orientation (1–8). */
  orientation?: number;
  bigEndian?: boolean;
  /** Point GPSInfo past the end of the block. */
  brokenGpsPointer?: boolean;
}

/** A TIFF structure as found in an EXIF block (without the "Exif\0\0" header). */
export function exifTiff(spec: ExifSpec = {}): Uint8Array {
  const buffer = new ArrayBuffer(512);
  const view = new DataView(buffer);
  const little = !spec.bigEndian;
  const u16 = (at: number, v: number) => view.setUint16(at, v, little);
  const u32 = (at: number, v: number) => view.setUint32(at, v, little);
  let data = 300; // values that do not fit in an entry go here
  const putData = (values: Uint8Array) => {
    const at = data;
    new Uint8Array(buffer).set(values, at);
    data += values.length + (values.length & 1);
    return at;
  };

  new Uint8Array(buffer).set(bytes(little ? 'II' : 'MM'), 0);
  u16(2, 42);
  u32(4, 8);
  type Entry = [tag: number, type: number, count: number, write: (at: number) => void];
  const ascii = (tag: number, text: string): Entry => {
    const value = bytes(`${text}\0`);
    return [tag, 2, value.length, (at) => (value.length <= 4 ? new Uint8Array(buffer).set(value, at) : u32(at, putData(value)))];
  };
  const rationals = (tag: number, values: number[]): Entry => [tag, 5, values.length, (at) => {
    const raw = new DataView(new ArrayBuffer(values.length * 8));
    values.forEach((v, i) => (raw.setUint32(i * 8, v, little), raw.setUint32(i * 8 + 4, 1, little)));
    u32(at, putData(new Uint8Array(raw.buffer)));
  }];

  const ifd0: Entry[] = [];
  if (spec.camera) ifd0.push(ascii(0x010f, 'TestMake'), ascii(0x0110, 'TestModel'));
  if (spec.orientation) ifd0.push([0x0112, 3, 1, (at) => u16(at, spec.orientation!)]);
  const gpsAt = 200;
  if (spec.gps || spec.brokenGpsPointer) ifd0.push([0x8825, 4, 1, (at) => u32(at, spec.brokenGpsPointer ? 5000 : gpsAt)]);

  const writeIfd = (at: number, entries: Entry[]) => {
    entries.sort((a, b) => a[0] - b[0]);
    u16(at, entries.length);
    entries.forEach(([tag, type, count, write], i) => {
      const entry = at + 2 + i * 12;
      u16(entry, tag);
      u16(entry + 2, type);
      u32(entry + 4, count);
      write(entry + 8);
    });
    u32(at + 2 + entries.length * 12, 0);
  };
  writeIfd(8, ifd0);
  if (spec.gps) {
    writeIfd(gpsAt, [ascii(0x01, 'N'), rationals(0x02, [51, 6, 30]), ascii(0x03, 'E'), rationals(0x04, [17, 2, 10])]);
  }
  return new Uint8Array(buffer, 0, data);
}

const segment = (marker: number, payload: Uint8Array) => {
  const length = payload.length + 2;
  return concat(Uint8Array.of(0xff, marker, length >> 8, length & 0xff), payload);
};

export const exifSegment = (tiff: Uint8Array) => segment(0xe1, concat(bytes('Exif\0\0'), tiff));
export const xmpSegment = (xmp: string) => segment(0xe1, concat(bytes('http://ns.adobe.com/xap/1.0/\0'), new TextEncoder().encode(xmp)));

/** A JPEG container: SOI, the given segments, a minimal scan and EOI. */
export function jpeg(...segments: Uint8Array[]): Uint8Array {
  const sos = segment(0xda, Uint8Array.of(1, 1, 0, 0, 63, 0));
  return concat(Uint8Array.of(0xff, 0xd8), ...segments, sos, Uint8Array.of(0x12, 0x34, 0xff, 0x00, 0x56), Uint8Array.of(0xff, 0xd9));
}

/** Inserts segments right after the SOI of an existing (for example sharp-generated) JPEG. */
export function withSegments(image: Uint8Array, ...segments: Uint8Array[]): Uint8Array {
  return concat(image.subarray(0, 2), ...segments, image.subarray(2));
}

export interface Chunk {
  type: string;
  data: Uint8Array;
}

const pngChunk = ({ type, data }: Chunk) => {
  const head = new DataView(new ArrayBuffer(4));
  head.setUint32(0, data.length);
  const typed = concat(bytes(type), data);
  const crc = new DataView(new ArrayBuffer(4));
  crc.setUint32(0, crc32(typed));
  return concat(new Uint8Array(head.buffer), typed, new Uint8Array(crc.buffer));
};

/** A decodable RGBA PNG of `width`×`height` pixels with the given chunks before IDAT. */
export function png(chunks: Chunk[] = [], { width = 4, height = 2, alpha = 255 } = {}): Uint8Array {
  const ihdr = new DataView(new ArrayBuffer(13));
  ihdr.setUint32(0, width);
  ihdr.setUint32(4, height);
  ihdr.setUint8(8, 8);
  ihdr.setUint8(9, 6);
  const row = [0, ...Array.from({ length: width }, () => [31, 85, 98, alpha]).flat()];
  const pixels = Uint8Array.from(Array.from({ length: height }, () => row).flat());
  return concat(
    bytes('\x89PNG\r\n\x1a\n'),
    pngChunk({ type: 'IHDR', data: new Uint8Array(ihdr.buffer) }),
    ...chunks.map(pngChunk),
    pngChunk({ type: 'IDAT', data: deflateSync(pixels) }),
    pngChunk({ type: 'IEND', data: new Uint8Array() }),
  );
}

/** A PNG text chunk: tEXt, zTXt (compressed) or iTXt (uncompressed). */
export function pngText(type: 'tEXt' | 'zTXt' | 'iTXt', keyword: string, text: string): Chunk {
  if (type === 'tEXt') return { type, data: concat(bytes(`${keyword}\0`), bytes(text)) };
  if (type === 'zTXt') return { type, data: concat(bytes(`${keyword}\0\0`), deflateSync(bytes(text))) };
  return { type, data: concat(bytes(`${keyword}\0\0\0\0\0`), new TextEncoder().encode(text)) };
}

/** EXIF as ImageMagick stores it in PNG text chunks: "Raw profile type exif", hex-encoded. */
export function rawExifProfile(tiff: Uint8Array): string {
  const payload = concat(bytes('Exif\0\0'), tiff);
  const hex = Buffer.from(payload).toString('hex').replace(/(.{72})/g, '$1\n');
  return `\nexif\n${String(payload.length).padStart(8)}\n${hex}\n`;
}

/** A WebP container with the given chunks after a VP8X header (no decodable picture). */
export function webp(chunks: Chunk[]): Uint8Array {
  const riffChunk = ({ type, data }: Chunk) => {
    const head = new DataView(new ArrayBuffer(8));
    new Uint8Array(head.buffer).set(bytes(type));
    head.setUint32(4, data.length, true);
    return concat(new Uint8Array(head.buffer), data, data.length & 1 ? Uint8Array.of(0) : new Uint8Array());
  };
  const body = concat(bytes('WEBP'), riffChunk({ type: 'VP8X', data: new Uint8Array(10) }), ...chunks.map(riffChunk));
  const head = new DataView(new ArrayBuffer(8));
  new Uint8Array(head.buffer).set(bytes('RIFF'));
  head.setUint32(4, body.length, true);
  return concat(new Uint8Array(head.buffer), body);
}

/** The start of a HEIC file as an iPhone writes it. */
export function heic(): Uint8Array {
  const ftyp = new DataView(new ArrayBuffer(24));
  ftyp.setUint32(0, 24);
  new Uint8Array(ftyp.buffer).set(bytes('ftypheic\0\0\0\0mif1heic'), 4);
  return concat(new Uint8Array(ftyp.buffer), new Uint8Array(40));
}

export const XMP_WITH_GPS =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="51,6.5N" exif:GPSLongitude="17,2.1E"/>' +
  '</rdf:RDF></x:xmpmeta>';
export const XMP_WITHOUT_GPS =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Test"/></rdf:RDF></x:xmpmeta>';
