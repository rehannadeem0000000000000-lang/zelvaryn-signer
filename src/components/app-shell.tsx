"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  AndroidIcon,
  BookIcon,
  BoxIcon,
  DownloadIcon,
  KeyIcon,
  ShieldIcon,
  TerminalIcon,
} from "@/components/icons";

const NAV = [
  { href: "/", label: "Studio", icon: TerminalIcon },
  { href: "/keystores", label: "Keystores", icon: KeyIcon },
  { href: "/artifacts", label: "Artifacts", icon: BoxIcon },
  { href: "/android", label: "Android app", icon: AndroidIcon },
  { href: "/docs", label: "How it works", icon: BookIcon },
];

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 shadow-[0_12px_30px_-12px_rgba(168,85,247,0.9)]">
        <span className="font-mono text-lg font-black text-lime-300">Z</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime-300 pulse-dot" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-extrabold tracking-[0.22em] text-white">ZELVARYN</span>
        <span className="mono mt-1 text-[9px] tracking-[0.2em] text-mist">APK SIGNING STUDIO</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[254px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-white/[0.06] bg-[#08060f]/80 px-5 py-6 backdrop-blur-xl lg:flex">
        <Logo />

        <nav className="mt-9 flex flex-col gap-1">
          <p className="label-xs mb-2 px-2">Workspace</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                  active
                    ? "bg-white/[0.06] text-white"
                    : "text-mist hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-lime-300" />
                )}
                <Icon className={active ? "text-lime-300" : "text-mist"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent p-4">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-lime-300" />
            <p className="mono text-[10px] tracking-[0.16em] text-white">SIGNING CORE</p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mist">
            JAR v1 manifest + APK Signature Scheme v2 sealed in-process. No external SDK on the
            signing path.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip border-lime-300/30 text-lime-200">v1</span>
            <span className="chip border-violet-400/30 text-violet-200">v2</span>
            <span className="chip">RSA-4096</span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-300 pulse-dot" />
            <span className="mono text-[10px] tracking-[0.12em] text-mist">ENGINE READY</span>
          </div>
        </div>

        <Link
          href="/android"
          className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-lime-300/25 bg-lime-300/[0.07] px-4 py-3 transition hover:border-lime-300/50"
        >
          <span className="flex flex-col">
            <span className="text-[12px] font-semibold text-white">Get the APK</span>
            <span className="mono text-[9px] tracking-[0.12em] text-lime-200/70">
              ZELVARYN 1.0.0 · 33 KB
            </span>
          </span>
          <DownloadIcon className="h-4 w-4 text-lime-300" />
        </Link>

        <div className="mt-auto pt-6">
          <p className="mono text-[9px] leading-relaxed tracking-[0.12em] text-white/25">
            ZELVARYN 1.0.0
            <br />
            APK-SIG ENGINE · NODE 22
          </p>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#08060f]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Logo />
          <span className="chip border-lime-300/30 text-lime-200">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-300 pulse-dot" />
            v2 online
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-9">
          {children}
        </main>

        <footer className="hidden border-t border-white/[0.06] px-10 py-5 lg:block">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
            <p className="mono text-[10px] tracking-[0.14em] text-white/30">
              ZELVARYN · FILES IN, SIGNED APKS OUT
            </p>
            <p className="mono text-[10px] tracking-[0.14em] text-white/30">
              v1 JAR + v2 APK SIGNATURE SCHEME
            </p>
          </div>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#08060f]/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[9px] font-medium tracking-[0.04em] transition ${
                  active ? "text-lime-300" : "text-mist"
                }`}
              >
                <Icon className={active ? "h-[20px] w-[20px]" : "h-[19px] w-[19px]"} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
