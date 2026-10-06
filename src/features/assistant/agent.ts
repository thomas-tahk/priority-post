import Anthropic from "@anthropic-ai/sdk";
import type { GoalInput, PlannerApi } from "./api";
import { GOAL_COLORS } from "@/features/goals/colors";
import { parseDisposition } from "@/features/goals/disposition";
import { describeNow, utcOffset } from "./localtime";

export const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;
const MAX_ROUNDS = 5;

const GOAL_FIELDS = {
  name: { type: "string" },
  description: { type: ["string", "null"] },
  color: { type: "string", enum: [...GOAL_COLORS] },
  kind: { type: "string", enum: ["gate", "track"] },
  target_date: { type: ["string", "null"], description: "YYYY-MM-DD." },
  weekly_target: { type: ["integer", "null"], description: "Tasks to finish per Mon–Sun week." },
  milestone: { type: ["string", "null"] },
};

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
  {
    name: "list_goals",
    description: "List every goal with its shape and progress: open task count, days left (gates), tasks done this week vs weekly target (tracks).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_goal",
    description: "Create a goal. kind 'gate' = a dated, pass/fail deadline someone else set (target_date required). kind 'track' (default) = ongoing, measured by weekly_target and/or milestone.",
    input_schema: { type: "object", properties: GOAL_FIELDS, required: ["name"] },
  },
  {
    name: "update_goal",
    description: "Change a goal. Send only the fields to change; null clears description, target_date, weekly_target or milestone.",
    input_schema: { type: "object", properties: { id: { type: "integer" }, ...GOAL_FIELDS }, required: ["id"] },
  },
  {
    name: "delete_goal",
    description: "Permanently delete a goal. Only call AFTER the owner has confirmed AND chosen what happens to its tasks: unassign (keep, no goal), reassign (move to reassign_to goal), or delete (delete them too).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "integer" },
        tasks: { type: "string", enum: ["unassign", "reassign", "delete"] },
        reassign_to: { type: "integer", description: "Goal id that takes the tasks; required when tasks is reassign." },
      },
      required: ["id", "tasks"],
    },
  },
  {
    name: "set_task_goal",
    description: "Put a task under a goal, or pass goal_id null to take it off its goal.",
    input_schema: { type: "object", properties: { task_id: { type: "integer" }, goal_id: { type: ["integer", "null"] } }, required: ["task_id", "goal_id"] },
  },
];

