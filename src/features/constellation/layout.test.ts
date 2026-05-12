import { describe, expect, it } from "vitest";
import { lobePositions, packLayout, type ScoredTask } from "./layout";
import type { Task } from "@/db/schema";

function mkScored(overrides: Partial<ScoredTask> & { _score: number; id: number }): ScoredTask {
  const base: Task = {
    id: overrides.id,
    title: overrides.title ?? `task ${overrides.id}`,
    notes: null,
    createdAt: overrides.createdAt ?? new Date("2026-05-11T10:00:00Z"),
    doneAt: null,
    startAt: null,
    categories: overrides.categories ?? ["work"],
    urgency: overrides.urgency ?? null,
    importance: overrides.importance ?? null,
    estTimeMin: overrides.estTimeMin ?? null,
    focus: overrides.focus ?? null,
    pinnedFields: overrides.pinnedFields ?? [],
  };
  return { ...base, _score: overrides._score };
}

const W = 700;
const H = 700;

describe("packLayout", () => {
  it("returns empty for empty input", () => {
    expect(packLayout([], W, H)).toEqual([]);
  });

  it("first item is marked as top", () => {
    const items = packLayout(
      [mkScored({ id: 1, _score: 0.9 }), mkScored({ id: 2, _score: 0.5 })],
      W,
      H
    );
    expect(items[0]!.isTop).toBe(true);
    expect(items[1]!.isTop).toBe(false);
  });

  it("top task gets a meaningful size bonus over a same-score non-top", () => {
    const topOnly = packLayout([mkScored({ id: 1, _score: 0.5 })], W, H);
    const asNonTop = packLayout(
      [mkScored({ id: 0, _score: 0.99 }), mkScored({ id: 1, _score: 0.5 })],
      W,
      H
    );
    const topR = topOnly[0]!.r;
    const nonTopR = asNonTop[1]!.r;
    expect(topR).toBeCloseTo(nonTopR * 1.25, 1);
  });

  it("multi-category bubble has larger visualR than r", () => {
    const items = packLayout(
      [mkScored({ id: 1, _score: 0.6, categories: ["work", "personal"] })],
      W,
      H
    );
    expect(items[0]!.visualR).toBeGreaterThan(items[0]!.r);
  });

  it("single-category bubble has visualR equal to r", () => {
    const items = packLayout(
      [mkScored({ id: 1, _score: 0.6, categories: ["work"] })],
      W,
      H
    );
    expect(items[0]!.visualR).toBe(items[0]!.r);
  });

  it("higher score → larger r", () => {
    // Non-top to isolate the score effect from the top bonus.
    const items = packLayout(
      [
        mkScored({ id: 0, _score: 1.0 }), // top
        mkScored({ id: 1, _score: 0.9 }),
        mkScored({ id: 2, _score: 0.3 }),
      ],
      W,
      H
    );
    expect(items[1]!.r).toBeGreaterThan(items[2]!.r);
  });

  it("packed bubbles do not overlap within the viewport", () => {
    const tasks: ScoredTask[] = Array.from({ length: 8 }).map((_, i) =>
      mkScored({ id: i, _score: 0.9 - i * 0.1 })
    );
    const items = packLayout(tasks, W, H);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        // Bubbles are packed with their visualR (plus a small padding); no
        // pair should be closer than the sum of their radii.
        expect(dist).toBeGreaterThanOrEqual(a.visualR + b.visualR);
      }
    }
  });

  it("is deterministic — same input produces same positions", () => {
    const tasks: ScoredTask[] = [
      mkScored({ id: 1, _score: 0.9 }),
      mkScored({ id: 2, _score: 0.7 }),
      mkScored({ id: 3, _score: 0.5 }),
    ];
    const a = packLayout(tasks, W, H);
    const b = packLayout(tasks, W, H);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.x).toBe(b[i]!.x);
      expect(a[i]!.y).toBe(b[i]!.y);
    }
  });
});

describe("lobePositions", () => {
  it("returns one lobe per category", () => {
    const items = packLayout(
      [
        mkScored({
          id: 1,
          _score: 0.7,
          categories: ["work", "personal", "health"],
        }),
      ],
      W,
      H
    );
    const lobes = lobePositions(items[0]!);
    expect(lobes).toHaveLength(3);
    expect(lobes.map((l) => l.cat)).toEqual(["work", "personal", "health"]);
  });

  it("lobes are positioned around the bubble center", () => {
    const items = packLayout(
      [mkScored({ id: 1, _score: 0.7, categories: ["work", "personal"] })],
      W,
      H
    );
    const item = items[0]!;
    const lobes = lobePositions(item);
    const offset = item.r * 0.42;
    for (const lobe of lobes) {
      const dist = Math.hypot(lobe.x - item.x, lobe.y - item.y);
      expect(dist).toBeCloseTo(offset, 5);
    }
  });
});
