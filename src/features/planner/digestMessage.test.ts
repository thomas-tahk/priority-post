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
    const text = formatEveningDigest(empty, []);

    expect(text).toContain("No open tasks");
  });

  it("names the project a factory item belongs to, without the owner", () => {
    const text = formatEveningDigest(empty, [factoryItem()]);

    expect(text).toContain("The build is failing on main");
    expect(text).toContain("knowflow");
    expect(text).not.toContain("thomas-tahk/");
  });

  it("leaves the factory out entirely when it needs nothing", () => {
    const text = formatEveningDigest(empty, []);

    expect(text).not.toContain("factory");
  });

  it("puts your own work before the factory's", () => {
    const withTask = { top: [{ title: "Renew registration", startAt: null }], overdueTasks: [], idleGoals: [] } as never;

    const text = formatEveningDigest(withTask, [factoryItem()]);

    expect(text.indexOf("Renew registration")).toBeLessThan(text.indexOf("The build is failing"));
  });
});
