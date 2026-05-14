// Sprint 5: streaming Claude (Sonnet 4.6) prose for "Why this order?" and
// "Ask AI about this task". Server-only — relies on Next env scoping to keep
// ANTHROPIC_API_KEY out of the client bundle (same pattern as triage.ts).
import Anthropic from "@anthropic-ai/sdk";
import type { Task } from "@/db/schema";
import { WEIGHTS, score, timeOfDay } from "@/features/tasks/scorer";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;

const SYSTEM_PERSONA = `You are the explainer for a personal smart to-do app called priority-post.

The app ranks open tasks with a deterministic score:
  score = ${WEIGHTS.urgency} * urgency_pressure(now, urgency, start_at)
        + ${WEIGHTS.importance} * (importance / 100)
        + ${WEIGHTS.fit} * fit_now(focus, time_of_day)
Ties break to older tasks first (by created_at).

urgency_pressure (0-1): scales urgency by deadline proximity. Past-due or due-now → 1.0. Within 24h → ramps from ~1 down to ~0.2. 1-7 days out → ~0.5 down to ~0.02. No start_at → urgency / 100.

fit_now (0-1): how well the task's focus level matches the current time of day. High focus rewards mornings; low focus rewards evenings. Missing focus defaults to 0.5.

You speak directly to the user (use "you", not "the user"). Be concise, warm, and concrete. Quote specific task titles, not IDs. Default to 2-4 short paragraphs, plain text — no markdown headers, no bullet lists unless really necessary. Keep total length under ~180 words.

If the active list is empty, say so plainly in one sentence.`;

function serializeTasks(tasks: Task[], now: Date): string {
  return JSON.stringify(
    tasks.map((t, i) => ({
      rank: i + 1,
      id: t.id,
      title: t.title,
      categories: t.categories,
      urgency: t.urgency,
      importance: t.importance,
      est_time_min: t.estTimeMin,
      focus: t.focus,
      score: Number(score(t, now).toFixed(3)),
      start_at: t.startAt?.toISOString() ?? null,
      notes: t.notes,
    }))
  );
}

export type ExplainDeps = {
  client?: Anthropic;
  apiKey?: string;
};

async function* streamExplain(
  rankedTasks: Task[],
  now: Date,
  userMessage: string,
  deps: ExplainDeps
): AsyncGenerator<string> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps.client) {
    yield "(ANTHROPIC_API_KEY is not set on the server — explanations are disabled.)";
    return;
  }
  const client = deps.client ?? new Anthropic({ apiKey });

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PERSONA,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `Current time: ${now.toISOString()} (local time of day: ${timeOfDay(now)}).\n\nActive ranked tasks (JSON, in rank order):\n${serializeTasks(rankedTasks, now)}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

export function streamWhyThisOrder(
  rankedTasks: Task[],
  now: Date,
  deps: ExplainDeps = {}
): AsyncGenerator<string> {
  const prompt =
    rankedTasks.length === 0
      ? "There are no open tasks right now. Tell me what to expect when I add one."
      : "Explain why the ranked list is in this order. Anchor on what's driving the top item, then call out one or two near-ties or surprises if you see any. Don't restate every task — focus on what the user can't see at a glance.";
  return streamExplain(rankedTasks, now, prompt, deps);
}

export function streamAskAITask(
  rankedTasks: Task[],
  taskId: number,
  now: Date,
  deps: ExplainDeps = {}
): AsyncGenerator<string> {
  const target = rankedTasks.find((t) => t.id === taskId);
  if (!target) {
    return emptyGenerator("That task is not in the active list anymore.");
  }
  const prompt = `Help me think about this specific task: "${target.title}" (id ${target.id}, rank ${rankedTasks.indexOf(target) + 1} of ${rankedTasks.length}). What should I know about where it sits in the priority list? Is there a better time to do it, or is anything competing with it?`;
  return streamExplain(rankedTasks, now, prompt, deps);
}

async function* emptyGenerator(text: string): AsyncGenerator<string> {
  yield text;
}
