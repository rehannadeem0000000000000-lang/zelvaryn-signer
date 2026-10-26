import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_KEYLEN = 32;

function derive(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: 16384,
    r: 8,
    p: 1,
  });
}

/** Encrypts private key material with AES-256-GCM using a scrypt-derived key. */
export function encryptKeyMaterial(pem: string, passphrase: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derive(passphrase, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    salt: salt.toString("base64"),
    payload: `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`,
  };
}

export function decryptKeyMaterial(payload: string, saltB64: string, passphrase: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Key material is corrupted.");
  const salt = Buffer.from(saltB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", derive(passphrase, salt), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Keystore passphrase is incorrect.");
  }
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
