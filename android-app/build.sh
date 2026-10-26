#!/usr/bin/env bash
# Zelvaryn Android — toolchain build (no Gradle required)
# Requires: JDK 17, Android build-tools 34, Android platform 35 (android.jar)
# Usage: ANDROID_HOME=/path/to/sdk ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-/tmp/aos}"
BT="$SDK/bt/android-14"
PLATFORM="${ANDROID_PLATFORM_JAR:-$SDK/plat/android-35/android.jar}"
JAVA_HOME="${JAVA_HOME:-$SDK/jdk}"
PATH="$JAVA_HOME/bin:$PATH"

APP_NAME="zelvaryn-1.0.0.apk"
KEYSTORE="${ZELVARYN_KEYSTORE:-keystore/zelvaryn-release.jks}"
KS_PASS="${ZELVARYN_STOREPASS:-zelvaryn2026}"
KS_ALIAS="${ZELVARYN_ALIAS:-zelvaryn}"
OUT="build"

rm -rf "$OUT"
mkdir -p "$OUT/compiled" "$OUT/classes" "$OUT/dex" "$OUT/gen"
mkdir -p "$(dirname "$KEYSTORE")"

echo "==> compiling resources"
find res -type f | while read -r f; do
  "$BT/aapt2" compile -o "$OUT/compiled" "$f"
done

echo "==> linking resources"
"$BT/aapt2" link \
  -o "$OUT/unsigned.apk" \
  -I "$PLATFORM" \
  --manifest AndroidManifest.xml \
  --min-sdk-version 24 \
  --target-sdk-version 35 \
  --version-code 1 \
  --version-name 1.0.0 \
  --java "$OUT/gen" \
  --auto-add-overlay \
  $(find "$OUT/compiled" -name '*.flat' | tr '\n' ' ')

echo "==> compiling java"
"$JAVA_HOME/bin/javac" -source 8 -target 8 -nowarn -encoding UTF-8 \
  -bootclasspath "$PLATFORM" -classpath "$PLATFORM" \
  -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')

echo "==> dexing (d8)"
"$BT/d8" --release --min-api 24 --lib "$PLATFORM" \
  --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

echo "==> packaging classes.dex"
(cd "$OUT/dex" && zip -q -X "../unsigned.apk" classes.dex)

if [ ! -f "$KEYSTORE" ]; then
  echo "==> generating release keystore"
  "$JAVA_HOME/bin/keytool" -genkeypair -v \
    -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Zelvaryn, OU=Signing Studio, O=Zelvaryn, L=Internet, C=US" >/dev/null
fi

echo "==> zipalign"
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "==> apksigner (v1 + v2)"
"$BT/apksigner" sign \
  --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --ks-key-alias "$KS_ALIAS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT/$APP_NAME" "$OUT/aligned.apk"

echo "==> verifying"
"$BT/apksigner" verify --verbose --print-certs "$OUT/$APP_NAME"

echo
echo "APK: $OUT/$APP_NAME"
sha256sum "$OUT/$APP_NAME" || true
