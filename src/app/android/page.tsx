import Link from "next/link";
import { headers } from "next/headers";
import { AndroidIcon, ArrowIcon, CheckIcon, DownloadIcon, ShieldIcon } from "@/components/icons";
import { formatBytes } from "@/lib/crypto";
import release from "@/data/release.json";

export const dynamic = "force-dynamic";

export default async function AndroidPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const pairingLink = `zelvaryn://pair?url=${encodeURIComponent(origin)}`;

  const facts = [
    { label: "Package", value: release.package },
    { label: "Version", value: `${release.version} (${release.versionCode})` },
    { label: "Size", value: formatBytes(release.size) },
    { label: "Min / target SDK", value: `${release.minSdk} / ${release.targetSdk}` },
    { label: "Verified schemes", value: release.verifiedSchemes.join(" + ") },
    { label: "Built", value: release.builtAt.slice(0, 10) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="relative overflow-hidden rounded-[26px] border border-lime-300/25 bg-gradient-to-br from-[#16220e]/70 via-[#0b0915] to-[#120c20] p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-50" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div>
            <span className="chip border-lime-300/30 text-lime-200">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300 pulse-dot" /> INSTALLABLE APK
            </span>
            <h1 className="mt-4 text-[clamp(2rem,5vw,2.9rem)] font-black leading-[1.04] tracking-[-0.03em] text-white">
              Zelvaryn for Android.
              <br />
              <span className="bg-gradient-to-r from-lime-300 to-violet-300 bg-clip-text text-transparent">
                Seal from your pocket.
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-mist">
              A native Java client compiled straight against the Android framework — no Gradle bloat,
              no WebView shell. It picks an artifact with the system document picker, streams it to this
              studio, and writes the fully signed package into{" "}
              <span className="mono text-white">Downloads/Zelvaryn</span>.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <a href={release.file} className="btn-primary" download>
                <DownloadIcon className="h-4 w-4" /> Download APK · {formatBytes(release.size)}
              </a>
              <a href={release.sourceArchive} className="btn-ghost" download>
                Android source .zip
              </a>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/40 p-3">
              <p className="mono text-[9px] tracking-[0.14em] text-white/35">STUDIO URL FOR THE APP</p>
              <p className="mono mt-1 break-all text-[12px] text-lime-200">{origin}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-mist">
                Open Zelvaryn on your phone, paste this into{" "}
                <span className="text-white">01 · Studio endpoint</span>, and hit TEST LINK. The app
                ships with an editable endpoint because every studio deployment lives on its own URL.
              </p>
              <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
                <p className="mono text-[9px] tracking-[0.1em] text-white/30">PAIRING DEEP LINK</p>
                <p className="mono mt-0.5 break-all text-[10px] text-violet-200">{pairingLink}</p>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-lime-300" />
                <p className="mono text-[10px] tracking-[0.16em] text-white">RELEASE RECEIPT</p>
              </div>
              <span className="chip border-lime-300/30 text-lime-200">verifies</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                    {fact.label}
                  </dt>
                  <dd className="mono mt-0.5 break-words text-[10.5px] text-white/80">{fact.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="mono text-[9px] uppercase tracking-[0.1em] text-white/30">APK SHA-256</p>
              <p className="mono mt-0.5 break-all text-[10px] text-lime-200/90">{release.sha256}</p>
              <p className="mono mt-3 text-[9px] uppercase tracking-[0.1em] text-white/30">
                SIGNER CERT SHA-256
              </p>
              <p className="mono mt-0.5 break-all text-[10px] text-white/70">{release.certSha256}</p>
              <p className="mono mt-3 text-[9px] text-white/30">{release.signerDn}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Sideload in four steps</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {[
              {
                title: "Download the APK",
                body: "Tap the download button above. Chrome saves zelvaryn-1.0.0.apk to your Downloads folder.",
              },
              {
                title: "Allow the install",
                body: "Open the file and approve “Install unknown apps” for your browser. Zelvaryn requests only INTERNET and network-state permissions.",
              },
              {
                title: "Point it at this studio",
                body: `Launch the app, paste ${origin} into the studio endpoint card, then tap TEST LINK. The engine answers with its core version.`,
              },
              {
                title: "Seal something",
                body: "Load keystores, enter the passphrase, choose an unsigned APK, then SIGN & DELIVER. The signed artifact appears in Downloads/Zelvaryn.",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-lime-300/30 bg-lime-300/10 text-[9px] text-lime-200">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold text-white">{step.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-white">What the client does</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {[
              "Health-check handshake with the signing core",
              "Keystore inventory pulled from the vault",
              "Storage Access Framework file picking (no storage permission)",
              "Streaming multipart upload with live engine log",
              "Writes the signed APK to Downloads/Zelvaryn",
              "Displays its own signing-certificate SHA-256",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-mist">
                <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mono mt-4 border-t border-white/[0.06] pt-3 text-[9px] leading-relaxed tracking-[0.08em] text-white/30">
            REBUILT FROM SOURCE WITH {release.toolchain.toUpperCase()}
          </p>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Verified by the platform toolchain</h2>
            <p className="mt-1 text-[11.5px] text-mist">
              The published binary was checked with Android&apos;s own verifier before it shipped.
            </p>
          </div>
          <span className="chip border-lime-300/30 text-lime-200">apksigner · verifies</span>
        </div>
        <pre className="terminal mt-3 overflow-x-auto p-4 text-[10.5px] leading-relaxed text-[#b9b0d8]">{`$ apksigner verify --verbose --print-certs zelvaryn-1.0.0.apk
Verifies
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
Signer #1 certificate DN: ${release.signerDn}
Signer #1 certificate SHA-256 digest: ${release.certSha256.toLowerCase()}
Signer #1 key algorithm: RSA
Signer #1 key size (bits): 2048

$ sha256sum zelvaryn-1.0.0.apk
${release.sha256}  zelvaryn-1.0.0.apk`}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/docs" className="btn-ghost">
            <AndroidIcon className="h-4 w-4" /> How the engine works
          </Link>
          <Link href="/" className="btn-ghost">
            Sign an artifact <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
