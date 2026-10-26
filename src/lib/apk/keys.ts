import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  type KeyObject,
} from "node:crypto";
import {
  OID,
  bitString,
  boolean,
  explicit,
  integer,
  nullValue,
  octetString,
  oid,
  seq,
  set,
  utf8,
  validity,
} from "./der";

export interface KeyBlueprint {
  alias: string;
  commonName: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  locality?: string;
  validityDays?: number;
  keySize?: 2048 | 3072 | 4096;
}

export interface GeneratedKey {
  privateKeyPem: string;
  publicKeyPem: string;
  certDerBase64: string;
  certPem: string;
  subjectDn: string;
  serialHex: string;
  notBefore: string;
  notAfter: string;
  sha256Fingerprint: string;
  sha1Fingerprint: string;
  algorithm: string;
  keySize: number;
}

export interface SigningKeyMaterial {
  privateKeyPem: string;
  certDer: Buffer;
}

const ATTRIBUTE_OIDS: Record<string, string> = {
  CN: OID.commonName,
  O: OID.organizationName,
  OU: OID.organizationalUnit,
  C: OID.countryName,
  L: OID.localityName,
};

function nameDer(attributes: Array<{ key: string; value: string }>): Buffer {
  return seq(
    ...attributes
      .filter((attribute) => attribute.value && attribute.value.trim().length > 0)
      .map((attribute) => {
        const oidValue = ATTRIBUTE_OIDS[attribute.key];
        if (!oidValue) throw new Error(`Unsupported distinguished name attribute ${attribute.key}`);
        return set(seq(oid(oidValue), utf8(attribute.value.trim())));
      }),
  );
}

function dnString(attributes: Array<{ key: string; value: string }>): string {
  return attributes
    .filter((attribute) => attribute.value && attribute.value.trim().length > 0)
    .map((attribute) => `${attribute.key}=${attribute.value.trim()}`)
    .join(", ");
}

export function createSelfSignedCertificate(
  attributes: Array<{ key: string; value: string }>,
  privateKey: KeyObject,
  publicKey: KeyObject,
  serial: Buffer,
  notBefore: Date,
  notAfter: Date,
): { certDer: Buffer; subjectNameDer: Buffer; serialBig: bigint } {
  const signatureAlgorithm = seq(oid(OID.sha256WithRsa), nullValue());
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const subject = nameDer(attributes);

  const extensions = seq(
    seq(oid(OID.basicConstraints), boolean(true), octetString(seq())),
  );

  const tbs = seq(
    explicit(0, integer(2)),
    integer(BigInt(`0x${serial.toString("hex")}`)),
    signatureAlgorithm,
    subject,
    validity(notBefore, notAfter),
    subject,
    spki,
    explicit(3, extensions),
  );

  const signature = cryptoSign("sha256", tbs, privateKey);
  const certDer = seq(tbs, signatureAlgorithm, bitString(signature));
  const serialBig = BigInt(`0x${serial.toString("hex")}`);

  return { certDer, subjectNameDer: subject, serialBig };
}

export function generateSigningKey(blueprint: KeyBlueprint): GeneratedKey {
  const alias = blueprint.alias.trim().replace(/\s+/g, "-").toLowerCase() || "zelvaryn-key";
  const keySize = blueprint.keySize ?? 2048;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: keySize,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const privateKeyObject = createPrivateKey(privateKey);
  const publicKeyObject = createPublicKey(publicKey);

  const attributes = [
    { key: "C", value: blueprint.country ?? "US" },
    { key: "O", value: blueprint.organization ?? "Zelvaryn Studio" },
    { key: "OU", value: blueprint.organizationalUnit ?? "Android Release" },
    { key: "CN", value: blueprint.commonName || "Zelvaryn Release" },
  ];

  const serial = randomBytes(8);
  serial[0] &= 0x7f;
  const notBefore = new Date(Date.now() - 60_000);
  const validityDays = Math.min(Math.max(blueprint.validityDays ?? 9125, 30), 36500);
  const notAfter = new Date(notBefore.getTime() + validityDays * 86_400_000);

  const { certDer } = createSelfSignedCertificate(
    attributes,
    privateKeyObject,
    publicKeyObject,
    serial,
    notBefore,
    notAfter,
  );

  const certPem = `-----BEGIN CERTIFICATE-----\n${certDer
    .toString("base64")
    .replace(/(.{64})/g, "$1\n")
    .trim()}\n-----END CERTIFICATE-----\n`;

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    certDerBase64: certDer.toString("base64"),
    certPem,
    subjectDn: dnString(attributes),
    serialHex: serial.toString("hex"),
    notBefore: notBefore.toISOString(),
    notAfter: notAfter.toISOString(),
    sha256Fingerprint: createHash("sha256").update(certDer).digest("hex").toUpperCase(),
    sha1Fingerprint: createHash("sha1").update(certDer).digest("hex").toUpperCase(),
    algorithm: `RSA ${keySize}`,
    keySize,
  };
}

