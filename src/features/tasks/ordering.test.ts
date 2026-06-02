import { describe, it, expect } from "vitest";
import { midpoint, orderOpenTasks, positionAfter, positionBefore } from "./ordering";

describe("midpoint", () => {
  it("averages two positions", () => {
    expect(midpoint(2, 4)).toBe(3);
  });
  it("goes after when only prev is given", () => {
    expect(midpoint(5, null)).toBe(6);
  });
  it("goes before when only next is given", () => {
    expect(midpoint(null, 5)).toBe(4);
  });
  it("returns 0 for an empty list (no neighbors)", () => {
    expect(midpoint(null, null)).toBe(0);
  });
});

function mk(id: number, opts: Partial<{ urgency: number; importance: number; position: number | null }> = {}) {
  return {
    id,
    urgency: opts.urgency ?? 50,
    importance: opts.importance ?? 50,
    focus: null,
    startAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    position: opts.position ?? null,
  };
}

const NOW = new Date("2026-06-02T12:00:00Z");

describe("positionAfter", () => {
  it("drops at top (below the smallest) when prev is null", () => {
    expect(positionAfter(null, [0, 1, 2])).toBe(-1);
  });
  it("returns 0 for an empty list", () => {
    expect(positionAfter(null, [])).toBe(0);
  });
  it("inserts between prev and the next occupied position", () => {
    expect(positionAfter(1, [0, 1, 3])).toBe(2);
  });
  it("goes past the end when prev is the max", () => {
    expect(positionAfter(2, [0, 1, 2])).toBe(3);
  });
});

describe("positionBefore", () => {
  it("drops at bottom (above the largest) when next is null", () => {
    expect(positionBefore(null, [0, 1, 2])).toBe(3);
  });
  it("returns 0 for an empty list", () => {
    expect(positionBefore(null, [])).toBe(0);
  });
  it("inserts between next and the previous occupied position", () => {
    expect(positionBefore(2, [0, 2, 3])).toBe(1);
  });
  it("goes below the start when next is the min", () => {
    expect(positionBefore(0, [0, 1, 2])).toBe(-1);
  });
});

describe("orderOpenTasks", () => {
  it("falls back to score order when nothing is positioned", () => {
    const a = mk(1, { urgency: 90 });
    const b = mk(2, { urgency: 10 });
    expect(orderOpenTasks([b, a], NOW).map((t) => t.id)).toEqual([1, 2]);
  });

  it("orders positioned tasks by position, ascending", () => {
    const a = mk(1, { position: 2 });
    const b = mk(2, { position: 1 });
    expect(orderOpenTasks([a, b], NOW).map((t) => t.id)).toEqual([2, 1]);
  });

  it("puts positioned tasks before unpositioned ones", () => {
    const positioned = mk(1, { position: 5, urgency: 1 });
    const unpositioned = mk(2, { urgency: 99 });
    expect(orderOpenTasks([unpositioned, positioned], NOW).map((t) => t.id)).toEqual([1, 2]);
  });
});
