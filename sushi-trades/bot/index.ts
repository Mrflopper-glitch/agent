/**
 * The Sushi Discord bot.
 *
 * It sits in your Discord server, and every time someone posts in the
 * channels you choose, it forwards the message to the Sushi app
 * (POST /api/discord/ingest). The app works out whether it's a trade.
 *
 * Run it with:  npm run bot
 * Settings come from .env.local (see .env.example).
 */
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: use the environment variables already set.
}

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_IDS = (process.env.DISCORD_CHANNEL_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const SUSHI_URL = (process.env.SUSHI_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.DISCORD_INGEST_SECRET ?? "";

if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const client = new Client({
  // MessageContent lets the bot read what messages say. Turn it on in the Discord developer portal too.
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, (ready) => {
  const watching = CHANNEL_IDS.length ? `channels ${CHANNEL_IDS.join(", ")}` : "every channel it can see";
  console.log(`🍣 Logged in as ${ready.user.tag}, watching ${watching}. Sending to ${SUSHI_URL}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.trim()) return;
  if (CHANNEL_IDS.length && !CHANNEL_IDS.includes(message.channelId)) return;
  await forward(message);
});

/** Sends one message to Sushi, retrying a couple of times if the app is unreachable. */
async function forward(message: Message) {
  const body = {
    id: message.id,
    authorId: message.author.id,
    authorUsername: message.author.username,
    authorDisplayName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    channelName: "name" in message.channel && message.channel.name ? message.channel.name : "discord",
    content: message.content,
    timestamp: message.createdTimestamp,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${SUSHI_URL}/api/discord/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}) },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        console.error(`Sushi rejected message ${message.id}: ${result.error}`);
        return;
      }
      const what = result.action ? `${result.action} ${result.trade?.symbol ?? ""}` : "chat";
      console.log(`#${body.channelName} @${body.authorUsername}: ${what}${result.note ? ` (${result.note})` : ""}`);
      return;
    } catch {
      console.warn(`Couldn't reach Sushi at ${SUSHI_URL} (attempt ${attempt} of 3)`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

client.login(TOKEN);
