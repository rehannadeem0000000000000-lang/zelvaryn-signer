import { MAX_UPLOAD_BYTES, signAndStore } from "@/lib/zelvaryn";
import { formatBytes } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "Expected a multipart upload." }, { status: 415 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const keystoreId = form.get("keystoreId");
    const passphrase = form.get("passphrase");
    const source = form.get("source");

    if (!(file instanceof File)) {
      return Response.json({ error: "Attach an APK or ZIP artifact." }, { status: 400 });
    }
    if (typeof keystoreId !== "string" || !keystoreId) {
      return Response.json({ error: "Choose a signing keystore." }, { status: 400 });
    }
    if (typeof passphrase !== "string" || !passphrase) {
      return Response.json({ error: "Keystore passphrase is required." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: `Artifact exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} limit.` },
        { status: 413 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await signAndStore({
      fileBytes: bytes,
      fileName: file.name || "artifact.apk",
      keystoreId,
      passphrase,
      source: typeof source === "string" ? source : "studio",
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Signing failed." },
      { status: 400 },
    );
  }
}
