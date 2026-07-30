// The fixture world every eval run starts from. Identical on each run so scores
// are comparable, and entirely in memory — nothing here touches Postgres, the
// web app, or the network.
import type Anthropic from "@anthropic-ai/sdk";
import type { CompactTask, Digest, DueEvent, PlannerApi, ProgressResult } from "../src/api.js";
import type { RecordedCall } from "./types.js";

export const TIMEZONE = "America/Denver";

/** Monday, 2026-07-20, 18:00 Mountain. So "friday 3pm" means 2026-07-24T15:00:00-06:00. */
export const FIXED_NOW = new Date("2026-07-20T18:00:00-06:00");

/**
 * The agent infers the owner's UTC offset from `now.toString()` in its system
 * prompt, which renders in the PROCESS timezone — there is no explicit timezone
 * contract. Run the eval in any other zone and every expected datetime is off by
 * the offset difference, producing a pile of failures that look like bad time
 * parsing but are really a misconfigured harness. Fail loudly instead.
 *
 * Returns null when the zone is right, or an explanation when it is not.
 */
export function timezoneMismatch(actualZone: string): string | null {
  if (actualZone === TIMEZONE) return null;
  return (
    `Eval must run in ${TIMEZONE}, but this process resolved to ${actualZone}.\n` +
    `The agent reads the owner's offset from the process clock, so every expected ` +
    `datetime would be scored against the wrong offset.\n` +
    `Re-run with TZ=${TIMEZONE} (the \`pnpm eval\` script already sets it).`
  );
}

type Row = CompactTask & { done: boolean };
type Goal = { id: number; name: string; idleDays: number; idle: boolean };

function row(
  id: number,
  title: string,
  categories: string[],
  over: Partial<CompactTask> = {}
): Row {
  return {
    id,
    title,
    categories,
    urgency: 50,
    importance: 50,
    estTimeMin: 30,
    focus: "medium",
    startAt: null,
    goalId: null,
    score: 0.5,
    done: false,
    ...over,
  };
}

// 12 open tasks across all seven categories. "File taxes" and "File expense report"
// are a deliberate near-collision — the reference cases turn on resolving "the
// taxes thing" to the right one of the two.
function seedTasks(): Row[] {
  return [
    row(1, "File taxes", ["errands"], { urgency: 85, importance: 90, estTimeMin: 120, focus: "high" }),
    row(2, "File expense report", ["work"], { urgency: 60, importance: 40, estTimeMin: 20, focus: "low" }),
    row(3, "Gym session", ["health"], { urgency: 30, importance: 70, estTimeMin: 60, focus: "medium" }),
    row(4, "Call the dentist", ["health"], { urgency: 55, importance: 45, estTimeMin: 10, focus: "low" }),
    row(5, "Review Q3 roadmap", ["work"], {
      urgency: 75,
      importance: 85,
      estTimeMin: 45,
      focus: "high",
      startAt: "2026-07-21T09:00:00-06:00",
    }),
    row(6, "Finish Rust chapter 8", ["learning"], { urgency: 20, importance: 60, estTimeMin: 90, focus: "high", goalId: 3 }),
    row(7, "Deploy the bot to Railway", ["side_project"], { urgency: 70, importance: 75, estTimeMin: 40, focus: "high", goalId: 1 }),
    row(8, "Pick up prescription", ["errands"], {
      urgency: 80,
      importance: 50,
      estTimeMin: 15,
      focus: "low",
      startAt: "2026-07-20T19:00:00-06:00",
    }),
    row(9, "Plan mom's birthday", ["personal"], { urgency: 40, importance: 80, estTimeMin: 30, focus: "medium" }),
    row(10, "Renew car registration", ["other"], {
      urgency: 95,
      importance: 65,
      estTimeMin: 25,
      focus: "low",
      startAt: "2026-07-18T12:00:00-06:00", // overdue as of the fixed clock
    }),
    row(11, "Write newsletter draft", ["side_project"], { urgency: 65, importance: 70, estTimeMin: 60, focus: "high", goalId: 1 }),
    row(12, "Weekly review", ["other"], { urgency: 35, importance: 55, estTimeMin: 20, focus: "medium" }),
  ];
}

