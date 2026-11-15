import { describe, expect, it } from "vitest";
import { buildNudge } from "./nudge";
import type { TrackedItem } from "./grouping";

const now = new Date("2026-11-15T00:00:00Z");
const NEEDS = [{ name: "needs-you", color: "D93F0B" }];

function item(createdAt: string, labels = NEEDS): TrackedItem {
  return { repo: "a", number: 1, title: "t", url: `u-${createdAt}`, isPr: false, isDraft: false, labels, updatedAt: createdAt, createdAt };
}

describe("buildNudge", () => {
  it("counts needs-you items created in the last 24h against the total", () => {
    const items = [item("2026-11-14T12:00:00Z"), item("2026-11-14T20:00:00Z"), item("2026-11-10T00:00:00Z")];

    const message = buildNudge(items, now);

    expect(message).toBe("🔔 2 new things need you (3 total) → https://priority-post.vercel.app");
  });

  it("stays quiet when nothing new needs you", () => {
    const items = [item("2026-11-10T00:00:00Z"), item("2026-11-14T20:00:00Z", [])];

    expect(buildNudge(items, now)).toBeNull();
  });

  it("uses singular wording for one item", () => {
    expect(buildNudge([item("2026-11-14T20:00:00Z")], now)).toContain("1 new thing needs you (1 total)");
  });
});
