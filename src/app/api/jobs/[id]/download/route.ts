import { getArtifact } from "@/lib/zelvaryn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const artifact = await getArtifact(id);
  if (!artifact) return Response.json({ error: "Artifact not found." }, { status: 404 });

  const body = new Uint8Array(artifact.artifact);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${artifact.outputName.replace(/"/g, "")}"`,
      "Content-Length": String(body.byteLength),
      "X-Zelvaryn-SHA256": artifact.sha256,
      "Cache-Control": "no-store",
    },
  });
}
