import { describe, it, expect } from "vitest";
import type { Goal, Task } from "@/db/schema";
import {
  daysBetween,
  weekStartKey,
  weeklyCount,
  gates,
  tracks,
  interrupting,
  missedWeekly,
} from "./objectives";

const TZ = "America/Denver";

function goal(over: Partial<Goal> & { id: number; name: string }): Goal {
  return {
    description: null,
    color: "teal",
    kind: "track",
    targetDate: null,
    weeklyTarget: null,
    milestone: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...over,
  } as Goal;
}

function done(goalId: number, doneAt: string): Task {
  return { id: Math.random(), goalId, doneAt: new Date(doneAt) } as unknown as Task;
}

describe("daysBetween", () => {
  it("counts calendar days between two date keys", () => {
    expect(daysBetween("2026-09-21", "2026-09-30")).toBe(9);
  });

  it("is negative once the target is in the past", () => {
    expect(daysBetween("2026-10-01", "2026-09-30")).toBe(-1);
  });

  it("does not lose a day across a DST boundary", () => {
    // US DST ends 2026-11-01; a naive instant diff gives 0.958 days here.
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("weekStartKey", () => {
  it("returns the Monday of the current week", () => {
    // 2026-09-23 is a Wednesday.
    expect(weekStartKey(new Date("2026-09-23T18:00:00Z"), TZ)).toBe("2026-09-21");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    // 2026-09-27 is a Sunday; his week is Monday-Sunday.
    expect(weekStartKey(new Date("2026-09-27T18:00:00Z"), TZ)).toBe("2026-09-21");
  });

  it("reads the day in the app timezone, not the runner's", () => {
    // 2026-09-21T03:00Z is still Sunday the 20th in Denver, so the week that
    // contains it began on the 14th. A UTC runner would say the 21st.
    expect(weekStartKey(new Date("2026-09-21T03:00:00Z"), TZ)).toBe("2026-09-14");
  });
});

describe("weeklyCount", () => {
  const now = new Date("2026-09-25T18:00:00Z"); // Friday

  it("counts this goal's completions since Monday", () => {
    const tasks = [
      done(1, "2026-09-22T17:00:00Z"),
      done(1, "2026-09-24T17:00:00Z"),
      done(2, "2026-09-24T17:00:00Z"),
    ];
    expect(weeklyCount(1, tasks, now, TZ)).toBe(2);
  });

  it("excludes last week's completions", () => {
    expect(weeklyCount(1, [done(1, "2026-09-18T17:00:00Z")], now, TZ)).toBe(0);
  });

  it("ignores open tasks", () => {
    const open = { id: 9, goalId: 1, doneAt: null } as unknown as Task;
    expect(weeklyCount(1, [open], now, TZ)).toBe(0);
  });
});

describe("gates", () => {
  const now = new Date("2026-09-21T18:00:00Z");

  it("returns dated gates soonest first, with days left", () => {
    const list = [
      goal({ id: 1, name: "CAD exam", kind: "gate", targetDate: "2026-10-10" }),
      goal({ id: 2, name: "Coverage ends", kind: "gate", targetDate: "2026-09-30" }),
    ];
    expect(gates(list, now, TZ).map((g) => [g.name, g.daysLeft])).toEqual([
      ["Coverage ends", 9],
      ["CAD exam", 19],
    ]);
  });

  it("drops gates whose date has passed", () => {
    const list = [goal({ id: 1, name: "Old", kind: "gate", targetDate: "2026-09-01" })];
    expect(gates(list, now, TZ)).toEqual([]);
  });

  it("ignores tracks and undated gates", () => {
    const list = [
      goal({ id: 1, name: "pocket-draft" }),
      goal({ id: 2, name: "Undated", kind: "gate" }),
    ];
    expect(gates(list, now, TZ)).toEqual([]);
  });
});

describe("tracks", () => {
  const now = new Date("2026-09-25T18:00:00Z"); // Friday

  it("reports the week so far against a weekly target", () => {
    const list = [goal({ id: 1, name: "Applications", weeklyTarget: 5 })];
    const tasks = [done(1, "2026-09-22T17:00:00Z"), done(1, "2026-09-23T17:00:00Z")];
    expect(tracks(list, tasks, now, TZ)[0].weekly).toEqual({ done: 2, target: 5 });
  });

  it("leaves weekly null for a milestone-only track", () => {
    const list = [goal({ id: 1, name: "PDI build", milestone: "one finished slice" })];
    const [t] = tracks(list, [], now, TZ);
    expect(t.weekly).toBeNull();
    expect(t.milestone).toBe("one finished slice");
  });

  it("excludes gates", () => {
    const list = [goal({ id: 1, name: "CAD exam", kind: "gate", targetDate: "2026-10-10" })];
    expect(tracks(list, [], now, TZ)).toEqual([]);
  });
});

describe("interrupting", () => {
  const now = new Date("2026-09-28T18:00:00Z");

  it("only lets through a hard deadline inside 72 hours", () => {
    const list = [
      goal({ id: 1, name: "Coverage ends", kind: "gate", targetDate: "2026-09-30" }),
      goal({ id: 2, name: "CAD exam", kind: "gate", targetDate: "2026-10-10" }),
    ];
    expect(interrupting(gates(list, now, TZ)).map((g) => g.name)).toEqual(["Coverage ends"]);
  });

  it("never interrupts for a weekly target, however far behind", () => {
    const list = [goal({ id: 1, name: "Applications", weeklyTarget: 5 })];
    // Tracks are not gates, so they cannot reach this path at all.
    expect(interrupting(gates(list, now, TZ))).toEqual([]);
  });
});

describe("missedWeekly", () => {
  const now = new Date("2026-09-27T18:00:00Z"); // Sunday

  it("names tracks under their target", () => {
    const list = [goal({ id: 1, name: "Applications", weeklyTarget: 5 })];
    const t = tracks(list, [done(1, "2026-09-25T17:00:00Z")], now, TZ);
    expect(missedWeekly(t).map((x) => x.weekly)).toEqual([{ done: 1, target: 5 }]);
  });

  it("says nothing when the target is met or beaten", () => {
    const list = [goal({ id: 1, name: "Applications", weeklyTarget: 1 })];
    const t = tracks(list, [done(1, "2026-09-25T17:00:00Z")], now, TZ);
    expect(missedWeekly(t)).toEqual([]);
  });
});
