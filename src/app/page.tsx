import Link from "next/link";
import { StudioConsole } from "@/components/studio-console";
import { AndroidIcon, ArrowIcon, BoxIcon, DownloadIcon, KeyIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { ensureDemoKeystore, getStats, listJobs, listKeystores } from "@/lib/zelvaryn";
import { formatBytes } from "@/lib/crypto";
import release from "@/data/release.json";

export const dynamic = "force-dynamic";

const PIPELINE = [
  { step: "01", title: "Stage artifact", detail: "APK or zip of APK contents" },
  { step: "02", title: "Strip old seals", detail: "META-INF v1 blocks removed" },
  { step: "03", title: "Digest entries", detail: "SHA-256 per file, 1 MB chunks" },
  { step: "04", title: "Seal v1 + v2", detail: "PKCS#7 + APK Signing Block" },
  { step: "05", title: "Deliver APK", detail: "Download, sideload, ship" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function StudioPage() {
  await ensureDemoKeystore();
  const [keystores, jobs, stats] = await Promise.all([
    listKeystores(),
    listJobs(4),
    getStats(),
  ]);
  const latest = jobs[0];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-gradient-to-br from-[#150f28]/90 via-[#0b0915]/95 to-[#07060f] p-5 sm:p-7 lg:p-9">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-lime-300/30 text-lime-200">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-300 pulse-dot" /> engine online
              </span>
              <span className="chip">v1 jar + v2 scheme</span>
              <span className="chip">keys aes-256-gcm</span>
            </div>

            <h1 className="mt-4 text-[clamp(2rem,5.2vw,3.35rem)] font-black leading-[1.02] tracking-[-0.03em] text-white">
              Files in.
              <br />
              <span className="bg-gradient-to-r from-lime-300 via-lime-200 to-violet-300 bg-clip-text text-transparent">
                Fully signed APK out.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-mist sm:text-sm">
              Zelvaryn is an APK signing studio. Drop an unsigned build, pick a signing identity, and
              the engine strips stale signatures, recomputes every digest, and reseals the package
              with a JAR v1 manifest and an APK Signature Scheme v2 block — the same verification
              path Android runs at install time.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <a href="#console" className="btn-primary">
                Sign an artifact <ArrowIcon className="h-4 w-4" />
              </a>
              <Link href="/android" className="btn-ghost">
                <AndroidIcon className="h-4 w-4" /> Get the APK
                <span className="mono ml-1 text-[9px] text-lime-300/80">{formatBytes(release.size)}</span>
              </Link>
            </div>

            <dl className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: "Artifacts sealed", value: String(stats.jobs) },
                { label: "Keystores", value: String(stats.keystores) },
                { label: "Bytes delivered", value: formatBytes(stats.signedBytes) },
                { label: "Avg seal time", value: `${stats.avgDuration || 0} ms` },
              ].map((stat) => (
                <div key={stat.label} className="panel-flat px-3 py-2.5">
                  <dt className="mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-[15px] font-bold text-white">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="panel relative overflow-hidden p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-lime-300" />
                <p className="mono text-[10px] tracking-[0.18em] text-white">SEAL PIPELINE</p>
              </div>
              <span className="mono text-[9px] tracking-[0.12em] text-white/30">LIVE</span>
            </div>

            <ol className="mt-4 flex flex-col gap-3">
              {PIPELINE.map((item, index) => (
                <li key={item.step} className="flex items-start gap-3">
                  <span
                    className={`mono mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-[9px] ${
                      index === PIPELINE.length - 1
                        ? "border-lime-300/40 bg-lime-300/15 text-lime-200"
                        : "border-white/10 bg-white/[0.04] text-mist"
                    }`}
                  >
                    {item.step}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-white">{item.title}</span>
                    <span className="mono block text-[10px] leading-relaxed text-mist">{item.detail}</span>
                  </span>
                  {index < PIPELINE.length - 1 ? (
                    <span className="ml-auto mt-1 h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                  ) : (
                    <SparkIcon className="ml-auto h-4 w-4 text-lime-300" />
                  )}
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/40 p-3">
              <p className="mono text-[9px] tracking-[0.14em] text-white/30">LAST SEALED ARTIFACT</p>
              {latest ? (
                <>
                  <p className="mono mt-1 truncate text-[11px] text-lime-200">{latest.outputName}</p>
                  <p className="mono mt-1 text-[10px] text-white/35">
                    {timeAgo(latest.createdAt)} · {latest.schemes.join(" + ")} ·{" "}
                    {formatBytes(latest.outputSize)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[11px] text-mist">
                  Nothing yet — the first seal lands here.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="console" className="scroll-mt-24">
        <StudioConsole keystores={keystores} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BoxIcon className="h-4 w-4 text-violet-300" />
              <h2 className="text-sm font-semibold text-white">Recent artifacts</h2>
            </div>
            <Link href="/artifacts" className="mono text-[10px] tracking-[0.12em] text-lime-300">
              VIEW ALL →
            </Link>
          </div>

          <div className="mt-4 flex flex-col divide-y divide-white/[0.06]">
            {jobs.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-mist">
                Your signed packages will appear here with their SHA-256 receipt.
              </p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-lime-300/25 bg-lime-300/10 text-[10px] font-bold text-lime-300">
                    APK
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mono truncate text-[11.5px] text-white">{job.outputName}</p>
                    <p className="mono mt-0.5 truncate text-[9.5px] tracking-[0.06em] text-white/35">
                      {job.schemes.join(" + ")} · {formatBytes(job.outputSize)} · {job.keystoreAlias} ·{" "}
                      {timeAgo(job.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/api/jobs/${job.id}/download`}
                    download
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-mist transition hover:border-lime-300/40 hover:text-lime-300"
                    aria-label={`Download ${job.outputName}`}
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel flex flex-col justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2">
              <KeyIcon className="h-4 w-4 text-lime-300" />
              <h2 className="text-sm font-semibold text-white">Keystore vault</h2>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-mist">
              Generate a self-signed RSA identity in-house. Private keys are sealed with
              AES-256-GCM under a scrypt-derived passphrase and never leave the server.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="chip">{keystores.length} identities</span>
              <span className="chip border-violet-400/30 text-violet-200">scrypt N=16384</span>
            </div>
          </div>
          <Link href="/keystores" className="btn-ghost">
            Manage keystores <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[22px] border border-lime-300/25 bg-gradient-to-r from-lime-300/[0.09] via-transparent to-violet-500/[0.12] p-5 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-lime-300/30 bg-black/40 text-lime-300">
            <AndroidIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mono text-[10px] tracking-[0.18em] text-lime-200/80">NATIVE ANDROID CLIENT</p>
            <h2 className="mt-1 text-[17px] font-bold text-white">
              Zelvaryn for Android — sign from your phone
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-mist">
              A real installable APK, compiled with aapt2/d8 and signed with v2 + v3 schemes. Pick an
              artifact with the system file picker, seal it against this studio, and drop the signed
              package into Downloads.
            </p>
          </div>
          <Link href="/android" className="btn-primary w-full sm:w-auto">
            <DownloadIcon className="h-4 w-4" /> Download {release.version}
          </Link>
        </div>
      </section>
    </div>
  );
}
