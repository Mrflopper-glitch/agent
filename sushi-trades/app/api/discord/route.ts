import { checkIngestSecret } from "@/lib/server/auth";
import { clearDiscordData, readDiscordData } from "@/lib/server/discord-store";

/**
 * GET  /api/discord?since=<version>  → everything received from Discord
 *                                      (204 No Content if nothing changed since that version)
 * DELETE /api/discord                → wipe it (needs the ingest secret)
 */

export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since");
  const data = await readDiscordData();
  if (since !== null && Number(since) === data.version) return new Response(null, { status: 204 });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const denied = checkIngestSecret(request);
  if (denied) return Response.json({ error: denied }, { status: 401 });
  await clearDiscordData();
  return Response.json({ ok: true });
}
