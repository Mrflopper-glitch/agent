import { io } from "next/cache";
import type { ReactNode } from "react";
import { readDiscordData } from "@/lib/server/discord-store";
import { AppState } from "@/state/app-state";

/**
 * Runs on the server for each visit: reads the clock and the saved Discord
 * data, then hands both to the browser-side app state.
 */
export async function AppData({ children }: { children: ReactNode }) {
  const [serverNow, discord] = await Promise.all([requestTime(), readDiscordData()]);
  return (
    <AppState serverNow={serverNow} initialDiscord={discord}>
      {children}
    </AppState>
  );
}

/** The time of this request. io() tells Next.js not to bake one fixed time into the build. */
async function requestTime(): Promise<number> {
  await io();
  return Date.now();
}
