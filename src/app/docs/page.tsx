import Link from "next/link";
import { AndroidIcon, BookIcon, ShieldIcon, SparkIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const ENDPOINTS = [
  { method: "GET", path: "/api/health", body: "Engine + database probe" },
  { method: "GET", path: "/api/keystores", body: "Vault inventory (public metadata only)" },
  { method: "POST", path: "/api/keystores", body: "Generate RSA keypair + X.509 certificate" },
  { method: "DELETE", path: "/api/keystores/:id", body: "Destroy an identity" },
  { method: "GET", path: "/api/keystores/:id/certificate", body: "Download the public cert (PEM)" },
  { method: "POST", path: "/api/sign", body: "multipart: file, keystoreId, passphrase" },
  { method: "GET", path: "/api/jobs", body: "Signed artifact history" },
  { method: "GET", path: "/api/jobs/:id/download", body: "The signed APK itself" },
];

const V2_LAYOUT = `APK Signing Block  (inserted immediately before the ZIP central directory)
  uint64  size of block (excluding this field)
  pair    uint64 length | uint32 id (0x7109871a) | value
  uint64  size of block (repeated)
  magic   "APK Sig Block 42"

value = length-prefixed sequence of length-prefixed signer
  signer
    length-prefixed signed data
      length-prefixed sequence of length-prefixed digests
        uint32   signature algorithm id (0x0103 = RSASSA-PKCS1-v1_5 + SHA2-256)
        lp       digest over 1 MB APK chunks
      length-prefixed sequence of length-prefixed X.509 certificates
      length-prefixed sequence of additional attributes
    length-prefixed sequence of length-prefixed signatures
      uint32   signature algorithm id
      lp       signature over the signed data
    length-prefixed public key (SubjectPublicKeyInfo DER)`;

const DIGEST = `chunks are built per protected section:
  1. ZIP entry data      [0 → signing block start]
  2. ZIP central directory
  3. ZIP end-of-central-directory (central dir offset points at the block)

chunk digest = SHA-256(0xa5 || uint32le(len) || bytes)
top digest   = SHA-256(0x5a || uint32le(count) || all chunk digests)`;

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-5">
      <header className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <div className="relative">
          <p className="label-xs">Engine notes</p>
          <h1 className="mt-2 text-[26px] font-black tracking-[-0.02em] text-white sm:text-3xl">
            How Zelvaryn actually signs
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-mist">
            No wrapper around someone else&apos;s binary, no external SDK on the request path. Zelvaryn
            ships a signing implementation in TypeScript: an ASN.1 DER writer for X.509 and PKCS#7, a
            deterministic ZIP rewriter with 4-byte alignment, and a full APK Signature Scheme v2 block
            builder. The output is verified by Android&apos;s own <span className="mono">apksigner</span>{" "}
            in CI.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="chip border-lime-300/30 text-lime-200">JAR v1</span>
            <span className="chip border-violet-400/35 text-violet-200">APK scheme v2</span>
            <span className="chip">SHA-256</span>
            <span className="chip">RSA PKCS#1 v1.5</span>
            <span className="chip">PKCS#7 SignedData</span>
          </div>
        </div>
      </header>

      <section className="panel p-5">
        <div className="flex items-center gap-2">
          <SparkIcon className="h-4 w-4 text-lime-300" />
          <h2 className="text-sm font-semibold text-white">The seal pipeline</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "1 · Inspect",
              body: "Read the end-of-central-directory record, walk the central directory, and pull each entry's local header to find the real data offset (data descriptors are ignored).",
            },
            {
              title: "2 · Strip",
              body: "Remove META-INF/MANIFEST.MF, *.SF, *.RSA, *.DSA, *.EC and SIG-* entries. Old signatures can never leak into the new one.",
            },
            {
              title: "3 · Digest",
              body: "Decompress every entry payload and hash it with SHA-256. Those digests become the per-entry sections of MANIFEST.MF.",
            },
            {
              title: "4 · JAR v1",
              body: "Write MANIFEST.MF, CERT.SF (manifest + per-section digests) and CERT.RSA, a PKCS#7 SignedData block over CERT.SF.",
            },
            {
              title: "5 · Rebuild ZIP",
              body: "Emit fresh local headers, keep compression methods, and 4-byte align stored entry payloads using the 0xd935 padding field.",
            },
            {
              title: "6 · v2 seal",
              body: "Hash the three protected sections in 1 MB chunks, sign the signed-data record, wrap it in the APK Signing Block, patch the EOCD offset.",
            },
          ].map((item) => (
            <div key={item.title} className="panel-flat p-4">
              <h3 className="mono text-[11px] tracking-[0.08em] text-lime-200">{item.title}</h3>
              <p className="mt-2 text-[11.5px] leading-relaxed text-mist">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-violet-300" />
            <h2 className="text-sm font-semibold text-white">v2 block layout</h2>
          </div>
          <pre className="terminal mt-3 overflow-x-auto p-4 text-[10px] leading-relaxed">{V2_LAYOUT}</pre>
        </section>

        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-lime-300" />
            <h2 className="text-sm font-semibold text-white">Integrity digest</h2>
          </div>
          <pre className="terminal mt-3 overflow-x-auto p-4 text-[10px] leading-relaxed">{DIGEST}</pre>
          <p className="mt-3 text-[11.5px] leading-relaxed text-mist">
            The block is inserted before the central directory, so the signing-block bytes themselves are
            excluded from the digest. Any later edit to a single byte of an entry, the directory, or the
            EOCD invalidates the v2 signature.
          </p>
        </section>
      </div>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-white">API reference</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                <th className="border-b border-white/10 py-2 pr-4">Method</th>
                <th className="border-b border-white/10 py-2 pr-4">Path</th>
                <th className="border-b border-white/10 py-2">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((endpoint) => (
                <tr key={`${endpoint.method}-${endpoint.path}`} className="align-top">
                  <td className="border-b border-white/[0.05] py-2 pr-4">
                    <span
                      className={`mono rounded px-1.5 py-0.5 text-[9px] ${
                        endpoint.method === "GET"
                          ? "bg-lime-300/15 text-lime-200"
                          : endpoint.method === "POST"
                            ? "bg-violet-500/20 text-violet-200"
                            : "bg-rose-500/15 text-rose-200"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="mono border-b border-white/[0.05] py-2 pr-4 text-[10.5px] text-white/80">
                    {endpoint.path}
                  </td>
                  <td className="border-b border-white/[0.05] py-2 text-[11px] text-mist">
                    {endpoint.body}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mono mt-4 text-[9px] uppercase tracking-[0.12em] text-white/30">
          curl · seal an artifact
        </p>
        <pre className="terminal mt-2 overflow-x-auto p-4 text-[10.5px] leading-relaxed">{`curl -s http://localhost:3000/api/health | jq

curl -s -X POST http://localhost:3000/api/sign \\
  -F keystoreId=ks_xxxxxxxxxxxx \\
  -F passphrase=zelvaryn \\
  -F file=@app-unsigned.apk \\
  -o job.json

jq -r '.downloadUrl' job.json   # /api/jobs/job_xxx/download`}</pre>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold text-white">Verify it yourself</h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist">
            Android&apos;s verifier is the ground truth. Run it against anything Zelvaryn emits:
          </p>
          <pre className="terminal mt-3 overflow-x-auto p-4 text-[10.5px] leading-relaxed">{`# v2 / v3 aware verification
apksigner verify --verbose --print-certs signed.apk

# force the JAR (v1) path for Android 6 and below
apksigner verify --min-sdk-version 21 --max-sdk-version 23 signed.apk

# the JAR signature itself
jarsigner -verify -verbose:summary signed.apk`}</pre>
        </section>

        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <AndroidIcon className="h-4 w-4 text-lime-300" />
            <h2 className="text-sm font-semibold text-white">The Android client</h2>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist">
            The mobile app is plain Java against the platform framework, compiled with the same tools a
            Gradle build would call: aapt2 → javac → d8 → zipalign → apksigner.
          </p>
          <pre className="terminal mt-3 overflow-x-auto p-4 text-[10.5px] leading-relaxed">{`unzip zelvaryn-android-source.zip -d zelvaryn
cd zelvaryn
ANDROID_HOME=/path/to/android-sdk JAVA_HOME=/path/to/jdk17 ./build.sh

# build.sh writes build/zelvaryn-1.0.0.apk and verifies it`}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/android" className="btn-ghost">
              Download the APK
            </Link>
            <a href="/downloads/zelvaryn-android-source.zip" className="btn-ghost" download>
              Source archive
            </a>
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <div className="flex items-center gap-2">
          <BookIcon className="h-4 w-4 text-violet-300" />
          <h2 className="text-sm font-semibold text-white">Security model & limits</h2>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Key handling",
              body: "Private keys are generated with Node's crypto module, stored as AES-256-GCM ciphertext with a scrypt-derived key (N=16384, r=8, p=1), and decrypted only inside the signing request.",
            },
            {
              title: "What is not implemented",
              body: "v3 key rotation, v4 incremental idsig files, ZIP64 (>4 GB archives) and AAB → APK conversion are out of scope. AAB bundles need bundletool before signing.",
            },
            {
              title: "Uploads",
              body: "Artifacts are capped at 64 MB per seal. Signed output is retained in Postgres so it can be re-downloaded; delete rows to reclaim space.",
            },
            {
              title: "Trust warning",
              body: "This studio has no accounts. Anyone with the URL can mint a key or seal an artifact — put it behind your own auth or run it locally for production keys.",
            },
          ].map((item) => (
            <div key={item.title} className="panel-flat p-4">
              <h3 className="text-[12px] font-semibold text-white">{item.title}</h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
