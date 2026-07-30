import { describe, it, expect } from "vitest";
import { isWithinActiveHours } from "./quiet.js";

const DENVER = "America/Denver"; // UTC-6 in July (MDT)

describe("isWithinActiveHours — evening window 16:00-22:00", () => {
  const cases: [string, string, boolean][] = [
    ["well inside the window", "2026-07-20T18:00:00-06:00", true],
    ["one minute before it opens", "2026-07-20T15:59:00-06:00", false],
    ["exactly at the start (inclusive)", "2026-07-20T16:00:00-06:00", true],
    ["one minute before it closes", "2026-07-20T21:59:00-06:00", true],
    ["exactly at the end (exclusive)", "2026-07-20T22:00:00-06:00", false],
    ["mid-workday", "2026-07-20T10:30:00-06:00", false],
    ["after midnight", "2026-07-21T01:00:00-06:00", false],
  ];

  for (const [name, iso, expected] of cases) {
    it(name, () => {
      expect(isWithinActiveHours(new Date(iso), 16, 22, DENVER)).toBe(expected);
    });
  }
});

describe("isWithinActiveHours — timezone is what decides", () => {
  it("reads the same instant differently in two zones", () => {
    const instant = new Date("2026-07-21T00:00:00Z"); // 18:00 in Denver, 00:00 in UTC
    expect(isWithinActiveHours(instant, 16, 22, DENVER)).toBe(true);
    expect(isWithinActiveHours(instant, 16, 22, "UTC")).toBe(false);
  });
});

describe("isWithinActiveHours — window that wraps midnight (22:00-06:00)", () => {
  const cases: [string, string, boolean][] = [
    ["late evening, after the start", "2026-07-20T23:00:00-06:00", true],
    ["exactly at the start", "2026-07-20T22:00:00-06:00", true],
    ["small hours, before the end", "2026-07-21T02:00:00-06:00", true],
    ["exactly at the end (exclusive)", "2026-07-21T06:00:00-06:00", false],
    ["midday, squarely outside", "2026-07-21T12:00:00-06:00", false],
    ["one minute before the start", "2026-07-20T21:59:00-06:00", false],
  ];

  for (const [name, iso, expected] of cases) {
    it(name, () => {
      expect(isWithinActiveHours(new Date(iso), 22, 6, DENVER)).toBe(expected);
    });
  }
});

describe("isWithinActiveHours — degenerate window", () => {
  // An empty window would silently mute every reminder forever, which is a worse
  // failure than sending one at a bad hour. Equal bounds mean "no quiet hours".
  it("treats start === end as always active", () => {
    expect(isWithinActiveHours(new Date("2026-07-20T03:00:00-06:00"), 16, 16, DENVER)).toBe(true);
    expect(isWithinActiveHours(new Date("2026-07-20T18:00:00-06:00"), 16, 16, DENVER)).toBe(true);
  });
});
