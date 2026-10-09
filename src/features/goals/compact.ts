// A goal as the assistant sees it: the stored fields plus the numbers that
// answer "how is it going" for its shape. Pure — rows in, summary out.
import type { Goal, Task } from "@/db/schema";
import type { CompactGoal } from "@/features/assistant/api";
import { dayKeyIn } from "@/features/planner/clock";
import { openCountByGoal } from "./counts";
import { daysBetween, weeklyCount } from "./objectives";

export function compactGoals(goals: Goal[], tasks: Task[], now: Date, timezone: string): CompactGoal[] {
  const open = openCountByGoal(tasks);
  const todayKey = dayKeyIn(now, timezone);
  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    color: g.color,
    kind: g.kind,
    targetDate: g.targetDate,
    weeklyTarget: g.weeklyTarget,
    milestone: g.milestone,
    openTasks: open[g.id] ?? 0,
    daysLeft: g.targetDate === null ? null : daysBetween(todayKey, g.targetDate),
    weekDone: g.weeklyTarget === null ? null : weeklyCount(g.id, tasks, now, timezone),
  }));
}
