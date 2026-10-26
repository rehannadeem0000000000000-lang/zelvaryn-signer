import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  return Response.json(
    {
      ok: database,
      app: "zelvaryn",
      engine: "apk-sig-v2",
      version: "1.0.0",
      schemes: ["v1", "v2"],
      database,
      time: new Date().toISOString(),
    },
    { status: database ? 200 : 503 },
  );
}
