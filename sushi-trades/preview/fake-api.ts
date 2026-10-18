import { ingestMessage, type IncomingMessage } from "@/lib/server/ingest";
import type { DiscordData } from "@/lib/types";

/**
 * The preview build has no server, so this answers the app's /api/discord
 * requests right in the browser, using the same ingest logic as the server.
 * Whatever you send from the Tools page is saved in this browser only.
 */

const STORAGE_KEY = "sushi-preview-discord-v1";

function empty(): DiscordData {
  return { traders: [], trades: [], messages: [], lastMessageAt: null, version: 0 };
}

export function loadDiscord(): DiscordData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...empty(), ...JSON.parse(saved) } : empty();
  } catch {
    return empty();
  }
}

function save(data: DiscordData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage blocked: the data still lives until the page closes.
  }
}

let memory: DiscordData | null = null;
const current = () => (memory ??= loadDiscord());

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function handle(method: string, url: URL, init?: RequestInit): Promise<Response> {
  const data = current();

  if (url.pathname.endsWith("/api/discord/ingest") && method === "POST") {
    let body: Partial<IncomingMessage>;
    try {
      body = JSON.parse(String(init?.body ?? ""));
    } catch {
      return json({ error: "Body must be JSON." }, 400);
    }
    if (!body.id || !body.authorUsername || typeof body.content !== "string") {
      return json({ error: "Expected { id, authorUsername, content }." }, 400);
    }
    const result = ingestMessage(data, body as IncomingMessage);
    data.version += 1;
    save(data);
    return json(result, result.duplicate ? 200 : 201);
  }

  if (method === "DELETE") {
    memory = { ...empty(), version: data.version + 1 };
    save(memory);
    return json({ ok: true });
  }

  const since = url.searchParams.get("since");
  if (since !== null && Number(since) === data.version) return new Response(null, { status: 204 });
  return json(data);
}

/** Routes fetch() calls for /api/discord to the in-browser handler above. */
export function installFakeApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (!/\/api\/discord(\/ingest)?$/.test(url.pathname)) return realFetch(input, init);
    return handle((init?.method ?? "GET").toUpperCase(), url, init);
  };
}
