/**
 * Only the Discord bot (and you) may write Discord data. They prove it by
 * sending the shared secret: `Authorization: Bearer <DISCORD_INGEST_SECRET>`.
 *
 * During local development, with no secret set, writes are allowed so you can
 * try things from the Tools page.
 *
 * Returns null when the request is allowed, or the reason it isn't.
 */
export function checkIngestSecret(request: Request): string | null {
  const secret = process.env.DISCORD_INGEST_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "production" ? "The server has no DISCORD_INGEST_SECRET set, so it can't accept Discord messages yet." : null;
  }
  return request.headers.get("authorization") === `Bearer ${secret}` ? null : "Missing or wrong secret.";
}
