import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. See bot/.env.example.`);
  return v;
}

export type Config = {
  discordToken: string;
  channelId: string;
  ownerId: string;
  webBaseUrl: string;
  internalSecret: string;
  anthropicApiKey: string;
  digestHour: number; // 0-23, local to TZ
  digestMinute: number; // 0-59, local to TZ
  activeStartHour: number; // 0-23, start of the window that allows due-soon pings
  activeEndHour: number; // 0-23, end of that window
  timezone: string | undefined;
};

// Reads an int env var, falling back to `fallback` when absent, non-numeric, or out of range.
function intInRange(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function loadConfig(): Config {
  return {
    discordToken: required("DISCORD_BOT_TOKEN"),
    channelId: required("DISCORD_CHANNEL_ID"),
    ownerId: required("OWNER_DISCORD_ID"),
    webBaseUrl: required("WEB_BASE_URL").replace(/\/$/, ""),
    internalSecret: required("INTERNAL_API_SECRET"),
    anthropicApiKey: required("ANTHROPIC_API_KEY"),
    digestHour: intInRange("DIGEST_HOUR", 8, 0, 23),
    digestMinute: intInRange("DIGEST_MINUTE", 0, 0, 59),
    activeStartHour: intInRange("ACTIVE_START_HOUR", 16, 0, 23),
    activeEndHour: intInRange("ACTIVE_END_HOUR", 22, 0, 23),
    timezone: process.env.TZ || undefined,
  };
}
