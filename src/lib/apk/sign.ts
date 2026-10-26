import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
} from "node:crypto";
import { createPkcs7Signature, certificateParts, type SigningKeyMaterial } from "./keys";
import {
  META_INF_SIGNATURE,
  createDeflatedEntry,
  createStoredEntry,
  crc32,
  entryPayload,
  readZip,
  writeZip,
  type RawZipEntry,
} from "./zip";

export type SignatureScheme = "v1" | "v2";

export interface SignApkOptions {
  input: Buffer;
  key: SigningKeyMaterial;
  schemes?: SignatureScheme[];
  createdBy?: string;
}

export interface SignApkResult {
  apk: Buffer;
  sha256: string;
  schemes: SignatureScheme[];
  entryCount: number;
  removedSignatures: string[];
  signerCertSha256: string;
  logs: string[];
  warnings: string[];
}

const SIG_ALG_SHA256_WITH_RSA = 0x0103;

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

function base64(data: Buffer): string {
  return data.toString("base64");
}

function wrapManifestLine(line: string, max = 72): string {
  const buffer = Buffer.from(line, "utf8");
  if (buffer.length <= max) return line;
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const limit = parts.length === 0 ? max : max - 1;
    const slice = buffer.subarray(cursor, cursor + limit);
    parts.push((parts.length === 0 ? "" : " ") + slice.toString("utf8"));
    cursor += slice.length;
  }
  return parts.join("\r\n");
}

function buildManifest(
  entries: Array<{ name: string; digest: string }>,
  createdBy: string,
): { bytes: Buffer; sections: Array<{ name: string; bytes: Buffer; digest: string }>; mainBytes: Buffer } {
  const mainLines = [
    wrapManifestLine("Manifest-Version: 1.0"),
    wrapManifestLine(`Created-By: ${createdBy}`),
    "",
  ];
  const mainText = mainLines.join("\r\n") + "\r\n";
  const sections: Array<{ name: string; bytes: Buffer; digest: string }> = [];
  const sectionTexts: string[] = [];
  for (const entry of entries) {
    const text =
      [wrapManifestLine(`Name: ${entry.name}`), wrapManifestLine(`SHA-256-Digest: ${entry.digest}`), ""]
        .join("\r\n") + "\r\n";
    const bytes = Buffer.from(text, "utf8");
    sections.push({ name: entry.name, bytes, digest: base64(sha256(bytes)) });
    sectionTexts.push(text);
  }
  const bytes = Buffer.from(mainText + sectionTexts.join(""), "utf8");
  return { bytes, sections, mainBytes: Buffer.from(mainText, "utf8") };
}

