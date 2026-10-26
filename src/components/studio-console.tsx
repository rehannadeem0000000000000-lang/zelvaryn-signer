"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeystoreSummary } from "@/lib/zelvaryn";
import { CheckIcon, DownloadIcon, ShieldIcon, UploadIcon } from "@/components/icons";

interface SignResult {
  downloadUrl: string;
  job: {
    id: string;
    outputName: string;
    outputSize: number;
    inputSize: number;
    sha256: string;
    schemes: string[];
    entryCount: number;
    removedSignatures: number;
    durationMs: number;
    logs: string[];
    warnings: string[];
    signerFingerprint: string;
  };
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function StudioConsole({ keystores }: { keystores: KeystoreSummary[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [keystoreId, setKeystoreId] = useState(keystores[0]?.id ?? "");
  const [passphrase, setPassphrase] = useState(keystores[0]?.passphraseHint ?? "");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "› zelvaryn signing console ready",
    "› engine: JAR v1 manifest + APK Signature Scheme v2",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);

  const selected = useMemo(
    () => keystores.find((keystore) => keystore.id === keystoreId) ?? null,
    [keystores, keystoreId],
  );

  useEffect(() => {
    if (selected?.passphraseHint) setPassphrase(selected.passphraseHint);
  }, [selected]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const append = (lines: string[]) => setLogs((current) => [...current, ...lines]);

  const accept = (candidate: File | null | undefined) => {
    if (!candidate) return;
    if (!/\.(apk|zip)$/i.test(candidate.name)) {
      setError("Zelvaryn seals .apk and .zip artifacts. Rename or repackage this file first.");
      return;
    }
    if (candidate.size > 64 * 1024 * 1024) {
      setError("Artifacts are capped at 64 MB by the studio uploader.");
      return;
    }
    setError(null);
    setResult(null);
    setFile(candidate);
    append([`› artifact staged: ${candidate.name} · ${human(candidate.size)}`]);
  };

  const sign = async () => {
    if (!file) {
      setError("Stage an artifact first.");
      return;
    }
    if (!keystoreId) {
      setError("Choose a keystore — or mint one in the Keystore Vault.");
      return;
    }
    if (!passphrase) {
      setError("Enter the keystore passphrase.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    append([
      `› POST /api/sign · ${file.name}`,
      `› key: ${selected?.alias ?? keystoreId} (${selected?.algorithm ?? "RSA"})`,
      "› uploading artifact to the signing core…",
    ]);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("keystoreId", keystoreId);
      body.append("passphrase", passphrase);
      body.append("source", "studio");

      const response = await fetch("/api/sign", { method: "POST", body });
      const payload = (await response.json()) as SignResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || `Signing failed (${response.status})`);

      setResult(payload);
      append([...payload.job.logs, "✓ artifact delivered — ready to install"]);
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Signing failed.";
      setError(message);
      append([`✗ ${message}`]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setLogs(["› session reset · stage a new artifact"]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <ShieldIcon className="h-4 w-4 text-lime-300" />
          <h2 className="text-sm font-semibold tracking-wide text-white">Signing console</h2>
          <span className="chip border-lime-300/25 text-lime-200">v1 + v2</span>
        </div>
        <p className="mono text-[10px] tracking-[0.14em] text-white/30">
          POST /api/sign · MULTIPART
        </p>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
        <div className="flex flex-col gap-4">
          {keystores.length === 0 ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
              No signing identities yet.{" "}
              <Link href="/keystores" className="underline decoration-amber-300/60">
                Create a keystore
              </Link>{" "}
              to unlock the console.
            </div>
          ) : null}

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              accept(event.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-5 py-8 text-center transition ${
              dragging
                ? "border-lime-300/70 bg-lime-300/[0.07]"
                : "border-white/15 bg-black/30 hover:border-violet-400/50 hover:bg-violet-500/[0.05]"
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-lime-300">
              <UploadIcon className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-white">
              {file ? file.name : "Drop an unsigned APK or ZIP"}
            </p>
            <p className="mono text-[10px] tracking-[0.12em] text-mist">
              {file ? human(file.size) : "TAP TO BROWSE · MAX 64 MB"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".apk,.zip,application/vnd.android.package-archive,application/zip"
              className="hidden"
              onChange={(event) => accept(event.target.files?.[0])}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="label-xs">Signing identity</span>
              <select
                value={keystoreId}
                onChange={(event) => setKeystoreId(event.target.value)}
                disabled={busy || keystores.length === 0}
                className="field appearance-none"
              >
                {keystores.map((keystore) => (
                  <option key={keystore.id} value={keystore.id} className="bg-[#0c0a16]">
                    {keystore.alias} · {keystore.commonName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-xs">Keystore passphrase</span>
              <input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                disabled={busy}
                placeholder="••••••••"
                className="field"
                autoComplete="current-password"
              />
            </label>
          </div>

          {selected ? (
            <div className="panel-flat px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="mono text-[10px] tracking-[0.1em] text-mist">
                  {selected.algorithm} · valid to {new Date(selected.notAfter).getFullYear()}
                </span>
                {selected.passphraseHint ? (
                  <button
                    type="button"
                    onClick={() => setPassphrase(selected.passphraseHint ?? "")}
                    className="mono text-[10px] tracking-[0.1em] text-lime-300 underline decoration-dotted"
                  >
                    use demo pass
                  </button>
                ) : null}
              </div>
              <p className="mono mt-1.5 truncate text-[10px] text-white/35">
                SHA-256 {selected.sha256Fingerprint}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={sign} disabled={busy || !file} className="btn-primary flex-1">
              {busy ? "Sealing artifact…" : "Sign artifact"}
              {!busy && <CheckIcon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={reset} disabled={busy} className="btn-ghost">
              Reset
            </button>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-200">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="rise rounded-2xl border border-lime-300/35 bg-lime-300/[0.07] p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-lime-300 text-black">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-white">Fully signed · ready to sideload</p>
              </div>
              <p className="mono mt-2 break-all text-[11px] text-lime-100/90">{result.job.outputName}</p>
              <dl className="mono mt-3 grid grid-cols-2 gap-2 text-[10px] tracking-[0.06em] text-lime-100/70">
                <div>
                  <dt className="text-white/35">OUTPUT</dt>
                  <dd>{human(result.job.outputSize)}</dd>
                </div>
                <div>
                  <dt className="text-white/35">SEAL TIME</dt>
                  <dd>{result.job.durationMs} ms</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-white/35">SHA-256</dt>
                  <dd className="break-all">{result.job.sha256}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={result.downloadUrl} className="btn-primary flex-1" download>
                  <DownloadIcon className="h-4 w-4" /> Download signed APK
                </a>
                <Link href="/artifacts" className="btn-ghost">
                  Artifact vault
                </Link>
              </div>
              {result.job.warnings.length > 0 ? (
                <ul className="mono mt-3 space-y-1 text-[10px] text-amber-200/90">
                  {result.job.warnings.map((warning) => (
                    <li key={warning}>! {warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="label-xs">Engine log</span>
            <span className="mono text-[10px] tracking-[0.1em] text-white/30">
              {busy ? "RUNNING" : result ? "SEALED" : "IDLE"}
            </span>
          </div>
          <div ref={logRef} className="terminal h-[286px] overflow-y-auto p-3.5 lg:h-full lg:min-h-[286px]">
            {logs.map((line, index) => (
              <p
                key={`${index}-${line.slice(0, 12)}`}
                className={
                  line.startsWith("✓")
                    ? "text-lime-300"
                    : line.startsWith("✗")
                      ? "text-rose-300"
                      : line.startsWith("›")
                        ? "text-[#c9c1e6]"
                        : "text-[#8d84ab]"
                }
              >
                {line}
              </p>
            ))}
            {busy ? <p className="text-lime-300/70">▌</p> : null}
          </div>
          <p className="mono text-[9px] leading-relaxed tracking-[0.08em] text-white/25">
            Keys are decrypted in-memory for the duration of the seal, then discarded. Existing
            signatures are stripped before resealing.
          </p>
        </div>
      </div>
    </div>
  );
}
