import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Zelvaryn — APK Signing Studio",
  description:
    "Zelvaryn takes your build artifacts and returns fully signed APKs. Real JAR v1 + APK Signature Scheme v2 signing, keystore vault, and a native Android client.",
  applicationName: "Zelvaryn",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05040b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
