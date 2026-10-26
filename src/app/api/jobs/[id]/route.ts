import { getJob } from "@/lib/zelvaryn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Artifact not found." }, { status: 404 });
  return Response.json({ job, downloadUrl: `/api/jobs/${job.id}/download` });
}
