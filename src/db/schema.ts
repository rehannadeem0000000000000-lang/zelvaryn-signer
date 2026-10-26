import { customType, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const keystores = pgTable("keystores", {
  id: text("id").primaryKey(),
  alias: text("alias").notNull().unique(),
  commonName: text("common_name").notNull(),
  organization: text("organization").notNull().default("Zelvaryn Studio"),
  organizationalUnit: text("organizational_unit").notNull().default("Android Release"),
  country: text("country").notNull().default("US"),
  subjectDn: text("subject_dn").notNull(),
  algorithm: text("algorithm").notNull(),
  keySize: integer("key_size").notNull(),
  sha256Fingerprint: text("sha256_fingerprint").notNull(),
  sha1Fingerprint: text("sha1_fingerprint").notNull(),
  serialHex: text("serial_hex").notNull(),
  notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
  notAfter: timestamp("not_after", { withTimezone: true }).notNull(),
  certDer: text("cert_der").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  keySalt: text("key_salt").notNull(),
  passphraseHint: text("passphrase_hint"),
  isDemo: text("is_demo").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signingJobs = pgTable(
  "signing_jobs",
  {
    id: text("id").primaryKey(),
    keystoreId: text("keystore_id"),
    keystoreAlias: text("keystore_alias").notNull(),
    inputName: text("input_name").notNull(),
    outputName: text("output_name").notNull(),
    inputSize: integer("input_size").notNull(),
    outputSize: integer("output_size").notNull(),
    sha256: text("sha256").notNull(),
    schemes: text("schemes").notNull(),
    entryCount: integer("entry_count").notNull(),
    removedSignatures: integer("removed_signatures").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    status: text("status").notNull().default("signed"),
    source: text("source").notNull().default("studio"),
    logs: jsonb("logs").$type<string[]>().notNull().default([]),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    signerFingerprint: text("signer_fingerprint").notNull(),
    artifact: bytea("artifact").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("signing_jobs_created_at_idx").on(table.createdAt)],
);

export type KeystoreRow = typeof keystores.$inferSelect;
export type SigningJobRow = typeof signingJobs.$inferSelect;
