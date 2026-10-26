import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { keystores, signingJobs, type KeystoreRow, type SigningJobRow } from "@/db/schema";
import { decryptKeyMaterial, encryptKeyMaterial, formatBytes, randomId } from "@/lib/crypto";
import { generateSigningKey } from "@/lib/apk/keys";
import { signApk } from "@/lib/apk/sign";

export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

export interface KeystoreSummary {
  id: string;
  alias: string;
  commonName: string;
  organization: string;
  subjectDn: string;
  algorithm: string;
  keySize: number;
  sha256Fingerprint: string;
  sha1Fingerprint: string;
  notBefore: string;
  notAfter: string;
  createdAt: string;
  passphraseHint: string | null;
  isDemo: boolean;
}

export interface JobSummary {
  id: string;
  keystoreId: string | null;
  keystoreAlias: string;
  inputName: string;
  outputName: string;
  inputSize: number;
  outputSize: number;
  sha256: string;
  schemes: string[];
  entryCount: number;
  removedSignatures: number;
  durationMs: number;
  status: string;
  source: string;
  logs: string[];
  warnings: string[];
  signerFingerprint: string;
  createdAt: string;
}

function toKeystoreSummary(row: KeystoreRow): KeystoreSummary {
  return {
    id: row.id,
    alias: row.alias,
    commonName: row.commonName,
    organization: row.organization,
    subjectDn: row.subjectDn,
    algorithm: row.algorithm,
    keySize: row.keySize,
    sha256Fingerprint: row.sha256Fingerprint,
    sha1Fingerprint: row.sha1Fingerprint,
    notBefore: row.notBefore.toISOString(),
    notAfter: row.notAfter.toISOString(),
    createdAt: row.createdAt.toISOString(),
    passphraseHint: row.passphraseHint,
    isDemo: row.isDemo === "true",
  };
}