function seedGoals(): Goal[] {
  return [
    { id: 1, name: "Launch the newsletter", idleDays: 0, idle: false },
    { id: 2, name: "Get to a 5k", idleDays: 0, idle: false },
    { id: 3, name: "Learn Rust properly", idleDays: 12, idle: true },
  ];
}

function compact({ done, ...t }: Row): CompactTask {
  return t;
}

/**
 * Builds a fresh world. Mutations apply in memory, so multi-turn cases see the
 * effect of turn one — but nothing leaks between cases or between runs.
 */
export function makeWorld(): { api: PlannerApi; tasks: Row[]; goals: Goal[] } {
  const tasks = seedTasks();
  const goals = seedGoals();
  let nextId = 100;

  const open = () => tasks.filter((t) => !t.done);
  const find = (id: number) => tasks.find((t) => t.id === id);

  const api: PlannerApi = {
    async listTasks(): Promise<CompactTask[]> {
      return open().map(compact);
    },

    async createTask(input): Promise<{ id: number }> {
      const id = nextId++;
      tasks.push(
        row(id, input.title, input.categories ?? ["other"], {
          startAt: input.startAt ?? null,
          goalId: input.goalId ?? null,
        })
      );
      return { id };
    },

    async patchTask(id, patch): Promise<void> {
      const t = find(id);
      if (!t) throw new Error(`no task with id ${id}`);
      if (patch.done !== undefined) t.done = patch.done;
      if (patch.title !== undefined) t.title = patch.title;
      if (patch.startAt !== undefined) t.startAt = patch.startAt;
    },

    async deleteTask(id): Promise<void> {
      const i = tasks.findIndex((t) => t.id === id);
      if (i === -1) throw new Error(`no task with id ${id}`);
      tasks.splice(i, 1);
    },

    async getDigest(): Promise<Digest> {
      const live = open();
      const overdue = live.filter((t) => t.startAt !== null && Date.parse(t.startAt) < FIXED_NOW.getTime());
      return {
        top: [...live].sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 3).map(compact),
        overdueTasks: overdue.map(compact),
        idleGoals: goals.filter((g) => g.idle).map((g) => ({ id: g.id, name: g.name, idleDays: g.idleDays })),
      };
    },

    async getDueSoon(): Promise<DueEvent[]> {
      return [];
    },

    async markReminder(): Promise<void> {},

    async decomposeGoal(input): Promise<string[]> {
      const name = input.name ?? goals.find((g) => g.id === input.goalId)?.name ?? "the goal";
      return [`Outline ${name}`, `Draft ${name}`, `Ship ${name}`];
    },

    async getProgress(days: number): Promise<ProgressResult> {
      const live = open();
      return {
        summary: `Steady week — ${live.length} still open.`,
        stats: {
          sinceDays: days,
          completed: tasks.filter((t) => t.done).length,
          created: 0,
          open: live.length,
          overdueOpen: live.filter((t) => t.startAt !== null && Date.parse(t.startAt) < FIXED_NOW.getTime()).length,
          idleGoals: goals.filter((g) => g.idle).length,
        },
      };
    },
  };

  return { api, tasks, goals };
}

/**
 * Extracts what the model actually decided to do, straight from the tool_use
 * blocks in the transcript. Reading the transcript rather than wrapping the API
 * keeps tool names and argument shapes exactly as the model emitted them — no
 * lossy mapping through PlannerApi method names — and still catches a forbidden
 * call whose execution then errored.
 */
export function recordedCallsFrom(messages: Anthropic.MessageParam[]): RecordedCall[] {
  const calls: RecordedCall[] = [];
  for (const message of messages) {
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (typeof block !== "object" || block === null) continue;
      if ((block as { type?: string }).type !== "tool_use") continue;
      const b = block as { name: string; input?: unknown };
      calls.push({
        tool: b.name,
        args: (b.input ?? {}) as Record<string, unknown>,
      });
    }
  }
  return calls;
}
