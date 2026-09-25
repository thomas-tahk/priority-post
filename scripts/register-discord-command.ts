// Registers the /pp slash command with Discord. Run once, and again only when
// the command's name, description or options change — not on every deploy.
//
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... pnpm discord:register
//
// Global commands can take up to an hour to appear the first time; re-running
// it later updates in place rather than creating a duplicate.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const STRING_OPTION = 3;

// Where the command can be installed: to a server, and to the owner's account.
const GUILD_INSTALL = 0;
const USER_INSTALL = 1;

// Where it can then be used: in a server, in a DM with the app, and in group
// DMs / other people's DMs. The last two are what make it reachable from a
// phone without opening the server.
const CONTEXT_GUILD = 0;
const CONTEXT_BOT_DM = 1;
const CONTEXT_PRIVATE_CHANNEL = 2;

const command = {
  name: "pp",
  description: "Talk to your planner — ask, add, reschedule, or complete a task.",
  options: [
    {
      type: STRING_OPTION,
      name: "message",
      description: "e.g. what's next? · add: call the dentist friday 3pm · reset",
      required: true,
    },
  ],
  integration_types: [GUILD_INSTALL, USER_INSTALL],
  contexts: [CONTEXT_GUILD, CONTEXT_BOT_DM, CONTEXT_PRIVATE_CHANNEL],
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See docs/discord-setup.md.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const appId = required("DISCORD_APP_ID");
  const token = required("DISCORD_BOT_TOKEN");

  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const text = await res.text();
  if (!res.ok) {
    // The body names the offending field, which is the only useful part of a
    // Discord validation error.
    console.error(`Discord refused the command (${res.status}):\n${text}`);
    process.exit(1);
  }

  console.log(`Registered /${command.name}. It can take up to an hour to appear the first time.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