function systemPrompt(now: Date, timezone: string): string {
  const offset = utcOffset(now, timezone);
  return [
    `You are the planner for priority-post, a personal single-user to-do app. It is now ${describeNow(now, timezone)}.`,
    `You manage the owner's real tasks and goals: list, add, reschedule, complete, delete tasks; list, create, edit, delete goals and move tasks between them; break goals into sub-tasks; report progress.`,
    `Act directly when asked, then confirm in one short line (e.g. "✅ added 'call dentist'", "📅 moved taxes to Friday 3pm").`,
    `For deletes: only call delete_task AFTER the owner has clearly confirmed in this conversation; otherwise ask them to confirm first.`,
    `Never invent task ids — call list_tasks or get_digest first if you're unsure which task they mean.`,
    `Goals group tasks. Never invent goal ids either — call list_goals first. Tasks carry a goalId; match it against list_goals to name a task's goal.`,
    `For goal deletes: before calling delete_goal, tell the owner how many open tasks the goal has and ask both to confirm AND what should happen to those tasks — keep them without a goal, move them to another goal, or delete them too. Never pick that choice for them.`,
    `If a tool returns an error, say plainly that you could not reach their tasks and quote the error. Never report a failed tool as an empty or unchanged result — "you have no tasks" must only ever come from a tool that actually succeeded and returned nothing.`,
    // The offset is supplied rather than inferred, and the model is told to
    // write the wall-clock time unconverted. Asking it to convert produced
    // times six hours off: it did the arithmetic AND stamped the offset, so
    // the conversion landed twice.
    `The owner speaks in ${timezone} wall-clock time. Convert "friday 3pm" to ISO 8601 by writing the hour exactly as they said it and appending ${offset} — "friday 3pm" becomes 15:00:00${offset}. Never shift the hour to UTC yourself; the offset does that.`,
    `If a time is ambiguous, choose a sensible default and say what you assumed. Always state times back in the owner's local wall clock, matching what you stored.`,
    // A real misread, 2026-09-27: "add X then mark it complete before end of
    // day" created the task and completed it in the same second. Both readings
    // parse, but only one of them throws away what he told you.
    `A time phrase attached to finishing something — "mark it complete before end of day", "get this done by Friday" — is a DEADLINE for the task, not an instruction to complete it now. Set it as the task's time. Never call complete_task on a task you created in the same turn unless the owner said it is already finished; creating and completing a task in one breath is almost always a misread.`,
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
    case "list_goals":
      return JSON.stringify(await api.listGoals());
    case "add_goal":
      return JSON.stringify(await api.createGoal(goalInput(input)));
    case "update_goal":
      await api.updateGoal(Number(input.id), goalInput(input));
      return JSON.stringify({ ok: true });
    case "delete_goal":
      await api.deleteGoal(Number(input.id), parseDisposition({ kind: input.tasks, targetGoalId: input.reassign_to }));
      return JSON.stringify({ ok: true });
    case "set_task_goal":
      await api.setTaskGoal(Number(input.task_id), input.goal_id === null ? null : Number(input.goal_id));
      return JSON.stringify({ ok: true });
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}

/** Tool input (snake_case) to the API's field names, keeping only the keys the
 *  model sent: an absent key means "leave it", null means "clear it". */
function goalInput(input: Record<string, unknown>): GoalInput {
  const names: Record<string, string> = {
    name: "name",
    description: "description",
    color: "color",
    kind: "kind",
    target_date: "targetDate",
    weekly_target: "weeklyTarget",
    milestone: "milestone",
  };
  const out: GoalInput = {};
  for (const [from, to] of Object.entries(names)) if (from in input) out[to] = input[from];
  return out;
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
  context: { now: Date; timezone: string }
): Promise<{ reply: string; messages: Anthropic.MessageParam[] }> {
  const { now, timezone } = context;
  const messages: Anthropic.MessageParam[] = [...history];
  // A broken tool must never reach the owner as "you have no tasks". The model
  // is told as much, but a prompt is not a guarantee, so unrecovered failures
  // are also appended to the reply by the code.
  const failed = new Set<string>();
  const ran: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(now, timezone),
      tools: TOOLS,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const text = textOf(res.content) || emptyReply(res, ran);
      return { reply: withFailureNotice(text, failed), messages };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>, api);
        failed.delete(block.name); // a retry that worked clears the earlier failure
        ran.push(block.name);
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "tool failed";
        failed.add(block.name);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          // Spelled out because the failure mode we hit was the model reading a
          // broken call as an empty result and cheerfully reporting no tasks.
          content: `TOOL FAILED — this is an error, not data. Do not describe the owner's tasks as empty or unchanged because of it. ${msg}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return {
    reply: withFailureNotice("I got tangled up mid-task — mind trying that again?", failed),
    messages,
  };
}

/** What to say when the model ended its turn without writing anything. Names
 *  the stop reason and the tools that ran, so "nothing happened" can't pass for
 *  "done". Logged too: the block types are the evidence for why it went quiet. */
function emptyReply(res: Anthropic.Message, ran: string[]): string {
  console.error("assistant: empty reply", {
    stop_reason: res.stop_reason,
    blocks: res.content.map((b) => b.type),
    ran,
  });
  const did = ran.length > 0 ? `Ran: ${[...new Set(ran)].join(", ")}.` : "No tools ran — nothing was changed.";
  return `⚠️ The model stopped without replying (stop: ${res.stop_reason}). ${did}`;
}

/** Appends an unmissable note when a tool never succeeded this turn, so a reply
 *  written from missing data cannot read as a confident answer. */
function withFailureNotice(reply: string, failed: Set<string>): string {
  if (failed.size === 0) return reply;
  const names = [...failed].sort().join(", ");
  return `${reply}\n\n⚠️ Couldn't reach your planner data (${names} failed), so this answer may be wrong or incomplete.`;
}
