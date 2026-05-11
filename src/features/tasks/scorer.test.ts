import { describe, expect, it } from "vitest";
import {
  fitNow,
  importanceNorm,
  score,
  sortByScore,
  timeOfDay,
  urgencyPressure,
  WEIGHTS,
} from "./scorer";

const NOON = new Date("2026-05-11T12:00:00Z");

function mkTask(overrides: Partial<Parameters<typeof score>[0]> = {}) {
  return {
    urgency: null,
    importance: null,
    focus: null,
    startAt: null,
    createdAt: new Date("2026-05-01T10:00:00Z"),
    ...overrides,
  };
}

describe("timeOfDay", () => {
  // Test in local time terms since the function reads getHours() (local).
  const cases: [number, ReturnType<typeof timeOfDay>][] = [
    [6, "morning"],
    [11, "midday"],
    [14, "afternoon"],
    [18, "evening"],
    [22, "night"],
    [2, "night"],
  ];
  for (const [hour, expected] of cases) {
    it(`hour ${hour} → ${expected}`, () => {
      const d = new Date();
      d.setHours(hour, 0, 0, 0);
      expect(timeOfDay(d)).toBe(expected);
    });
  }
});

describe("urgencyPressure", () => {
  it("uses default when urgency null and no startAt", () => {
    expect(urgencyPressure(NOON, null, null)).toBeCloseTo(0.3, 2);
  });

  it("normalizes urgency to 0..1", () => {
    expect(urgencyPressure(NOON, 100, null)).toBe(1);
    expect(urgencyPressure(NOON, 0, null)).toBe(0);
    expect(urgencyPressure(NOON, 50, null)).toBeCloseTo(0.5, 2);
  });

  it("overdue startAt forces 1.0", () => {
    const past = new Date(NOON.getTime() - 60 * 60 * 1000);
    expect(urgencyPressure(NOON, 10, past)).toBe(1);
  });

  it("scheduled in 2 hours boosts above urgency base", () => {
    const soon = new Date(NOON.getTime() + 2 * 60 * 60 * 1000);
    const v = urgencyPressure(NOON, 10, soon);
    expect(v).toBeGreaterThan(0.1);
    expect(v).toBeGreaterThanOrEqual(0.9); // 1 - 2/30
  });

  it("scheduled in 3 days uses gentle decay, still above tiny urgency", () => {
    const later = new Date(NOON.getTime() + 72 * 60 * 60 * 1000);
    const v = urgencyPressure(NOON, 5, later);
    expect(v).toBeGreaterThan(0.05);
    expect(v).toBeLessThan(0.5);
  });

  it("scheduled in 2 weeks falls back to urgency base", () => {
    const far = new Date(NOON.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(urgencyPressure(NOON, 20, far)).toBeCloseTo(0.2, 2);
  });
});

describe("importanceNorm", () => {
  it("defaults to 0.4 when null", () => {
    expect(importanceNorm(null)).toBeCloseTo(0.4, 2);
  });
  it("normalizes to 0..1", () => {
    expect(importanceNorm(0)).toBe(0);
    expect(importanceNorm(100)).toBe(1);
    expect(importanceNorm(75)).toBeCloseTo(0.75, 2);
  });
});

describe("fitNow", () => {
  it("returns neutral 0.5 when focus is null", () => {
    expect(fitNow(null, NOON)).toBe(0.5);
  });

  it("morning rewards high focus, penalizes low", () => {
    const morn = new Date();
    morn.setHours(8, 0, 0, 0);
    expect(fitNow("high", morn)).toBeGreaterThan(fitNow("low", morn));
  });

  it("evening rewards low focus, penalizes high", () => {
    const eve = new Date();
    eve.setHours(20, 0, 0, 0);
    expect(fitNow("low", eve)).toBeGreaterThan(fitNow("high", eve));
  });
});

describe("score composition", () => {
  it("weights sum to 1", () => {
    expect(WEIGHTS.urgency + WEIGHTS.importance + WEIGHTS.fit).toBeCloseTo(1, 5);
  });

  it("all-defaults task gets a non-zero score", () => {
    const s = score(mkTask(), NOON);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it("overdue + high importance + high focus at morning = near max", () => {
    const morn = new Date();
    morn.setHours(8, 0, 0, 0);
    const past = new Date(morn.getTime() - 60 * 60 * 1000);
    const s = score(
      mkTask({ urgency: 100, importance: 100, focus: "high", startAt: past }),
      morn
    );
    // Max possible = 0.5*1 + 0.35*1 + 0.15*1 = 1.0
    expect(s).toBeCloseTo(1.0, 2);
  });
});

describe("sortByScore", () => {
  it("higher-score tasks come first", () => {
    const high = mkTask({ urgency: 90, importance: 90 });
    const low = mkTask({ urgency: 10, importance: 10 });
    const sorted = sortByScore([low, high], NOON);
    expect(sorted[0]).toBe(high);
    expect(sorted[1]).toBe(low);
  });

  it("ties broken by older createdAt first", () => {
    const older = mkTask({ createdAt: new Date("2026-01-01") });
    const newer = mkTask({ createdAt: new Date("2026-04-01") });
    const sorted = sortByScore([newer, older], NOON);
    expect(sorted[0]).toBe(older);
    expect(sorted[1]).toBe(newer);
  });

  it("does not mutate input array", () => {
    const a = mkTask({ urgency: 10 });
    const b = mkTask({ urgency: 90 });
    const input = [a, b];
    sortByScore(input, NOON);
    expect(input[0]).toBe(a);
    expect(input[1]).toBe(b);
  });
});
