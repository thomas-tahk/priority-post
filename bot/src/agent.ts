import Anthropic from "@anthropic-ai/sdk";
import type { PlannerApi } from "./api.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const MAX_ROUNDS = 5;

const TOOLS: Anthropic.Tool[] = [
  { name: "list_tasks", description: "List the open tasks, ranked by priority.", input_schema: { type: "object", properties: {} } },
  { name: "get_digest", description: "Today's top focus plus what's slipping (overdue tasks, idle goals). Use for 'what's next', 'plan my day', 'what am I neglecting'.", input_schema: { type: "object", properties: {} } },
  {
    name: "add_task",
    description: "Create a task. Call once per task. start_at is optional ISO 8601 (with timezone offset) for scheduled tasks.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start_at: { type: "string", description: "ISO 8601 datetime with offset, or omit." },
        goal_id: { type: "integer" },
      },
      required: ["title"],
    },
  },
  {
    name: "reschedule_task",
    description: "Set or clear a task's scheduled time. Pass start_at as ISO 8601, or null to unschedule.",
    input_schema: { type: "object", properties: { id: { type: "integer" }, start_at: { type: ["string", "null"] } }, required: ["id", "start_at"] },
  },
  { name: "complete_task", description: "Mark a task done.", input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] } },
  {
    name: "delete_task",
    description: "Permanently delete a task. Only call AFTER the owner explicitly confirms; otherwise ask first.",
    input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
  },
  {
    name: "decompose_goal",
    description: "Propose sub-tasks for a goal (by goal_id, or an ad-hoc name+description). Returns suggestions — nothing is created until you add_task them.",
    input_schema: { type: "object", properties: { goal_id: { type: "integer" }, name: { type: "string" }, description: { type: "string" } } },
  },
  { name: "get_progress", description: "How the owner is doing over the last N days (default 7): a summary plus counts.", input_schema: { type: "object", properties: { days: { type: "integer" } } } },
];

function systemPrompt(now: Date): string {
  return [
    `You are the planner for priority-post, a personal single-user to-do app. The current time is ${now.toISOString()} (${now.toString()}).`,
    `You manage the owner's real tasks: list, add, reschedule, complete, delete, break goals into sub-tasks, and report progress.`,
    `Act directly when asked, then confirm in one short line (e.g. "✅ added 'call dentist'", "📅 moved taxes to Friday 3pm").`,
    `For deletes: only call delete_task AFTER the owner has clearly confirmed in this conversation; otherwise ask them to confirm first.`,
    `Never invent task ids — call list_tasks or get_digest first if you're unsure which task they mean.`,
    `Interpret natural-language times ("friday 3pm", "tomorrow morning") into ISO 8601 with a timezone offset; if ambiguous, choose a sensible default and say what you assumed.`,
    `When you propose sub-tasks, list them and ask if you should add them — don't add until they say yes.`,
    `Keep replies short and Discord-friendly. No big markdown blocks.`,
  ].join("\n");
}

async function runTool(name: string, input: Record<string, unknown>, api: PlannerApi): Promise<string> {
  switch (name) {
    case "list_tasks":
      return JSON.stringify(await api.listTasks());
    case "get_digest":
      return JSON.stringify(await api.getDigest());
    case "add_task": {
      const r = await api.createTask({
        title: String(input.title),
        startAt: typeof input.start_at === "string" ? input.start_at : undefined,
        goalId: typeof input.goal_id === "number" ? input.goal_id : undefined,
      });
      return JSON.stringify(r);
    }
    case "reschedule_task":
      await api.patchTask(Number(input.id), { startAt: input.start_at === null ? null : String(input.start_at) });
      return JSON.stringify({ ok: true });
    case "complete_task":
      await api.patchTask(Number(input.id), { done: true });
      return JSON.stringify({ ok: true });
    case "delete_task":
      await api.deleteTask(Number(input.id));
      return JSON.stringify({ ok: true });
    case "decompose_goal":
      return JSON.stringify({
        proposals: await api.decomposeGoal({
          goalId: typeof input.goal_id === "number" ? input.goal_id : undefined,
          name: typeof input.name === "string" ? input.name : undefined,
          description: typeof input.description === "string" ? input.description : undefined,
        }),
      });
    case "get_progress":
      return JSON.stringify(await api.getProgress(typeof input.days === "number" ? input.days : 7));
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Run one conversational turn. `history` is the running message list (caller has
 * already appended the new user message). Returns the reply text and the updated
 * message list (including assistant + tool turns) so the caller can persist it.
 */
export async function runAgent(
  history: Anthropic.MessageParam[],
  api: PlannerApi,
  anthropic: Anthropic,
  now: Date
): Promise<{ reply: string; messages: Anthropic.MessageParam[] }> {
  const messages: Anthropic.MessageParam[] = [...history];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(now),
      tools: TOOLS,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      return { reply: textOf(res.content) || "(done)", messages };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>, api);
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "tool failed";
        results.push({ type: "tool_result", tool_use_id: block.id, content: msg, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return { reply: "I got tangled up mid-task — mind trying that again?", messages };
}
