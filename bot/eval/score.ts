// The scoring half of the run: pure, so it is covered by `pnpm test` while the
// API-calling half in run.ts is not.
import type Anthropic from "@anthropic-ai/sdk";
import { evaluateCase } from "./match.js";
import { recordedCallsFrom } from "./world.js";
import type { Case, CaseResult } from "./types.js";

/** The reply runAgent returns when it burns through MAX_ROUNDS without finishing. */
const ROUND_LIMIT_REPLY = "I got tangled up mid-task — mind trying that again?";

export function toHistory(c: Case): Anthropic.MessageParam[] {
  const prior: Anthropic.MessageParam[] = (c.history ?? []).map((turn) => ({
    role: turn.role,
    content: turn.text,
  }));
  return [...prior, { role: "user", content: c.message }];
}

export function scoreCase(
  c: Case,
  messages: Anthropic.MessageParam[],
  reply?: string
): CaseResult {
  const recorded = recordedCallsFrom(messages);
  const { passed, reasons } = evaluateCase(c.expect, recorded);

  // A round-limit bail is a failure, but a distinct one — the agent never got to
  // a decision, so "wrong tool" would be the wrong diagnosis.
  const hitRoundLimit = reply === ROUND_LIMIT_REPLY;
  const allReasons = hitRoundLimit ? [...reasons, "round_limit — agent exhausted MAX_ROUNDS"] : reasons;

  return {
    id: c.id,
    category: c.category,
    message: c.message,
    status: passed && !hitRoundLimit ? "PASS" : "FAIL",
    reasons: allReasons,
    recorded,
    reply,
  };
}

export function erroredCase(c: Case, error: unknown): CaseResult {
  return {
    id: c.id,
    category: c.category,
    message: c.message,
    status: "ERROR",
    reasons: [error instanceof Error ? error.message : String(error)],
    recorded: [],
  };
}
