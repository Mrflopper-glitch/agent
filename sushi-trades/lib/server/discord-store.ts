import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DiscordData } from "../types";

/**
 * Where Discord traders, trades and messages are saved: a single JSON file.
 *
 * Perfect for running locally or on one server. When you host on a platform
 * without a writable disk (like Vercel), swap these two functions for a
 * database (Supabase, Neon, Upstash...) — nothing else has to change.
 */

const DATA_DIR = process.env.SUSHI_DATA_DIR ?? path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "discord.json");

/** Keep the file small: only the most recent messages are stored. */
const MAX_MESSAGES = 1000;

export const EMPTY_DISCORD: DiscordData = { traders: [], trades: [], messages: [], lastMessageAt: null, version: 0 };

export async function readDiscordData(): Promise<DiscordData> {
  try {
    return { ...EMPTY_DISCORD, ...JSON.parse(await readFile(FILE, "utf8")) };
  } catch {
    return EMPTY_DISCORD; // no file yet: nothing has arrived from Discord
  }
}

// Writes go one at a time, so two messages arriving together can't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

/** Read the data, let `change` modify it, and save it. Returns whatever `change` returns. */
export function updateDiscordData<T>(change: (data: DiscordData) => T): Promise<T> {
  const run = queue.then(async () => {
    const data = structuredClone(await readDiscordData());
    const result = change(data);
    data.messages = data.messages.slice(-MAX_MESSAGES);
    data.version += 1;
    await mkdir(DATA_DIR, { recursive: true });
    const temporary = `${FILE}.tmp`;
    await writeFile(temporary, JSON.stringify(data));
    await rename(temporary, FILE); // atomic: readers never see a half-written file
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function clearDiscordData(): Promise<void> {
  await updateDiscordData((data) => {
    data.traders = [];
    data.trades = [];
    data.messages = [];
    data.lastMessageAt = null;
  });
}
