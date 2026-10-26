"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { KeystoreSummary } from "@/lib/zelvaryn";
import { CheckIcon, DownloadIcon, KeyIcon, SparkIcon, TrashIcon } from "@/components/icons";

const DEFAULTS = {
  alias: "",
  commonName: "",
  organization: "Zelvaryn Studio",
  organizationalUnit: "Android Release",
  country: "US",
  validityDays: "9125",
  keySize: "2048",
  passphrase: "",
  hint: "",
};

export function KeystoreManager({ keystores }: { keystores: KeystoreSummary[] }) {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const update = (key: keyof typeof DEFAULTS, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/keystores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          validityDays: Number(form.validityDays),
          keySize: Number(form.keySize),
        }),
      });
      const payload = (await response.json()) as { keystore?: KeystoreSummary; error?: string };
      if (!response.ok || !payload.keystore) throw new Error(payload.error || "Generation failed.");
      setNotice(`Keystore ${payload.keystore.alias} minted · ${payload.keystore.algorithm}`);
      setForm(DEFAULTS);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(id);
    setError(null);
    try {
      const response = await fetch(`/api/keystores/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Delete failed.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="panel p-5">
        <div className="flex items-center gap-2">
          <SparkIcon className="h-4 w-4 text-lime-300" />
          <h2 className="text-sm font-semibold text-white">Mint a signing identity</h2>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-mist">
          The engine generates an RSA keypair and a self-signed X.509 certificate locally. Only the
          encrypted private key is persisted.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">Alias</span>
            <input
              className="field"
              value={form.alias}
              onChange={(event) => update("alias", event.target.value)}
              placeholder="acme-release"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">Common name (CN)</span>
            <input
              className="field"
              value={form.commonName}
              onChange={(event) => update("commonName", event.target.value)}
              placeholder="Acme Mobile Release"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">Organization</span>
            <input
              className="field"
              value={form.organization}
              onChange={(event) => update("organization", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">Organizational unit</span>
            <input
              className="field"
              value={form.organizationalUnit}
              onChange={(event) => update("organizationalUnit", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">Country</span>
            <input
              className="field"
              maxLength={2}
              value={form.country}
              onChange={(event) => update("country", event.target.value.toUpperCase())}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">Validity (days)</span>
            <input
              className="field"
              type="number"
              min={30}
              max={36500}
              value={form.validityDays}
              onChange={(event) => update("validityDays", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">RSA key size</span>
            <select
              className="field"
              value={form.keySize}
              onChange={(event) => update("keySize", event.target.value)}
            >
              <option value="2048" className="bg-[#0c0a16]">2048 bit</option>
              <option value="3072" className="bg-[#0c0a16]">3072 bit</option>
              <option value="4096" className="bg-[#0c0a16]">4096 bit</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-xs">Passphrase (min 6)</span>
            <input
              className="field"
              type="password"
              value={form.passphrase}
              onChange={(event) => update("passphrase", event.target.value)}
              placeholder="encrypts the private key"
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="label-xs">Passphrase hint (optional)</span>
            <input
              className="field"
              value={form.hint}
              onChange={(event) => update("hint", event.target.value)}
              placeholder="shown on the keystore card, e.g. stored in 1Password"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-xl border border-lime-300/30 bg-lime-300/10 px-3 py-2 text-[12px] text-lime-200">
            {notice}
          </p>
        ) : null}

        <button type="button" onClick={create} disabled={busy} className="btn-primary mt-4 w-full">
          {busy ? "Generating RSA keypair…" : "Generate keystore"}
          {!busy && <KeyIcon className="h-4 w-4" />}
        </button>
        <p className="mono mt-2 text-center text-[9px] tracking-[0.1em] text-white/25">
          4096-BIT KEYS TAKE A MOMENT · GENERATED IN-PROCESS
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-white">Vault · {keystores.length} identities</h2>
          <span className="mono text-[10px] tracking-[0.12em] text-white/30">AES-256-GCM AT REST</span>
        </div>

        {keystores.length === 0 ? (
          <div className="panel p-6 text-center text-[12px] text-mist">
            The vault is empty. Mint your first identity to start sealing artifacts.
          </div>
        ) : (
          keystores.map((keystore) => (
            <article key={keystore.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[13.5px] font-semibold text-white">{keystore.alias}</h3>
                    {keystore.isDemo ? (
                      <span className="chip border-lime-300/30 text-lime-200">demo</span>
                    ) : null}
                    <span className="chip">{keystore.algorithm}</span>
                  </div>
                  <p className="mono mt-1 truncate text-[10.5px] text-mist">{keystore.subjectDn}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`/api/keystores/${keystore.id}/certificate`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-mist transition hover:border-lime-300/40 hover:text-lime-300"
                    aria-label="Download certificate"
                    title="Download X.509 certificate"
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(keystore.id)}
                    disabled={deleting === keystore.id}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-mist transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-40"
                    aria-label="Delete keystore"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3 sm:grid-cols-3">
                <div>
                  <dt className="mono text-[9px] uppercase tracking-[0.1em] text-white/30">SHA-256</dt>
                  <dd className="mono mt-0.5 truncate text-[10px] text-white/70">
                    {keystore.sha256Fingerprint.slice(0, 24)}…
                  </dd>
                </div>
                <div>
                  <dt className="mono text-[9px] uppercase tracking-[0.1em] text-white/30">Valid until</dt>
                  <dd className="mono mt-0.5 text-[10px] text-white/70">
                    {new Date(keystore.notAfter).toISOString().slice(0, 10)}
                  </dd>
                </div>
                <div>
                  <dt className="mono text-[9px] uppercase tracking-[0.1em] text-white/30">Passphrase</dt>
                  <dd className="mono mt-0.5 text-[10px] text-white/70">
                    {keystore.passphraseHint ? `“${keystore.passphraseHint}”` : "not hinted"}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="mono flex items-center gap-1 text-[9px] tracking-[0.1em] text-lime-300/70">
                  <CheckIcon className="h-3 w-3" /> READY TO SEAL
                </span>
                <Link href="/" className="mono text-[10px] tracking-[0.1em] text-white/40 hover:text-lime-300">
                  USE IN CONSOLE →
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
