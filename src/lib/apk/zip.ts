import { deflateRawSync, crc32 as zlibCrc32, inflateRawSync } from "node:zlib";

export interface RawZipEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Raw (still compressed) entry payload. */
  data: Buffer;
  time: number;
  date: number;
  externalAttr: number;
  internalAttr: number;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

export const META_INF_SIGNATURE =
  /^META-INF\/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC)|SIG-[^/]+)$/i;

function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

export function readZip(buffer: Buffer): RawZipEntry[] {
  if (buffer.length < 22) throw new Error("File is too small to be a ZIP/APK archive.");

  let eocd = -1;
  const scanStart = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= scanStart; i -= 1) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive: end-of-central-directory record not found.");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff) throw new Error("ZIP64 archives are not supported yet.");

  const entries: RawZipEntry[] = [];
  let cursor = cdOffset;
  const seen = new Set<string>();

  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIG_CENTRAL) {
      throw new Error("Corrupt central directory in archive.");
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const time = buffer.readUInt16LE(cursor + 12);
    const date = buffer.readUInt16LE(cursor + 14);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const internalAttr = buffer.readUInt16LE(cursor + 36);
    const externalAttr = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLen);
    cursor += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x1) throw new Error("Encrypted ZIP entries cannot be re-signed.");
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("ZIP64 archives are not supported yet.");
    }
    if (buffer.readUInt32LE(localOffset) !== SIG_LOCAL) {
      throw new Error(`Corrupt local header for entry ${name}.`);
    }
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    if (name.endsWith("/")) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    entries.push({
      name,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      data: Buffer.from(data),
      time,
      date,
      externalAttr,
      internalAttr,
    });
  }

  return entries;
}

export function entryPayload(entry: RawZipEntry): Buffer {
  if (entry.method === 0) return entry.data;
  if (entry.method === 8) return inflateRawSync(entry.data);
  throw new Error(`Unsupported compression method ${entry.method} for ${entry.name}.`);
}

export function crc32(data: Buffer): number {
  const fn = zlibCrc32 as unknown as ((input: Buffer) => number) | undefined;
  if (typeof fn === "function") return fn(data) >>> 0;
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createStoredEntry(name: string, payload: Buffer, crc: number): RawZipEntry {
  const { time, date } = dosDateTime(new Date());
  return {
    name,
    method: 0,
    crc,
    compressedSize: payload.length,
    uncompressedSize: payload.length,
    data: payload,
    time,
    date,
    externalAttr: 0o100644 * 0x10000,
    internalAttr: 0,
  };
}

export function createDeflatedEntry(
  name: string,
  payload: Buffer,
  crc: number,
): RawZipEntry {
  const compressed = deflateRawSync(payload, { level: 9 });
  const { time, date } = dosDateTime(new Date());
  return {
    name,
    method: 8,
    crc,
    compressedSize: compressed.length,
    uncompressedSize: payload.length,
    data: compressed,
    time,
    date,
    externalAttr: 0o100644 * 0x10000,
    internalAttr: 0,
  };
}

export interface WrittenZip {
  buffer: Buffer;
  cdOffset: number;
  eocdOffset: number;
}

/** Rewrites a ZIP archive with fresh local headers, optional 4-byte data alignment. */
export function writeZip(entries: RawZipEntry[]): WrittenZip {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const entry of entries) {
    const nameBytes = Buffer.from(encoder.encode(entry.name));
    const alignStored = entry.method === 0;

    let extra = Buffer.alloc(0);
    if (alignStored) {
      const base = offset + 30 + nameBytes.length;
      const pad = (4 - (base % 4)) % 4;
      const fieldSize = 4 + pad;
      extra = Buffer.alloc(fieldSize);
      extra.writeUInt16LE(0xd935, 0); // Android alignment padding field
      extra.writeUInt16LE(pad, 2);
    }

    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt16LE(entry.time, 10);
    local.writeUInt16LE(entry.date, 12);
    local.writeUInt32LE(entry.crc >>> 0, 14);
    local.writeUInt32LE(entry.compressedSize, 18);
    local.writeUInt32LE(entry.uncompressedSize, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(extra.length, 28);

    const localOffset = offset;
    chunks.push(local, nameBytes, extra, entry.data);
    offset += local.length + nameBytes.length + extra.length + entry.data.length;

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(SIG_CENTRAL, 0);
    cd.writeUInt16LE(0x031e, 4); // made by: unix, zip 3.0
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(entry.method, 10);
    cd.writeUInt16LE(entry.time, 12);
    cd.writeUInt16LE(entry.date, 14);
    cd.writeUInt32LE(entry.crc >>> 0, 16);
    cd.writeUInt32LE(entry.compressedSize, 20);
    cd.writeUInt32LE(entry.uncompressedSize, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(entry.internalAttr, 36);
    cd.writeUInt32LE(entry.externalAttr >>> 0, 38);
    cd.writeUInt32LE(localOffset, 42);
    central.push(cd, nameBytes);
  }

  const cdOffset = offset;
  const cdBuffer = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuffer.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return {
    buffer: Buffer.concat([...chunks, cdBuffer, eocd]),
    cdOffset,
    eocdOffset: cdOffset + cdBuffer.length,
  };
}
