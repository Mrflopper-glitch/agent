import { checkIngestSecret } from "@/lib/server/auth";
import { updateDiscordData } from "@/lib/server/discord-store";
import { ingestMessage, type IncomingMessage } from "@/lib/server/ingest";

/**
 * POST /api/discord/ingest
 *
 * The Discord bot (bot/index.ts) sends every new message here:
 *   { id, authorUsername, authorDisplayName?, channelName?, content, timestamp? }
 *
 * Replies with what happened: whether it was a trade, and which one.
 */
export async function POST(request: Request) {
  const denied = checkIngestSecret(request);
  if (denied) return Response.json({ error: denied }, { status: 401 });

  let body: Partial<IncomingMessage>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!body.id || !body.authorUsername || typeof body.content !== "string") {
    return Response.json({ error: "Expected { id, authorUsername, content }." }, { status: 400 });
  }

  const result = await updateDiscordData((data) => ingestMessage(data, body as IncomingMessage));
  return Response.json(result, { status: result.duplicate ? 200 : 201 });
}
