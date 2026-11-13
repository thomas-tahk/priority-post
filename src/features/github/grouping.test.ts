import { describe, expect, it } from "vitest";
import { groupByRepo, isStale, needsYou, timeAgo, type TrackedItem } from "./grouping";

function item(over: Partial<TrackedItem>): TrackedItem {
  return {
    repo: "a",
    number: 1,
    title: "t",
    url: "https://github.com/x/a/issues/1",
    isPr: false,
    isDraft: false,
    labels: [],
    updatedAt: "2026-11-13T00:00:00Z",
    ...over,
  };
}

describe("groupByRepo", () => {
  it("orders repos and items by most recent update", () => {
    const items = [
      item({ repo: "old", number: 1, updatedAt: "2026-11-01T00:00:00Z" }),
      item({ repo: "new", number: 2, updatedAt: "2026-11-10T00:00:00Z" }),
      item({ repo: "new", number: 3, updatedAt: "2026-11-12T00:00:00Z" }),
    ];

    const groups = groupByRepo(items);

    expect(groups.map((g) => g.repo)).toEqual(["new", "old"]);
    expect(groups[0].items.map((i) => i.number)).toEqual([3, 2]);
  });
});

describe("needsYou / isStale / timeAgo", () => {
  const now = new Date("2026-11-13T12:00:00Z");

  it("detects the needs-you label", () => {
    expect(needsYou(item({ labels: [{ name: "needs-you", color: "D93F0B" }] }))).toBe(true);
    expect(needsYou(item({}))).toBe(false);
  });

  it("flags items untouched for over 7 days", () => {
    expect(isStale(item({ updatedAt: "2026-11-01T00:00:00Z" }), now)).toBe(true);
    expect(isStale(item({ updatedAt: "2026-11-12T00:00:00Z" }), now)).toBe(false);
  });

  it("formats age in m/h/d", () => {
    expect(timeAgo("2026-11-13T11:30:00Z", now)).toBe("30m ago");
    expect(timeAgo("2026-11-13T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo("2026-11-10T12:00:00Z", now)).toBe("3d ago");
  });
});
