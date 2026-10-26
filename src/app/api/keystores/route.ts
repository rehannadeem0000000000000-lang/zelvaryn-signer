import { createKeystore, ensureDemoKeystore, listKeystores } from "@/lib/zelvaryn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDemoKeystore();
    const keystores = await listKeystores();
    return Response.json({ keystores });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not list keystores." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const keystore = await createKeystore({
      alias: String(body.alias ?? ""),
      commonName: String(body.commonName ?? ""),
      organization: body.organization ? String(body.organization) : undefined,
      organizationalUnit: body.organizationalUnit ? String(body.organizationalUnit) : undefined,
      country: body.country ? String(body.country) : undefined,
      validityDays: body.validityDays ? Number(body.validityDays) : undefined,
      keySize: body.keySize ? (Number(body.keySize) as 2048 | 3072 | 4096) : undefined,
      passphrase: String(body.passphrase ?? ""),
      hint: body.hint ? String(body.hint) : undefined,
    });
    return Response.json({ keystore }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create keystore." },
      { status: 400 },
    );
  }
}
