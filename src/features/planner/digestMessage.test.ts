import { describe, it, expect } from "vitest";
import { formatEveningDigest } from "./digestMessage";
import type { FoundryItem } from "@/features/foundry/types";

const empty = { top: [], overdueTasks: [], idleGoals: [] } as never;

function factoryItem(over: Partial<FoundryItem> = {}): FoundryItem {
  return {
    id: "a", repo: "thomas-tahk/knowflow", summary: "The build is failing on main",
    detail: "", state: "build_failing", url: "u", since: "2026-09-01T00:00:00Z",
    actions: [], ...over,
  };
}

describe("the evening message", () => {
  it("says there is nothing rather than sending a blank list", () => {
    const text = formatEveningDigest({ digest: empty });

    expect(text).toContain("No open tasks");
  });

  it("names the project a factory item belongs to, without the owner", () => {
    const text = formatEveningDigest({ digest: empty, factory: [factoryItem()] });

    expect(text).toContain("The build is failing on main");
    expect(text).toContain("knowflow");
    expect(text).not.toContain("thomas-tahk/");
  });

  it("leaves the factory out entirely when it needs nothing", () => {
    const text = formatEveningDigest({ digest: empty });

    expect(text).not.toContain("factory");
  });

  it("puts your own work before the factory's", () => {
    const withTask = { top: [{ title: "Renew registration", startAt: null }], overdueTasks: [], idleGoals: [] } as never;

    const text = formatEveningDigest({ digest: withTask, factory: [factoryItem()] });

    expect(text.indexOf("Renew registration")).toBeLessThan(text.indexOf("The build is failing"));
  });
});

describe("objectives in the digest", () => {
  const empty = { top: [], overdueTasks: [], idleGoals: [] };

  it("leads with dated gates, soonest first", () => {
    const text = formatEveningDigest({
      digest: empty,
      objectives: {
        gates: [
          { id: 1, name: "Coverage ends", targetDate: "2026-09-30", daysLeft: 1 },
          { id: 2, name: "CAD exam", targetDate: "2026-10-10", daysLeft: 19 },
        ],
        tracks: [],
      },
    });
    expect(text).toContain("Dates you did not set");
    expect(text).toContain("• Coverage ends — **tomorrow**");
    expect(text).toContain("• CAD exam — in **19 days**");
    expect(text.indexOf("Coverage ends")).toBeLessThan(text.indexOf("No open tasks"));
  });

  it("reports a weekly count without dressing it up", () => {
    const text = formatEveningDigest({
      digest: empty,
      objectives: {
        gates: [],
        tracks: [{ id: 1, name: "Applications", milestone: null, weekly: { done: 2, target: 5 } }],
      },
    });
    expect(text).toContain("• Applications — **2 of 5** this week");
    expect(text).not.toMatch(/streak|keep it up|!/i);
  });

  it("shows a milestone-only track without a count", () => {
    const text = formatEveningDigest({
      digest: empty,
      objectives: {
        gates: [],
        tracks: [{ id: 1, name: "PDI build", milestone: "one finished slice", weekly: null }],
      },
    });
    expect(text).toContain("• PDI build — one finished slice");
  });

  it("says nothing about objectives when there are none", () => {
    const text = formatEveningDigest({ digest: empty, objectives: { gates: [], tracks: [] } });
    expect(text).not.toContain("Dates you did not set");
    expect(text).not.toContain("This week");
  });
});
