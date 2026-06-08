import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type SendableChannels,
} from "discord.js";
import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "./config.js";
import { HttpPlannerApi } from "./api.js";
import { runAgent } from "./agent.js";
import { startScheduler } from "./scheduler.js";
import { trimHistory } from "./history.js";

const config = loadConfig();
const api = new HttpPlannerApi(config.webBaseUrl, config.internalSecret);
const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Rolling, in-process conversation context (resets on restart — fine for v1).
let history: Anthropic.MessageParam[] = [];

const DISCORD_LIMIT = 1900;

function chunk(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += DISCORD_LIMIT) out.push(text.slice(i, i + DISCORD_LIMIT));
  return out.length ? out : ["(empty)"];
}

async function postToChannel(text: string): Promise<void> {
  const channel = await client.channels.fetch(config.channelId);
  if (!channel?.isSendable()) {
    console.error("configured channel is not sendable:", config.channelId);
    return;
  }
  const sendable = channel as SendableChannels;
  for (const part of chunk(text)) await sendable.send(part);
}

client.once(Events.ClientReady, (c) => {
  console.log(`priority-post bot ready as ${c.user.tag}`);
  startScheduler({ api, send: postToChannel, digestHour: config.digestHour, timezone: config.timezone });
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  if (msg.channelId !== config.channelId) return;
  if (msg.author.id !== config.ownerId) return;

  const content = msg.content.trim();
  if (!content) return;

  try {
    if (msg.channel.isSendable()) await msg.channel.sendTyping();
    history.push({ role: "user", content });
    const { reply, messages } = await runAgent(history, api, anthropic, new Date());
    history = trimHistory(messages);
    for (const part of chunk(reply)) await msg.reply(part);
  } catch (e) {
    console.error("message handler failed:", e);
    await msg.reply("⚠️ I couldn't reach the planner just now — try again in a moment.");
  }
});

client.login(config.discordToken);