function toJobSummary(row: SigningJobRow): JobSummary {
  return {
    id: row.id,
    keystoreId: row.keystoreId,
    keystoreAlias: row.keystoreAlias,
    inputName: row.inputName,
    outputName: row.outputName,
    inputSize: row.inputSize,
    outputSize: row.outputSize,
    sha256: row.sha256,
    schemes: row.schemes.split(",").filter(Boolean),
    entryCount: row.entryCount,
    removedSignatures: row.removedSignatures,
    durationMs: row.durationMs,
    status: row.status,
    source: row.source,
    logs: row.logs ?? [],
    warnings: row.warnings ?? [],
    signerFingerprint: row.signerFingerprint,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listKeystores(): Promise<KeystoreSummary[]> {
  const rows = await db.select().from(keystores).orderBy(desc(keystores.createdAt));
  return rows.map(toKeystoreSummary);
}

export interface CreateKeystoreInput {
  alias: string;
  commonName: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  validityDays?: number;
  keySize?: 2048 | 3072 | 4096;
  passphrase: string;
  hint?: string;
}

export async function createKeystore(input: CreateKeystoreInput): Promise<KeystoreSummary> {
  if (!input.alias?.trim()) throw new Error("Give the keystore an alias.");
  if (!input.commonName?.trim()) throw new Error("Common Name (CN) is required.");
  if (!input.passphrase || input.passphrase.length < 6) {
    throw new Error("Passphrase must be at least 6 characters.");
  }
  const existing = await db
    .select({ id: keystores.id })
    .from(keystores)
    .where(eq(keystores.alias, input.alias.trim()))
    .limit(1);
  if (existing.length > 0) throw new Error("That alias already exists — pick another.");

  const generated = generateSigningKey({
    alias: input.alias.trim(),
    commonName: input.commonName.trim(),
    organization: input.organization?.trim() || "Zelvaryn Studio",
    organizationalUnit: input.organizationalUnit?.trim() || "Android Release",
    country: input.country?.trim() || "US",
    validityDays: input.validityDays,
    keySize: input.keySize,
  });
  const encrypted = encryptKeyMaterial(generated.privateKeyPem, input.passphrase);

  const [row] = await db
    .insert(keystores)
    .values({
      id: randomId("ks"),
      alias: input.alias.trim(),
      commonName: input.commonName.trim(),
      organization: input.organization?.trim() || "Zelvaryn Studio",
      organizationalUnit: input.organizationalUnit?.trim() || "Android Release",
      country: input.country?.trim() || "US",
      subjectDn: generated.subjectDn,
      algorithm: generated.algorithm,
      keySize: generated.keySize,
      sha256Fingerprint: generated.sha256Fingerprint,
      sha1Fingerprint: generated.sha1Fingerprint,
      serialHex: generated.serialHex,
      notBefore: new Date(generated.notBefore),
      notAfter: new Date(generated.notAfter),
      certDer: generated.certDerBase64,
      encryptedKey: encrypted.payload,
      keySalt: encrypted.salt,
      passphraseHint: input.hint?.trim() || null,
      isDemo: "false",
    })
    .returning();

  return toKeystoreSummary(row);
}

export async function deleteKeystore(id: string): Promise<void> {
  await db.delete(keystores).where(eq(keystores.id, id));
}

export interface SignRequest {
  fileBytes: Buffer;
  fileName: string;
  keystoreId: string;
  passphrase: string;
  source?: string;
}

export interface SignResponse {
  job: JobSummary;
  downloadUrl: string;
}

export async function signAndStore(request: SignRequest): Promise<SignResponse> {
  if (request.fileBytes.length === 0) throw new Error("The uploaded artifact is empty.");
  if (request.fileBytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Artifact exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} upload limit.`);
  }

  const [keystore] = await db
    .select()
    .from(keystores)
    .where(eq(keystores.id, request.keystoreId))
    .limit(1);
  if (!keystore) throw new Error("Keystore not found. Create one in the Keystore Vault.");

  const privateKeyPem = decryptKeyMaterial(
    keystore.encryptedKey,
    keystore.keySalt,
    request.passphrase,
  );

  const started = Date.now();
  const result = signApk({
    input: request.fileBytes,
    key: {
      privateKeyPem,
      certDer: Buffer.from(keystore.certDer, "base64"),
    },
  });
  const durationMs = Date.now() - started;

  const baseName = request.fileName.replace(/\.(apk|zip|aab)$/i, "") || "artifact";
  const outputName = `${baseName}-zelvaryn-signed.apk`;

  const [row] = await db
    .insert(signingJobs)
    .values({
      id: randomId("job"),
      keystoreId: keystore.id,
      keystoreAlias: keystore.alias,
      inputName: request.fileName,
      outputName,
      inputSize: request.fileBytes.length,
      outputSize: result.apk.length,
      sha256: result.sha256,
      schemes: result.schemes.join(","),
      entryCount: result.entryCount,
      removedSignatures: result.removedSignatures.length,
      durationMs,
      status: result.warnings.length > 0 ? "signed_with_notes" : "signed",
      source: request.source ?? "studio",
      logs: result.logs,
      warnings: result.warnings,
      signerFingerprint: result.signerCertSha256,
      artifact: result.apk,
    })
    .returning();

  return {
    job: toJobSummary(row),
    downloadUrl: `/api/jobs/${row.id}/download`,
  };
}

export async function listJobs(limit = 25): Promise<JobSummary[]> {
  const rows = await db
    .select()
    .from(signingJobs)
    .orderBy(desc(signingJobs.createdAt))
    .limit(limit);
  return rows.map(toJobSummary);
}

export async function getJob(id: string): Promise<JobSummary | null> {
  const [row] = await db.select().from(signingJobs).where(eq(signingJobs.id, id)).limit(1);
  return row ? toJobSummary(row) : null;
}

export async function getArtifact(id: string) {
  const [row] = await db
    .select({
      artifact: signingJobs.artifact,
      outputName: signingJobs.outputName,
      sha256: signingJobs.sha256,
    })
    .from(signingJobs)
    .where(eq(signingJobs.id, id))
    .limit(1);
  return row ?? null;
}

export async function getStats() {
  const [jobStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      signedBytes: sql<number>`coalesce(sum(${signingJobs.outputSize}), 0)::int`,
      avgDuration: sql<number>`coalesce(avg(${signingJobs.durationMs}), 0)::int`,
    })
    .from(signingJobs);
  const [keyStats] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(keystores);
  return {
    jobs: jobStats?.total ?? 0,
    signedBytes: jobStats?.signedBytes ?? 0,
    avgDuration: jobStats?.avgDuration ?? 0,
    keystores: keyStats?.total ?? 0,
  };
}

/** Seeds the demo signing identity once so the console is usable instantly. */
export async function ensureDemoKeystore(): Promise<KeystoreSummary> {
  const [existing] = await db
    .select()
    .from(keystores)
    .where(and(eq(keystores.alias, "zelvaryn-demo"), eq(keystores.isDemo, "true")))
    .limit(1);
  if (existing) return toKeystoreSummary(existing);

  const passphrase = "zelvaryn";
  const generated = generateSigningKey({
    alias: "zelvaryn-demo",
    commonName: "Zelvaryn Demo Signing",
    organization: "Zelvaryn Labs",
    organizationalUnit: "Demo Release",
    country: "US",
    validityDays: 3650,
  });
  const encrypted = encryptKeyMaterial(generated.privateKeyPem, passphrase);
  try {
  const [row] = await db
    .insert(keystores)
    .values({
      id: `ks_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      alias: "zelvaryn-demo",
      commonName: "Zelvaryn Demo Signing",
      organization: "Zelvaryn Labs",
      organizationalUnit: "Demo Release",
      country: "US",
      subjectDn: generated.subjectDn,
      algorithm: generated.algorithm,
      keySize: generated.keySize,
      sha256Fingerprint: generated.sha256Fingerprint,
      sha1Fingerprint: generated.sha1Fingerprint,
      serialHex: generated.serialHex,
      notBefore: new Date(generated.notBefore),
      notAfter: new Date(generated.notAfter),
      certDer: generated.certDerBase64,
      encryptedKey: encrypted.payload,
      keySalt: encrypted.salt,
      passphraseHint: passphrase,
      isDemo: "true",
    })
    .returning();
  return toKeystoreSummary(row);
  } catch {
    const [row] = await db
      .select()
      .from(keystores)
      .where(eq(keystores.alias, "zelvaryn-demo"))
      .limit(1);
    if (row) return toKeystoreSummary(row);
    throw new Error("Could not provision the demo signing identity.");
  }
}
