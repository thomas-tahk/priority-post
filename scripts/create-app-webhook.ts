// Creates a webhook owned by the bot application, in the same channel as the
// current digest webhook. Run once.
//
//   DISCORD_CHANNEL_ID=... pnpm tsx scripts/create-app-webhook.ts
//
// DISCORD_BOT_TOKEN comes from .env.local. The channel is DISCORD_CHANNEL_ID,
// or else read from the current DISCORD_WEBHOOK_URL.
//
// Why: the check-in's buttons only work on messages from a webhook the
// application created. A webhook made in Discord's channel settings drops them
// (docs: "Non-application-owned webhooks cannot send interactive components").
//
// The new URL is a secret. It is written to .env.webhook.local (gitignored) and
// never printed; paste it into Vercel as DISCORD_WEBHOOK_URL.

import { writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const API = "https://discord.com/api/v10";
const OUT = ".env.webhook.local";

async function run() {
  const token = required("DISCORD_BOT_TOKEN");
  const channelId = process.env.DISCORD_CHANNEL_ID || (await channelOfCurrentWebhook());

  const res = await fetch(`${API}/channels/${channelId}/webhooks`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "priority-post" }),
  });
  if (!res.ok) {
    const hint = res.status === 403 ? " — the bot needs Manage Webhooks in that channel" : "";
    throw new Error(`creating the webhook → ${res.status}${hint}`);
  }
  const hook = (await res.json()) as { id: string; token: string; application_id: string | null };
  if (!hook.application_id) throw new Error("Discord created a webhook with no owning application");

  writeFileSync(OUT, `DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/${hook.id}/${hook.token}\n`, { mode: 0o600 });
  console.log(`created an application-owned webhook in channel ${channelId}; URL written to ${OUT}`);
}

/** A webhook URL answers a plain GET with its own details, channel included. */
async function channelOfCurrentWebhook(): Promise<string> {
  const info = await fetch(required("DISCORD_WEBHOOK_URL"));
  if (!info.ok) throw new Error(`reading the current webhook → ${info.status}`);
  return ((await info.json()) as { channel_id: string }).channel_id;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