/**
 * Detached-ish PKCS#7 / CMS SignedData block used by the JAR (v1) signature
 * (`META-INF/CERT.RSA`). Content is embedded, digest + RSA PKCS#1 v1.5 SHA-256.
 */
export function createPkcs7Signature(
  key: SigningKeyMaterial,
  data: Buffer,
  subjectNameDer: Buffer,
  serialBig: bigint,
): Buffer {
  const privateKey = createPrivateKey(key.privateKeyPem);
  const signature = cryptoSign("sha256", data, privateKey);
  const digestAlgorithm = seq(oid(OID.sha256), nullValue());

  const signerInfo = seq(
    integer(1),
    seq(subjectNameDer, integer(serialBig)),
    digestAlgorithm,
    seq(oid(OID.rsaEncryption), nullValue()),
    octetString(signature),
  );

  const signedData = seq(
    integer(1),
    set(digestAlgorithm),
    seq(oid(OID.pkcs7Data), explicit(0, octetString(data))),
    explicit(0, key.certDer),
    set(signerInfo),
  );

  return seq(oid(OID.pkcs7SignedData), explicit(0, signedData));
}

/** Extract the issuer Name + serial back out of a certificate we generated. */
export function certificateParts(
  certDer: Buffer,
): { subjectNameDer: Buffer; serialBig: bigint } {
  const parts = parseTlv(certDer, 0);
  if (!parts) throw new Error("Unreadable certificate");
  const tbsOuter = parseTlv(certDer, parts.header);
  if (!tbsOuter) throw new Error("Unreadable certificate TBS");
  const tbsChildren = children(certDer, tbsOuter.valueStart, tbsOuter.valueEnd);
  const serialNode = tbsChildren.find((node) => node.tag === 0x02);
  const nameNodes = tbsChildren.filter((node) => node.tag === 0x30);
  if (!serialNode || nameNodes.length < 2) throw new Error("Unexpected certificate layout");
  const serialBig = BigInt(`0x${certDer
    .subarray(serialNode.valueStart, serialNode.valueEnd)
    .toString("hex") || "0"}`);
  const issuer = nameNodes[1];
  const subjectNameDer = certDer.subarray(issuer.start, issuer.valueEnd);
  return { subjectNameDer: Buffer.from(subjectNameDer), serialBig };
}

interface TlvNode {
  tag: number;
  start: number;
  header: number;
  valueStart: number;
  valueEnd: number;
  end: number;
}

function parseTlv(buffer: Buffer, offset: number): TlvNode | null {
  if (offset + 2 > buffer.length) return null;
  const tag = buffer[offset];
  let cursor = offset + 1;
  let length = buffer[cursor];
  cursor += 1;
  if (length & 0x80) {
    const count = length & 0x7f;
    length = 0;
    for (let i = 0; i < count; i += 1) {
      length = (length << 8) | buffer[cursor + i];
    }
    cursor += count;
  }
  return {
    tag,
    start: offset,
    header: cursor - offset,
    valueStart: cursor,
    valueEnd: cursor + length,
    end: cursor + length,
  };
}

function children(buffer: Buffer, start: number, end: number): TlvNode[] {
  const nodes: TlvNode[] = [];
  let cursor = start;
  while (cursor < end) {
    const node = parseTlv(buffer, cursor);
    if (!node || node.end > end) break;
    nodes.push(node);
    cursor = node.end;
  }
  return nodes;
}
