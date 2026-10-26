/**
 * Minimal ASN.1 DER encoder — enough for X.509 v3 certificates and
 * PKCS#7 SignedData blocks. No third-party dependencies.
 */

export function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

export function tlv(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(value.length), value]);
}

export function seq(...parts: Buffer[]): Buffer {
  return tlv(0x30, Buffer.concat(parts));
}

export function set(...parts: Buffer[]): Buffer {
  return tlv(0x31, Buffer.concat(parts));
}

export function integer(value: number | bigint): Buffer {
  let big = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  const zero = BigInt(0);
  if (big < zero) big = zero;
  let hex = big.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let bytes = Buffer.from(hex, "hex");
  if (bytes.length === 0) bytes = Buffer.from([0]);
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return tlv(0x02, bytes);
}

export function oid(dotted: string): Buffer {
  const parts = dotted.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length < 2) throw new Error(`Invalid OID: ${dotted}`);
  const bytes: number[] = [40 * parts[0] + parts[1]];
  for (const part of parts.slice(2)) {
    const stack = [part & 0x7f];
    let rest = part >>> 7;
    while (rest > 0) {
      stack.unshift((rest & 0x7f) | 0x80);
      rest >>>= 7;
    }
    bytes.push(...stack);
  }
  return tlv(0x06, Buffer.from(bytes));
}

export function utf8(value: string): Buffer {
  return tlv(0x0c, Buffer.from(value, "utf8"));
}

export function octetString(value: Buffer): Buffer {
  return tlv(0x04, value);
}

export function nullValue(): Buffer {
  return Buffer.from([0x05, 0x00]);
}

export function boolean(value: boolean): Buffer {
  return tlv(0x01, Buffer.from([value ? 0xff : 0x00]));
}

export function bitString(value: Buffer, unusedBits = 0): Buffer {
  return tlv(0x03, Buffer.concat([Buffer.from([unusedBits]), value]));
}

/** Context specific constructed tag, e.g. explicit(0, ...) => [0] EXPLICIT */
export function explicit(tagNumber: number, value: Buffer): Buffer {
  return tlv(0xa0 | tagNumber, value);
}

function utcTime(date: Date): Buffer {
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = `${pad(date.getUTCFullYear() % 100)}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate(),
  )}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(text, "ascii"));
}

export function validity(notBefore: Date, notAfter: Date): Buffer {
  return seq(utcTime(notBefore), utcTime(notAfter));
}

export const OID = {
  sha256: "2.16.840.1.101.3.4.2.1",
  sha512: "2.16.840.1.101.3.4.2.3",
  rsaEncryption: "1.2.840.113549.1.1.1",
  sha256WithRsa: "1.2.840.113549.1.1.11",
  commonName: "2.5.4.3",
  organizationName: "2.5.4.10",
  organizationalUnit: "2.5.4.11",
  localityName: "2.5.4.7",
  stateOrProvince: "2.5.4.8",
  countryName: "2.5.4.6",
  basicConstraints: "2.5.29.19",
  pkcs7Data: "1.2.840.113549.1.7.1",
  pkcs7SignedData: "1.2.840.113549.1.7.2",
} as const;
