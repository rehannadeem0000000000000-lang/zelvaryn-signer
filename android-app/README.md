# Zelvaryn — native Android client

Zelvaryn is an APK signing studio. This directory contains the **native Android client**: a plain
Java app (no AndroidX, no Gradle wrapper downloads) that talks to a Zelvaryn studio, stages an
artifact with the Storage Access Framework, seals it against the studio's signing engine, and writes
the signed APK into `Downloads/Zelvaryn`.

## What it does

- `01 · Studio endpoint` — store and health-check the studio URL (`/api/health`).
- `02 · Signing key` — pull the keystore inventory (`/api/keystores`), choose an identity, enter the
  passphrase. Passwords are never persisted.
- `03 · Artifact` — pick any `*/*` file through `ACTION_OPEN_DOCUMENT`.
- `SIGN & DELIVER` — streams a multipart request to `/api/sign`, then downloads the binary from
  `/api/jobs/:id/download` and saves it via MediaStore (API 29+) or app-scoped external storage.

## Build (no Gradle needed)

Requirements: JDK 17, Android build-tools 34 (`aapt2`, `d8`, `zipalign`, `apksigner`), platform 35
(`android.jar`).

```bash
ANDROID_HOME=/path/to/android-sdk \
JAVA_HOME=/path/to/jdk17 \
./build.sh
```

`build.sh`:

1. compiles resources with `aapt2` and links them (generating `R.java`),
2. compiles Java against `android.jar`,
3. dexes with `d8 --release --min-api 24`,
4. packages `classes.dex`, aligns with `zipalign -p 4`,
5. signs with `apksigner` (v1 + v2 + v3), generating `keystore/zelvaryn-release.jks` on first run,
6. verifies the output and prints its SHA-256.

Output: `build/zelvaryn-1.0.0.apk`.

> The published APK was produced with exactly this pipeline (build-tools 34, platform 35, JDK 17) and
> verified with `apksigner verify --verbose`. The keystore is **not** included in the downloadable
> source archive; a fresh one is generated for your own builds.

## Permissions

`INTERNET`, `ACCESS_NETWORK_STATE`. `usesCleartextTraffic` is enabled so local development studios
(`http://10.0.2.2:3000`, LAN IPs) work out of the box — remove it for a production-only build.
