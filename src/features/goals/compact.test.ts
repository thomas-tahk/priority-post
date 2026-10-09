import { describe, it, expect } from "vitest";
import type { Goal, Task } from "@/db/schema";
import { compactGoals } from "./compact";

const TZ = "America/Denver";
const NOW = new Date("2026-10-07T18:00:00Z"); // Wednesday

function goal(over: Partial<Goal> & { id: number }): Goal {
  return {
    name: `goal ${over.id}`,
    description: null,
    color: "other",
    kind: "track",
    targetDate: null,
    weeklyTarget: null,
    milestone: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...over,
  } as Goal;
}

function task(goalId: number | null, doneAt: string | null): Task {
  return { id: Math.random(), goalId, doneAt: doneAt ? new Date(doneAt) : null } as unknown as Task;
}

describe("compactGoals", () => {
  it("counts days left on a gate, including a passed one", () => {
    const goals = [goal({ id: 1, kind: "gate", targetDate: "2026-10-10" }), goal({ id: 2, kind: "gate", targetDate: "2026-10-01" })];

    const [soon, passed] = compactGoals(goals, [], NOW, TZ);

    expect(soon.daysLeft).toBe(3);
    expect(passed.daysLeft).toBe(-6);
  });

  it("reports this week's done count only for a track with a weekly target", () => {
    const goals = [goal({ id: 1, weeklyTarget: 3 }), goal({ id: 2, milestone: "first draft" })];
    const tasks = [task(1, "2026-10-06T16:00:00Z"), task(1, "2026-09-30T16:00:00Z")];

    const [weekly, milestone] = compactGoals(goals, tasks, NOW, TZ);

    expect(weekly.weekDone).toBe(1);
    expect(milestone.weekDone).toBeNull();
    expect(milestone.daysLeft).toBeNull();
  });

  it("counts only open tasks per goal", () => {
    const tasks = [task(1, null), task(1, null), task(1, "2026-10-06T16:00:00Z"), task(null, null)];

    const [g] = compactGoals([goal({ id: 1 })], tasks, NOW, TZ);

    expect(g.openTasks).toBe(2);
  });
});
