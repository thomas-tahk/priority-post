import { describe, it, expect } from "vitest";
import { formatEveningDigest } from "./digestMessage";

const empty = { top: [], overdueTasks: [], idleGoals: [] } as never;

describe("the evening message", () => {
  it("says there is nothing rather than sending a blank list", () => {
    const text = formatEveningDigest({ digest: empty });

    expect(text).toContain("No open tasks");
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

  it("leaves out a track that has nothing to report", () => {
    const text = formatEveningDigest({
      digest: empty,
      objectives: {
        gates: [],
        tracks: [
          { id: 1, name: "CS, SWE competency", milestone: null, weekly: null },
          { id: 2, name: "Applications", milestone: null, weekly: { done: 0, target: 5 } },
        ],
      },
    });
    expect(text).toContain("• Applications — **0 of 5** this week");
    expect(text).not.toContain("CS, SWE competency");
  });

  it("drops the whole section when no track has anything to report", () => {
    const text = formatEveningDigest({
      digest: empty,
      objectives: {
        gates: [],
        tracks: [{ id: 1, name: "CS, SWE competency", milestone: null, weekly: null }],
      },
    });
    expect(text).not.toContain("This week");
  });

  it("says nothing about objectives when there are none", () => {
    const text = formatEveningDigest({ digest: empty, objectives: { gates: [], tracks: [] } });
    expect(text).not.toContain("Dates you did not set");
    expect(text).not.toContain("This week");
  });
});

describe("what the assistant did", () => {
  const entry = (summary: string, actor = "lead") => ({ actor, summary });

  it("lists each entry with who did it", () => {
    const text = formatEveningDigest({ digest: empty, activity: [entry("Read your 5 goals.")] });

    expect(text).toContain("What the assistant did");
    expect(text).toContain("Read your 5 goals.");
    expect(text).toContain("lead");
  });

  it("leaves the section out when the assistant did nothing", () => {
    const text = formatEveningDigest({ digest: empty, activity: [] });

    expect(text).not.toContain("What the assistant did");
  });

  it("puts the assistant after your own work", () => {
    const withTask = { top: [{ title: "Renew registration", startAt: null }], overdueTasks: [], idleGoals: [] } as never;

    const text = formatEveningDigest({
      digest: withTask,
      activity: [entry("Read your 5 goals.")],
    });

    expect(text.indexOf("Renew registration")).toBeLessThan(text.indexOf("Read your 5 goals."));
  });
});
