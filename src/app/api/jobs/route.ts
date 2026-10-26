import { listJobs } from "@/lib/zelvaryn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await listJobs(50);
    return Response.json({ jobs });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load artifacts." },
      { status: 500 },
    );
  }
}
