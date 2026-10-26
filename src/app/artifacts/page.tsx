import Link from "next/link";
import { AndroidIcon, BoxIcon, DownloadIcon, ShieldIcon } from "@/components/icons";
import { getStats, listJobs } from "@/lib/zelvaryn";
import { formatBytes } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

export default async function ArtifactsPage() {
  const [jobs, stats] = await Promise.all([listJobs(50), getStats()]);

  return (
    <div className="flex flex-col gap-5">
      <header className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-xs">Delivery layer</p>
            <h1 className="mt-2 text-[26px] font-black tracking-[-0.02em] text-white sm:text-3xl">
              Artifact vault
            </h1>
            <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-mist">
              Every sealed package is retained with its SHA-256 receipt, signature schemes, signer
              fingerprint and engine log — re-download any artifact straight to a device.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip border-lime-300/30 text-lime-200">{stats.jobs} sealed</span>
            <span className="chip">{formatBytes(stats.signedBytes)} delivered</span>
            <span className="chip">{stats.keystores} keys</span>
          </div>
        </div>
      </header>

      {jobs.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-lime-300">
            <BoxIcon className="h-6 w-6" />
          </span>
          <h2 className="text-[15px] font-semibold text-white">No artifacts sealed yet</h2>
          <p className="max-w-sm text-[12px] leading-relaxed text-mist">
            Head to the studio, stage an unsigned APK, and the sealed package will land here with its
            full verification receipt.
          </p>
          <Link href="/" className="btn-primary mt-1">
            Open the signing console
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <article key={job.id} className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lime-300/25 bg-lime-300/10 text-[10px] font-bold text-lime-300">
                    APK
                  </span>
                  <div className="min-w-0">
                    <h2 className="mono truncate text-[12.5px] font-semibold text-white">
                      {job.outputName}
                    </h2>
                    <p className="mono mt-1 text-[10px] tracking-[0.06em] text-white/35">
                      {stamp(job.createdAt)} · from {job.inputName} · {formatBytes(job.inputSize)} →{" "}
                      {formatBytes(job.outputSize)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.schemes.map((scheme) => (
                        <span
                          key={scheme}
                          className={`chip ${
                            scheme === "v2"
                              ? "border-violet-400/35 text-violet-200"
                              : "border-lime-300/30 text-lime-200"
                          }`}
                        >
                          {scheme}
                        </span>
                      ))}
                      <span className="chip">{job.entryCount} entries</span>
                      <span className="chip">{job.durationMs} ms</span>
                      {job.removedSignatures > 0 ? (
                        <span className="chip">{job.removedSignatures} stripped</span>
                      ) : null}
                      {job.source === "android" ? (
                        <span className="chip border-lime-300/30 text-lime-200">
                          <AndroidIcon className="h-3 w-3" /> mobile
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono hidden text-[9px] tracking-[0.1em] text-white/30 sm:block">
                    {job.keystoreAlias}
                  </span>
                  <a href={`/api/jobs/${job.id}/download`} download className="btn-primary">
                    <DownloadIcon className="h-4 w-4" /> Download
                  </a>
                </div>
              </div>

              <div className="mt-3 grid gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
                <div>
                  <p className="mono text-[9px] uppercase tracking-[0.12em] text-white/30">
                    Artifact SHA-256
                  </p>
                  <p className="mono mt-0.5 break-all text-[10px] text-white/70">{job.sha256}</p>
                </div>
                <div>
                  <p className="mono flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-white/30">
                    <ShieldIcon className="h-3 w-3" /> Signer certificate SHA-256
                  </p>
                  <p className="mono mt-0.5 break-all text-[10px] text-white/70">
                    {job.signerFingerprint}
                  </p>
                </div>
              </div>

              {job.warnings.length > 0 ? (
                <ul className="mono mt-3 space-y-1 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[10px] text-amber-200">
                  {job.warnings.map((warning) => (
                    <li key={warning}>! {warning}</li>
                  ))}
                </ul>
              ) : null}

              <details className="group mt-3">
                <summary className="mono cursor-pointer list-none text-[10px] tracking-[0.12em] text-white/35 transition hover:text-lime-300">
                  ▸ ENGINE LOG ({job.logs.length} lines)
                </summary>
                <div className="terminal mt-2 max-h-56 overflow-y-auto p-3">
                  {job.logs.map((line, index) => (
                    <p
                      key={`${job.id}-${index}`}
                      className={line.startsWith("✓") ? "text-lime-300" : "text-[#a89fc7]"}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
