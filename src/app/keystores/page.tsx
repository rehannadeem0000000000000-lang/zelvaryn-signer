import { KeystoreManager } from "@/components/keystore-manager";
import { KeyIcon, ShieldIcon } from "@/components/icons";
import { ensureDemoKeystore, listKeystores } from "@/lib/zelvaryn";

export const dynamic = "force-dynamic";

export default async function KeystoresPage() {
  await ensureDemoKeystore();
  const keystores = await listKeystores();

  return (
    <div className="flex flex-col gap-5">
      <header className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-xs">Identity layer</p>
            <h1 className="mt-2 text-[26px] font-black tracking-[-0.02em] text-white sm:text-3xl">
              Keystore vault
            </h1>
            <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-mist">
              Every artifact is sealed with an RSA identity that lives here. Zelvaryn generates the
              keypair and X.509 certificate, encrypts the private key with AES-256-GCM, and derives the
              wrapping key with scrypt — the plaintext key exists only for the milliseconds of a seal.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip border-lime-300/30 text-lime-200">
              <ShieldIcon className="h-3 w-3" /> {keystores.length} vaulted
            </span>
            <span className="chip">RSA · SHA-256</span>
            <span className="chip">PKCS#7</span>
            <span className="chip">X.509 v3</span>
          </div>
        </div>
      </header>

      <KeystoreManager keystores={keystores} />

      <section className="panel grid gap-4 p-5 sm:grid-cols-3">
        {[
          {
            title: "Generate",
            body: "RSA-2048/3072/4096 keypair plus a self-signed X.509 v3 certificate with basicConstraints.",
          },
          {
            title: "Protect",
            body: "scrypt (N=16384) derives an AES-256-GCM key; ciphertext, IV and auth tag are stored separately.",
          },
          {
            title: "Seal",
            body: "The key is decrypted in memory, signs MANIFEST.MF/CERT.SF and the v2 block, then is dropped.",
          },
        ].map((item, index) => (
          <div key={item.title} className="panel-flat p-4">
            <div className="flex items-center gap-2">
              <span className="mono grid h-6 w-6 place-items-center rounded-md border border-white/10 text-[9px] text-lime-300">
                0{index + 1}
              </span>
              <h3 className="text-[12.5px] font-semibold text-white">{item.title}</h3>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-mist">{item.body}</p>
          </div>
        ))}
      </section>

      <p className="mono flex items-center gap-2 px-1 text-[10px] tracking-[0.1em] text-white/25">
        <KeyIcon className="h-3.5 w-3.5" /> DELETING A KEYSTORE IS PERMANENT — APKS SEALED WITH IT KEEP
        THEIR SIGNATURE.
      </p>
    </div>
  );
}
