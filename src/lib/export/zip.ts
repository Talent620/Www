/**
 * Minimal, dependency-free ZIP writer (store method, no compression).
 *
 * Generated sites are small text files, so the simplicity and zero supply-chain
 * surface of an uncompressed archive beats pulling in a zip dependency. Output
 * is a standard PKZIP archive readable by every OS and `unzip`.
 */

export interface ZipEntry {
  name: string;
  data: Buffer | string;
}

const textEncoder = new TextEncoder();

/** CRC-32 (IEEE 802.3), table-driven. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const d = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: d };
}

function u16(value: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value & 0xffff);
  return b;
}

function u32(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0);
  return b;
}

/** Build a ZIP archive from named entries. */
export function buildZip(entries: ZipEntry[], now: Date = new Date()): Buffer {
  const { time, date } = dosDateTime(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(textEncoder.encode(entry.name));
    const data = typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : entry.data;
    const crc = crc32(data);

    const localHeader = Buffer.concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed
      u16(0x0800), // flags: UTF-8 names
      u16(0), // method: store
      u16(time),
      u16(date),
      u32(crc),
      u32(data.length), // compressed size (== uncompressed for store)
      u32(data.length),
      u16(nameBytes.length),
      u16(0), // extra length
      nameBytes,
    ]);

    centralParts.push(
      Buffer.concat([
        u32(0x02014b50), // central directory header signature
        u16(20), // version made by
        u16(20), // version needed
        u16(0x0800),
        u16(0),
        u16(time),
        u16(date),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0), // extra
        u16(0), // comment
        u16(0), // disk number
        u16(0), // internal attrs
        u32(0), // external attrs
        u32(offset),
        nameBytes,
      ]),
    );

    localParts.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.concat([
    u32(0x06054b50), // end of central directory signature
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

/** Parse the EOCD record of a ZIP buffer; used by tests to verify structure. */
export function readZipEntryCount(zip: Buffer): number {
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      return zip.readUInt16LE(i + 10);
    }
  }
  throw new Error('Not a ZIP archive: EOCD record not found');
}
