// Entry point for `pnpm eval`. Runs every case through the REAL runAgent against
// the REAL Claude API and scores which tools got called with which arguments.
//
// Deliberately NOT part of `pnpm test`: it costs money and is not perfectly
// deterministic. Green CI must not depend on a model's mood.
//
// This file is the impure half — everything it decides lives in score.ts,
// match.ts and report.ts, which are unit-tested without touching the network.
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, runAgent } from "../src/agent.js";
import { CASES } from "./cases.js";
import { renderScorecard } from "./report.js";
import { erroredCase, scoreCase, toHistory } from "./score.js";
import { FIXED_NOW, makeWorld } from "./world.js";
import type { CaseResult, RunMeta } from "./types.js";

const TEMPERATURE = 0;
const DELAY_MS = 400; // stay clear of rate limits; cases run sequentially

const REPORTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "reports");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reportFilename(startedAt: Date): string {
  return `${startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
}

async function runCase(caseDef: (typeof CASES)[number], anthropic: Anthropic): Promise<CaseResult> {
  // A fresh world per case: no leakage between cases, and every case starts from
  // the identical account so scores are comparable across runs.
  const { api } = makeWorld();
  try {
    const { reply, messages } = await runAgent(
      toHistory(caseDef),
      api,
      anthropic,
      FIXED_NOW,
      TEMPERATURE
    );
    return scoreCase(caseDef, messages, reply);
  } catch (e) {
    return erroredCase(caseDef, e);
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY is not set — refusing to start.\n" +
        "Set it in bot/.env (see bot/.env.example) and re-run `pnpm eval`."
    );
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey });
  const meta: RunMeta = { model: MODEL, temperature: TEMPERATURE, startedAt: new Date() };
  const results: CaseResult[] = [];

  console.log(`Running ${CASES.length} cases against ${MODEL} (temperature ${TEMPERATURE})...\n`);

  for (const [i, caseDef] of CASES.entries()) {
    const result = await runCase(caseDef, anthropic);
    results.push(result);

    const mark = result.status === "PASS" ? "✓" : result.status === "FAIL" ? "✗" : "!";
    console.log(`  ${mark} [${i + 1}/${CASES.length}] ${caseDef.id}  ${caseDef.message}`);

    if (i < CASES.length - 1) await sleep(DELAY_MS);
  }

  const scorecard = renderScorecard(results, meta);
  console.log(`\n${scorecard}\n`);

  await mkdir(REPORTS_DIR, { recursive: true });
  const file = path.join(REPORTS_DIR, reportFilename(meta.startedAt));
  await writeFile(file, `\`\`\`\n${scorecard}\n\`\`\`\n`, "utf8");
  console.log(`report written to ${path.relative(process.cwd(), file)}`);
}

// No argv guard here — this module exists only to be executed. The pure logic
// lives in score.ts, so tests never import this file and never fire a request.
await main();