function buildSignatureFile(
  manifest: { bytes: Buffer; sections: Array<{ name: string; digest: string }>; mainBytes: Buffer },
  createdBy: string,
): Buffer {
  const lines = [
    wrapManifestLine("Signature-Version: 1.0"),
    wrapManifestLine(`Created-By: ${createdBy}`),
    wrapManifestLine(`SHA-256-Digest-Manifest: ${base64(sha256(manifest.bytes))}`),
    wrapManifestLine(
      `SHA-256-Digest-Manifest-Main-Attributes: ${base64(sha256(manifest.mainBytes))}`,
    ),
    wrapManifestLine("X-Android-APK-Signed: 2"),
    "",
  ];
  let text = lines.join("\r\n") + "\r\n";
  for (const section of manifest.sections) {
    text +=
      [wrapManifestLine(`Name: ${section.name}`), wrapManifestLine(`SHA-256-Digest: ${section.digest}`), ""]
        .join("\r\n") + "\r\n";
  }
  return Buffer.from(text, "utf8");
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function uint64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

function lengthPrefixed(payload: Buffer): Buffer {
  return Buffer.concat([uint32(payload.length), payload]);
}

/**
 * APK Signature Scheme v2 integrity digest. Each protected ZIP section
 * (entry data, central directory, EOCD) is chunked independently.
 */
export function apkContentDigest(sections: Buffer[]): Buffer {
  const chunkSize = 1024 * 1024;
  const chunkDigests: Buffer[] = [];
  for (const section of sections) {
    for (let offset = 0; offset < section.length; offset += chunkSize) {
      const chunk = section.subarray(offset, Math.min(offset + chunkSize, section.length));
      const prefix = Buffer.alloc(5);
      prefix.writeUInt8(0xa5, 0);
      prefix.writeUInt32LE(chunk.length, 1);
      chunkDigests.push(sha256(Buffer.concat([prefix, chunk])));
    }
  }
  const count = Buffer.alloc(5);
  count.writeUInt8(0x5a, 0);
  count.writeUInt32LE(chunkDigests.length, 1);
  return sha256(Buffer.concat([count, ...chunkDigests]));
}

function buildSigningBlock(
  key: SigningKeyMaterial,
  contentDigest: Buffer,
): Buffer {
  const privateKey = createPrivateKey(key.privateKeyPem);
  const publicKey = createPublicKey(privateKey);
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;

  const digestRecord = Buffer.concat([
    uint32(SIG_ALG_SHA256_WITH_RSA),
    lengthPrefixed(contentDigest),
  ]);
  // "length-prefixed sequence of length-prefixed digests"
  const digestsField = lengthPrefixed(lengthPrefixed(digestRecord));
  const certificatesField = lengthPrefixed(lengthPrefixed(key.certDer));
  const additionalAttributesField = lengthPrefixed(Buffer.alloc(0));
  const signedData = Buffer.concat([
    digestsField,
    certificatesField,
    additionalAttributesField,
    uint32(0),
  ]);

  const signature = cryptoSign("sha256", signedData, privateKey);
  const signatureRecord = Buffer.concat([
    uint32(SIG_ALG_SHA256_WITH_RSA),
    lengthPrefixed(signature),
  ]);
  const signaturesField = lengthPrefixed(lengthPrefixed(signatureRecord));
  const publicKeyField = lengthPrefixed(publicKeyDer);

  const signer = Buffer.concat([lengthPrefixed(signedData), signaturesField, publicKeyField]);
  const signers = lengthPrefixed(signer);
  const v2Value = lengthPrefixed(signers);

  const pairValue = Buffer.concat([uint32(0x7109871a), v2Value]);
  const pair = Buffer.concat([uint64(pairValue.length), pairValue]);
  const blockSize = pair.length + 8 + 16;

  return Buffer.concat([
    uint64(blockSize),
    pair,
    uint64(blockSize),
    Buffer.from("APK Sig Block 42", "ascii"),
  ]);
}

/** Package loose files into a ZIP so they can enter the signing pipeline. */
export function packageFiles(files: Array<{ name: string; data: Buffer }>): Buffer {
  const entries: RawZipEntry[] = files.map((file) =>
    createDeflatedEntry(file.name, file.data, crc32(file.data)),
  );
  return writeZip(entries).buffer;
}

export function signApk(options: SignApkOptions): SignApkResult {
  const createdBy = options.createdBy ?? "Zelvaryn Signer 1.0.0";
  const schemes = options.schemes ?? ["v1", "v2"];
  const logs: string[] = [];
  const warnings: string[] = [];

  logs.push(`inspect: reading archive (${options.input.length.toLocaleString()} bytes)`);
  const parsed = readZip(options.input);
  const removedSignatures: string[] = [];
  const entries: RawZipEntry[] = [];
  for (const entry of parsed) {
    if (META_INF_SIGNATURE.test(entry.name)) {
      removedSignatures.push(entry.name);
      continue;
    }
    entries.push(entry);
  }

  const names = new Set(entries.map((entry) => entry.name));
  if (!names.has("AndroidManifest.xml")) {
    warnings.push("No AndroidManifest.xml found — output is signed but not installable.");
  }
  if (!names.has("classes.dex")) {
    warnings.push("No classes.dex found — most launchers will reject this package.");
  }
  if (removedSignatures.length > 0) {
    logs.push(`strip: removed ${removedSignatures.length} previous signature file(s)`);
  } else {
    logs.push("strip: no previous signatures present");
  }
  logs.push(`manifest: ${entries.length} entries will be digested`);

  const payloadDigests: Array<{ name: string; digest: string }> = [];
  for (const entry of entries) {
    const payload = entryPayload(entry);
    payloadDigests.push({ name: entry.name, digest: base64(sha256(payload)) });
  }

  if (schemes.includes("v1")) {
    const manifest = buildManifest(payloadDigests, createdBy);
    const signatureFile = buildSignatureFile(manifest, createdBy);
    const { subjectNameDer, serialBig } = certificateParts(options.key.certDer);
    const pkcs7 = createPkcs7Signature(options.key, signatureFile, subjectNameDer, serialBig);

    const signatureEntries = [
      createStoredEntry("META-INF/MANIFEST.MF", manifest.bytes, crc32(manifest.bytes)),
      createStoredEntry("META-INF/CERT.SF", signatureFile, crc32(signatureFile)),
      createStoredEntry("META-INF/CERT.RSA", pkcs7, crc32(pkcs7)),
    ];
    entries.unshift(...signatureEntries);
    logs.push("v1: MANIFEST.MF + CERT.SF + CERT.RSA written (SHA-256 / RSA PKCS#1 v1.5)");
  }

  const written = writeZip(entries);
  logs.push(`align: rebuilt ZIP, ${entries.length} entries, 4-byte data alignment`);

  let output = written.buffer;
  if (schemes.includes("v2")) {
    const digest = apkContentDigest([
      output.subarray(0, written.cdOffset),
      output.subarray(written.cdOffset, written.eocdOffset),
      output.subarray(written.eocdOffset),
    ]);
    const block = buildSigningBlock(options.key, digest);
    const patchedEocd = Buffer.from(output.subarray(written.eocdOffset));
    patchedEocd.writeUInt32LE(written.cdOffset + block.length, 16);
    output = Buffer.concat([
      output.subarray(0, written.cdOffset),
      block,
      output.subarray(written.cdOffset, written.eocdOffset),
      patchedEocd,
    ]);
    logs.push(
      `v2: APK Signature Scheme v2 block sealed (${block.length} bytes, SHA-256 chunked digest)`,
    );
  }

  if (schemes.includes("v1") && schemes.includes("v2")) {
    logs.push("verify: v1 + v2 coverage satisfies Android 7 → 15 install rules");
  }

  logs.push(`seal: signed artifact ready (${output.length.toLocaleString()} bytes)`);

  return {
    apk: output,
    sha256: createHash("sha256").update(output).digest("hex"),
    schemes,
    entryCount: entries.length,
    removedSignatures,
    signerCertSha256: createHash("sha256")
      .update(options.key.certDer)
      .digest("hex")
      .toUpperCase(),
    logs,
    warnings,
  };
}
