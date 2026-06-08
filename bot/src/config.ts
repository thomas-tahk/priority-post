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
  timezone: string | undefined;
};

export function loadConfig(): Config {
  const digestHour = Number(process.env.DIGEST_HOUR ?? "8");
  return {
    discordToken: required("DISCORD_BOT_TOKEN"),
    channelId: required("DISCORD_CHANNEL_ID"),
    ownerId: required("OWNER_DISCORD_ID"),
    webBaseUrl: required("WEB_BASE_URL").replace(/\/$/, ""),
    internalSecret: required("INTERNAL_API_SECRET"),
    anthropicApiKey: required("ANTHROPIC_API_KEY"),
    digestHour: Number.isInteger(digestHour) && digestHour >= 0 && digestHour <= 23 ? digestHour : 8,
    timezone: process.env.TZ || undefined,
  };
}
