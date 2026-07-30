import { describe, it, expect } from "vitest";
import { formatDigest, formatDueEvent } from "./format.js";
import type { CompactTask } from "./api.js";

function task(over: Partial<CompactTask> = {}): CompactTask {
  return {
    id: 1,
    title: "Write the report",
    categories: ["work"],
    urgency: 60,
    importance: 70,
    estTimeMin: 45,
    focus: "high",
    startAt: null,
    goalId: null,
    score: 0.5,
    ...over,
  };
}

describe("formatDigest", () => {
  it("renders tonight's focus and what slipped", () => {
    const out = formatDigest({
      top: [task({ id: 1, title: "Write the report" })],
      overdueTasks: [task({ id: 2, title: "Pay taxes", startAt: "2026-06-01T10:00:00Z" })],
      idleGoals: [{ id: 3, name: "Launch newsletter", idleDays: 9 }],
    });
    expect(out).toContain("Worth doing tonight");
    expect(out).toContain("Write the report");
    expect(out).toContain("Slipped today");
    expect(out).toContain("Pay taxes");
    expect(out).toContain("Launch newsletter");
    expect(out).toContain("9d");
  });

  it("frames the digest as an evening nudge, not a morning one", () => {
    const out = formatDigest({ top: [task()], overdueTasks: [], idleGoals: [] });
    expect(out).toMatch(/tonight/i);
    expect(out).not.toMatch(/morning/i);
    expect(out).not.toMatch(/here's today/i);
  });

  it("handles an empty list", () => {
    const out = formatDigest({ top: [], overdueTasks: [], idleGoals: [] });
    expect(out).toContain("No open tasks");
  });
});

describe("formatDueEvent", () => {
  it("phrases due_soon and overdue differently", () => {
    const soon = formatDueEvent({ kind: "due_soon", task: task({ startAt: "2026-06-08T13:00:00Z" }) });
    const over = formatDueEvent({ kind: "overdue", task: task({ startAt: "2026-06-08T11:00:00Z" }) });
    expect(soon).toContain("coming up");
    expect(over).toContain("slipped");
  });
});
