// Local test harness: drive the agent loop from the terminal, no Discord.
// Talks to a running web app over /api/internal/* exactly as the bot does, so it
// exercises the real tool-use → API → DB chain. Point it at your LOCAL dev server
// (not prod) since the agent can create/complete/delete real tasks.
//
//   WEB_BASE_URL=http://localhost:3000 INTERNAL_API_SECRET=... ANTHROPIC_API_KEY=... pnpm repl
//
// Type messages like you would in Discord ("what's next?", "add: call dentist friday 3pm").
// Ctrl-C or "/exit" to quit.

import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { HttpPlannerApi } from "./api.js";
import { runAgent } from "./agent.js";
import { trimHistory } from "./history.js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}.`);
  return v;
}

const baseUrl = (process.env.WEB_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const api = new HttpPlannerApi(baseUrl, required("INTERNAL_API_SECRET"));
const anthropic = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });

let history: Anthropic.MessageParam[] = [];

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log(`planner REPL → ${baseUrl}   (Ctrl-C or /exit to quit)\n`);

  while (true) {
    let line: string;
    try {
      line = (await rl.question("you › ")).trim();
    } catch {
      break; // stdin closed / EOF (e.g. piped input exhausted)
    }
    if (!line) continue;
    if (line === "/exit" || line === "/quit") break;

    try {
      history.push({ role: "user", content: line });
      const { reply, messages } = await runAgent(history, api, anthropic, new Date());
      history = trimHistory(messages);
      console.log(`bot › ${reply}\n`);
    } catch (e) {
      console.error(`⚠️  ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
