import { describe, it, expect } from "vitest";
import { openCountByGoal, goalStats } from "./counts";

describe("openCountByGoal", () => {
  it("counts open tasks per goal id, ignoring null goals", () => {
    const tasks = [
      { goalId: 1, doneAt: null },
      { goalId: 1, doneAt: null },
      { goalId: 2, doneAt: null },
      { goalId: null, doneAt: null },
    ];
    expect(openCountByGoal(tasks)).toEqual({ 1: 2, 2: 1 });
  });

  it("returns an empty object when there are no goal-assigned tasks", () => {
    expect(openCountByGoal([{ goalId: null, doneAt: null }])).toEqual({});
  });
});

describe("goalStats", () => {
  it("returns total and done counts for a task list", () => {
    const tasks = [
      { doneAt: new Date() },
      { doneAt: null },
      { doneAt: null },
    ];
    expect(goalStats(tasks)).toEqual({ total: 3, done: 1 });
  });

  it("handles an empty list", () => {
    expect(goalStats([])).toEqual({ total: 0, done: 0 });
  });
});
