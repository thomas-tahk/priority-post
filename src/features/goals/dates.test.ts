import { describe, it, expect } from "vitest";
import { startedAgo } from "./dates";

const now = new Date("2026-06-01T12:00:00Z");

describe("startedAgo", () => {
  it("returns 'today' for the same day", () => {
    expect(startedAgo(new Date("2026-06-01T08:00:00Z"), now)).toBe("today");
  });
  it("returns days for under a week", () => {
    expect(startedAgo(new Date("2026-05-29T12:00:00Z"), now)).toBe("3 days ago");
  });
  it("returns weeks for under a month", () => {
    expect(startedAgo(new Date("2026-05-11T12:00:00Z"), now)).toBe("3 weeks ago");
  });
  it("returns months beyond that", () => {
    expect(startedAgo(new Date("2026-03-01T12:00:00Z"), now)).toBe("3 months ago");
  });
  it("singularizes 1", () => {
    expect(startedAgo(new Date("2026-05-31T12:00:00Z"), now)).toBe("1 day ago");
  });
});
