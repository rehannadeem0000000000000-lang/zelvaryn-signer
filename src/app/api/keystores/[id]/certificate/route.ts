import { eq } from "drizzle-orm";
import { db } from "@/db";
import { keystores } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [row] = await db
    .select({ alias: keystores.alias, certDer: keystores.certDer })
    .from(keystores)
    .where(eq(keystores.id, id))
    .limit(1);

  if (!row) return Response.json({ error: "Keystore not found." }, { status: 404 });

  const der = Buffer.from(row.certDer, "base64");
  const body = der.toString("base64").replace(/(.{64})/g, "$1\n").trim();
  const pem = `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;

  return new Response(pem, {
    headers: {
      "Content-Type": "application/x-pem-file",
      "Content-Disposition": `attachment; filename="${row.alias}-cert.pem"`,
      "Cache-Control": "no-store",
    },
  });
}
