// Server-only generative AI for the planner: break a goal into sub-tasks, and
// turn progress numbers into a short honest read. Same key-scoping convention as
// triage.ts / explain.ts — never imported into a client bundle.
import Anthropic from "@anthropic-ai/sdk";
import type { Goal } from "@/db/schema";
import type { ProgressStats } from "./digest";

const MODEL = "claude-sonnet-4-6";

type Deps = { client?: Anthropic; apiKey?: string };

function getClient(deps: Deps): Anthropic | null {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps.client) return null;
  return deps.client ?? new Anthropic({ apiKey });
}

const DECOMPOSE_TOOL: Anthropic.Tool = {
  name: "propose_subtasks",
  description: "Record the proposed sub-tasks for the goal.",
  input_schema: {
    type: "object",
    properties: {
      subtasks: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 7,
        description: "Concrete, actionable task titles. Each should read like a real to-do entry.",
      },
    },
    required: ["subtasks"],
    additionalProperties: false,
  },
};

/** Break a goal into 2–7 concrete sub-task titles. Returns plain strings the
 *  user accepts (the bot creates them on a follow-up) — nothing auto-inserted. */
export async function decomposeGoal(goal: Goal, deps: Deps = {}): Promise<string[]> {
  const client = getClient(deps);
  if (!client) return [];

  const desc = goal.description ? `\nDescription: ${goal.description}` : "";
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You break a personal goal into a short list of concrete, actionable next tasks for a single-user to-do app. " +
      "Each task is a specific action the person can start, phrased like a real to-do (e.g. 'Draft the landing page copy'), " +
      "not a vague theme. Prefer 3–5. Order them the way you'd actually tackle them.",
    tools: [DECOMPOSE_TOOL],
    tool_choice: { type: "tool", name: "propose_subtasks" },
    messages: [{ role: "user", content: `Goal: ${goal.name}${desc}` }],
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "propose_subtasks") {
      const input = block.input as { subtasks?: unknown };
      if (Array.isArray(input.subtasks)) {
        return input.subtasks.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
      }
    }
  }
  return [];
}

/** A 1–2 sentence honest read of recent activity, generated from the numbers. */
export async function summarizeProgress(stats: ProgressStats, deps: Deps = {}): Promise<string> {
  const client = getClient(deps);
  if (!client) return "(Progress summary unavailable — ANTHROPIC_API_KEY not set.)";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You are an honest, warm accountability coach for a personal to-do app. Given activity numbers over a recent window, " +
      "write 1–2 short sentences speaking directly to the user ('you'). Be concrete and specific to the numbers. " +
      "Acknowledge real progress; gently name what's slipping. No lists, no markdown, no preamble.",
    messages: [
      {
        role: "user",
        content: `Over the last ${stats.sinceDays} days: completed ${stats.completed}, created ${stats.created}. Right now: ${stats.open} open tasks, ${stats.overdueOpen} overdue, ${stats.idleGoals} idle goals.`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
