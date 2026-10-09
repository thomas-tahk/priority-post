import { describe, it, expect } from "vitest";
import type { Task } from "@/db/schema";
import { weeklyHistory, weekLabel, daysOpen, shortDate } from "./history";

const TZ = "America/Denver";
// Friday Oct 9 2026, midday in Denver. Its week starts Monday Oct 5.
const NOW = new Date("2026-10-09T18:00:00Z");

function done(id: number, doneAt: string, createdAt = "2026-09-01T18:00:00Z"): Task {
  return { id, doneAt: new Date(doneAt), createdAt: new Date(createdAt) } as unknown as Task;
}

describe("weeklyHistory", () => {
  it("returns twelve empty weeks when nothing is done, this week first", () => {
    const weeks = weeklyHistory([], NOW, TZ);

    expect(weeks).toHaveLength(12);
    expect(weeks[0]!.startKey).toBe("2026-10-05");
    expect(weeks[1]!.startKey).toBe("2026-09-28");
    expect(weeks.every((w) => w.tasks.length === 0)).toBe(true);
  });

  it("buckets a task by its Denver day, not its UTC day", () => {
    // Sunday Oct 4, 8pm in Denver = Monday Oct 5 02:00 UTC. Belongs to last week.
    const weeks = weeklyHistory([done(1, "2026-10-05T02:00:00Z")], NOW, TZ);

    expect(weeks[0]!.tasks).toHaveLength(0);
    expect(weeks[1]!.tasks.map((t) => t.id)).toEqual([1]);
  });

  it("orders tasks inside a week newest first", () => {
    const tasks = [done(1, "2026-10-06T18:00:00Z"), done(2, "2026-10-08T18:00:00Z")];

    const weeks = weeklyHistory(tasks, NOW, TZ);

    expect(weeks[0]!.tasks.map((t) => t.id)).toEqual([2, 1]);
  });

  it("reaches back past twelve weeks to the oldest done task", () => {
    const weeks = weeklyHistory([done(1, "2026-06-10T18:00:00Z")], NOW, TZ);

    expect(weeks.at(-1)!.tasks.map((t) => t.id)).toEqual([1]);
    expect(weeks.at(-1)!.startKey).toBe("2026-06-08");
    expect(weeks).toHaveLength(18);
  });

  it("keeps a week whole across the November DST change", () => {
    // Week of Nov 2 2026 (DST ends Nov 1). Monday early and Sunday late both land in it.
    const now = new Date("2026-11-08T23:00:00Z");
    const tasks = [done(1, "2026-11-02T08:00:00Z"), done(2, "2026-11-09T05:00:00Z")];

    const weeks = weeklyHistory(tasks, now, TZ);

    expect(weeks[0]!.startKey).toBe("2026-11-02");
    expect(weeks[0]!.tasks.map((t) => t.id).sort()).toEqual([1, 2]);
  });

  it("puts a task done later than now (clock skew) in this week", () => {
    const weeks = weeklyHistory([done(1, "2026-10-20T18:00:00Z")], NOW, TZ);

    expect(weeks[0]!.tasks.map((t) => t.id)).toEqual([1]);
  });
});

describe("weekLabel", () => {
  it.each([
    [0, "2026-10-05", "This week"],
    [1, "2026-09-28", "Last week"],
    [2, "2026-09-21", "Sep 21 – 27"],
    [3, "2026-09-28", "Sep 28 – Oct 4"],
  ])("week %i starting %s reads %s", (index, startKey, expected) => {
    expect(weekLabel(index, startKey)).toBe(expected);
  });
});

describe("daysOpen", () => {
  it("counts calendar days from created to done in the app zone", () => {
    expect(daysOpen(done(1, "2026-10-05T02:00:00Z", "2026-10-01T18:00:00Z"), TZ)).toBe(3);
  });

  it("is zero for a task closed the day it was made", () => {
    expect(daysOpen(done(1, "2026-10-01T20:00:00Z", "2026-10-01T15:00:00Z"), TZ)).toBe(0);
  });
});

describe("shortDate", () => {
  it("formats the day as read in the app zone", () => {
    expect(shortDate(new Date("2026-10-05T02:00:00Z"), TZ)).toBe("Oct 4");
  });
});
