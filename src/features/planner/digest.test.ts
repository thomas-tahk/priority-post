import { describe, expect, it } from "vitest";
import type { Task, Goal } from "@/db/schema";
import {
  buildDigest,
  buildProgressStats,
  dueWindow,
  idleGoals,
} from "./digest";

const NOW = new Date("2026-06-08T12:00:00Z");
const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

function mkTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "task",
    notes: null,
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    doneAt: null,
    startAt: null,
    categories: ["other"],
    urgency: 50,
    importance: 50,
    estTimeMin: 30,
    focus: "medium",
    pinnedFields: [],
    goalId: null,
    position: null,
    ...overrides,
  };
}

function mkGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1,
    name: "goal",
    description: null,
    color: "work",
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    ...overrides,
  };
}

describe("dueWindow", () => {
  it("returns due_soon within the next 2h", () => {
    expect(dueWindow(mkTask({ startAt: new Date(NOW.getTime() + HOUR) }), NOW)).toBe("due_soon");
  });
  it("returns null more than 2h out", () => {
    expect(dueWindow(mkTask({ startAt: new Date(NOW.getTime() + 3 * HOUR) }), NOW)).toBeNull();
  });
  it("returns overdue within the 24h grace period", () => {
    expect(dueWindow(mkTask({ startAt: new Date(NOW.getTime() - 2 * HOUR) }), NOW)).toBe("overdue");
  });
  it("returns null once past the grace period", () => {
    expect(dueWindow(mkTask({ startAt: new Date(NOW.getTime() - 30 * HOUR) }), NOW)).toBeNull();
  });
  it("ignores tasks with no start_at", () => {
    expect(dueWindow(mkTask({ startAt: null }), NOW)).toBeNull();
  });
  it("ignores done tasks", () => {
    expect(
      dueWindow(mkTask({ startAt: new Date(NOW.getTime() + HOUR), doneAt: NOW }), NOW)
    ).toBeNull();
  });
});

describe("buildDigest", () => {
  it("returns the top 3 open tasks by score, excluding done", () => {
    const tasks = [
      mkTask({ id: 1, importance: 90, urgency: 90 }),
      mkTask({ id: 2, importance: 10, urgency: 10 }),
      mkTask({ id: 3, importance: 50, urgency: 50 }),
      mkTask({ id: 4, importance: 99, urgency: 99, doneAt: NOW }),
    ];
    const { top } = buildDigest(tasks, [], NOW);
    expect(top.map((t) => t.id)).toEqual([1, 3, 2]);
  });

  it("flags tasks overdue by 1+ day as slipping", () => {
    const tasks = [
      mkTask({ id: 1, startAt: new Date(NOW.getTime() - 2 * DAY) }),
      mkTask({ id: 2, startAt: new Date(NOW.getTime() - 2 * HOUR) }), // overdue but <1d
    ];
    const { overdueTasks } = buildDigest(tasks, [], NOW);
    expect(overdueTasks.map((t) => t.id)).toEqual([1]);
  });
});

describe("idleGoals", () => {
  it("flags an old goal with open tasks and no recent completion", () => {
    const goal = mkGoal({ id: 7, createdAt: new Date(NOW.getTime() - 20 * DAY) });
    const tasks = [mkTask({ id: 1, goalId: 7 })];
    expect(idleGoals(tasks, [goal], NOW).map((g) => g.id)).toEqual([7]);
  });

  it("does not flag a fresh goal", () => {
    const goal = mkGoal({ id: 7, createdAt: new Date(NOW.getTime() - 2 * DAY) });
    const tasks = [mkTask({ id: 1, goalId: 7 })];
    expect(idleGoals(tasks, [goal], NOW)).toEqual([]);
  });

  it("does not flag a goal with a recent completion", () => {
    const goal = mkGoal({ id: 7, createdAt: new Date(NOW.getTime() - 20 * DAY) });
    const tasks = [
      mkTask({ id: 1, goalId: 7 }),
      mkTask({ id: 2, goalId: 7, doneAt: new Date(NOW.getTime() - 1 * DAY) }),
    ];
    expect(idleGoals(tasks, [goal], NOW)).toEqual([]);
  });

  it("does not flag a goal with no open tasks", () => {
    const goal = mkGoal({ id: 7, createdAt: new Date(NOW.getTime() - 20 * DAY) });
    const tasks = [mkTask({ id: 1, goalId: 7, doneAt: new Date(NOW.getTime() - 10 * DAY) })];
    expect(idleGoals(tasks, [goal], NOW)).toEqual([]);
  });
});

describe("buildProgressStats", () => {
  it("counts completed, created, open, and overdue within the window", () => {
    const tasks = [
      mkTask({ id: 1, doneAt: new Date(NOW.getTime() - 2 * DAY) }), // completed in window
      mkTask({ id: 2, doneAt: new Date(NOW.getTime() - 10 * DAY) }), // completed before window
      mkTask({ id: 3, createdAt: new Date(NOW.getTime() - 1 * DAY) }), // created in window, open
      mkTask({ id: 4, startAt: new Date(NOW.getTime() - 5 * HOUR) }), // open + overdue
    ];
    const stats = buildProgressStats(tasks, [], NOW, 7);
    expect(stats).toMatchObject({ completed: 1, created: 1, open: 2, overdueOpen: 1 });
  });
});
