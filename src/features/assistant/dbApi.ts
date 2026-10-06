// PlannerApi backed by the database directly, for callers that run *inside* the
// web app. HttpPlannerApi exists for the REPL, which is genuinely a separate
// process; the Discord route is not, and making it call its own deployment over
// HTTPS cost a base URL that could be wrong, a secret the app had to present to
// itself, and a round-trip per tool call. It also failed silently: Vercel's
// deployment-protection wall answered `200 text/html`, the JSON client returned
// `undefined`, and the agent reported an empty task list.
//
// These methods mirror /api/internal/* exactly — same helpers, same validation,
// same shapes. Invalid input throws; the agent loop turns that into a tool error.
import type { Goal } from "@/db/schema";
import { buildDigest, buildProgressStats, dueWindow, toCompact } from "@/features/planner/digest";
import { decomposeGoal, summarizeProgress } from "@/features/planner/ai";
import {
  getGoal,
  loadDueSoonState,
  loadTasksAndGoals,
  markReminderSent,
} from "@/features/planner/queries";
import {
  createTask,
  deleteTask,
  setTaskStartAt,
  toggleTaskDone,
  updateTaskTitle,
} from "@/features/tasks/actions";
import { sortByScore } from "@/features/tasks/scorer";
import { assignTaskGoal, createGoal, deleteGoal, updateGoal } from "@/features/goals/actions";
import { compactGoals } from "@/features/goals/compact";
import { checkShape, parseGoalFields } from "@/features/goals/fields";
import { appTimezone } from "@/features/planner/clock";
import type {
  CompactGoal,
  CompactTask,
  Digest,
  DueEvent,
  GoalDisposition,
  GoalInput,
  PlannerApi,
  ProgressResult,
} from "./api";

const MIN_PROGRESS_DAYS = 1;
const MAX_PROGRESS_DAYS = 30;

export class DbPlannerApi implements PlannerApi {
  async listTasks(): Promise<CompactTask[]> {
    const now = new Date();
    const { tasks } = await loadTasksAndGoals();
    const open = tasks.filter((t) => t.doneAt === null);
    return sortByScore(open, now).map((t) => toCompact(t, now));
  }

  async createTask(input: {
    title: string;
    categories?: string[];
    goalId?: number;
    startAt?: string;
  }): Promise<{ id: number }> {
    if (!input.title.trim()) throw new Error("title is required");
    const created = await createTask({
      title: input.title,
      categories: input.categories,
      goalId: input.goalId ?? null,
      startAt: parseDate(input.startAt, "startAt"),
    });
    if (!created) throw new Error("could not create task");
    return { id: created.id };
  }

  async patchTask(
    id: number,
    patch: { done?: boolean; title?: string; startAt?: string | null }
  ): Promise<void> {
    requireTaskId(id);
    if (typeof patch.done === "boolean") await toggleTaskDone(id, patch.done);
    if (patch.title?.trim()) await updateTaskTitle(id, patch.title);
    if ("startAt" in patch) {
      await setTaskStartAt(id, patch.startAt === null ? null : parseDate(patch.startAt, "startAt"));
    }
  }

  async deleteTask(id: number): Promise<void> {
    requireTaskId(id);
    await deleteTask(id);
  }

  async getDigest(): Promise<Digest> {
    const now = new Date();
    const { tasks, goals } = await loadTasksAndGoals();
    return buildDigest(tasks, goals, now);
  }

  async getDueSoon(): Promise<DueEvent[]> {
    const now = new Date();
    const { candidates, sent } = await loadDueSoonState();
    return candidates.flatMap((task) => {
      const kind = dueWindow(task, now);
      if (!kind || sent.has(`${task.id}:${kind}`)) return [];
      return [{ kind, task: toCompact(task, now) }];
    });
  }

  async markReminder(taskId: number, kind: "due_soon" | "overdue"): Promise<void> {
    requireTaskId(taskId);
    await markReminderSent(taskId, kind);
  }

  async decomposeGoal(input: {
    goalId?: number;
    name?: string;
    description?: string;
  }): Promise<string[]> {
    return decomposeGoal(await resolveGoal(input));
  }

  async getProgress(days: number): Promise<ProgressResult> {
    const now = new Date();
    const { tasks, goals } = await loadTasksAndGoals();
    const stats = buildProgressStats(tasks, goals, now, clampDays(days));
    return { summary: await summarizeProgress(stats), stats };
  }

  async listGoals(): Promise<CompactGoal[]> {
    const { tasks, goals } = await loadTasksAndGoals();
    return compactGoals(goals, tasks, new Date(), appTimezone());
  }

  async createGoal(input: GoalInput): Promise<{ id: number }> {
    const fields = parseGoalFields(input);
    if (!fields.name) throw new Error("name is required");
    const kind = fields.kind ?? "track";
    checkShape({ kind, targetDate: fields.targetDate ?? null });
    const created = await createGoal({
      ...fields,
      name: fields.name,
      color: fields.color ?? "other",
      description: fields.description ?? undefined,
      kind,
    });
    if (!created) throw new Error("could not create goal");
    return created;
  }

  async updateGoal(id: number, patch: GoalInput): Promise<void> {
    const goal = await requireGoal(id);
    const fields = parseGoalFields(patch);
    if (Object.keys(fields).length === 0) throw new Error("nothing to update");
    checkShape({
      kind: fields.kind ?? goal.kind,
      targetDate: fields.targetDate !== undefined ? fields.targetDate : goal.targetDate,
    });
    await updateGoal(id, fields);
  }

  async deleteGoal(id: number, disposition: GoalDisposition): Promise<void> {
    await requireGoal(id);
    if (disposition.kind === "reassign") await requireGoal(disposition.targetGoalId);
    await deleteGoal(id, disposition);
  }

  async setTaskGoal(taskId: number, goalId: number | null): Promise<void> {
    requireTaskId(taskId);
    if (goalId !== null) await requireGoal(goalId);
    await assignTaskGoal(taskId, goalId);
  }
}

async function requireGoal(id: number): Promise<Goal> {
  const goal = Number.isInteger(id) && id > 0 ? await getGoal(id) : null;
  if (!goal) throw new Error(`goal ${id} not found — call list_goals for real ids`);
  return goal;
}

/** An existing goal by id, or an unsaved stand-in so "break down 'launch the
 *  newsletter'" works for something that was never a goal row. Mirrors the
 *  /api/internal/goals/decompose route. */
async function resolveGoal(input: {
  goalId?: number;
  name?: string;
  description?: string;
}): Promise<Goal> {
  if (typeof input.goalId === "number") {
    const goal = await getGoal(input.goalId);
    if (!goal) throw new Error(`goal ${input.goalId} not found`);
    return goal;
  }
  const name = input.name?.trim();
  if (!name) throw new Error("goalId or name required");
  return {
    id: -1,
    name,
    description: input.description ?? null,
    color: "other",
    kind: "track",
    targetDate: null,
    weeklyTarget: null,
    milestone: null,
    createdAt: new Date(),
  };
}

function parseDate(raw: string | undefined, field: string): Date | null {
  if (raw === undefined) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw new Error(`invalid ${field}: ${raw}`);
  return new Date(ms);
}

function requireTaskId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error(`bad task id: ${id}`);
}

function clampDays(days: number): number {
  if (!Number.isFinite(days) || days < MIN_PROGRESS_DAYS) return 7;
  return Math.min(Math.round(days), MAX_PROGRESS_DAYS);
}
