import { describe, expect, it } from "vitest";
import {
  PADDING,
  MAX_R,
  MIN_R,
  placeOnMap,
  radiusFromEstTime,
  type ScoredTask,
} from "./layout";
import type { Task } from "@/db/schema";

function mkScored(overrides: Partial<ScoredTask> & { _score: number; id: number }): ScoredTask {
  const base: Task = {
    id: overrides.id,
    title: overrides.title ?? `task ${overrides.id}`,
    notes: null,
    createdAt: overrides.createdAt ?? new Date("2026-05-12T10:00:00Z"),
    doneAt: null,
    startAt: null,
    categories: overrides.categories ?? ["work"],
    urgency: overrides.urgency ?? null,
    importance: overrides.importance ?? null,
    estTimeMin: overrides.estTimeMin ?? null,
    focus: overrides.focus ?? null,
    pinnedFields: overrides.pinnedFields ?? [],
    goalId: null,
    position: null,
  };
  return { ...base, _score: overrides._score };
}

const W = 700;
const H = 700;
const INNER_W = W - PADDING * 2;
const INNER_H = H - PADDING * 2;
const JITTER_TOL = 14;

describe("placeOnMap", () => {
  it("returns empty for empty input", () => {
    expect(placeOnMap([], W, H)).toEqual([]);
  });

  it("urgency=100 places at right edge (within jitter)", () => {
    const [p] = placeOnMap([mkScored({ id: 1, _score: 0.5, urgency: 100, importance: 50 })], W, H);
    expect(p!.x).toBeGreaterThan(PADDING + INNER_W - JITTER_TOL - 1);
    expect(p!.x).toBeLessThan(PADDING + INNER_W + JITTER_TOL + 1);
  });

  it("urgency=0 places at left edge (within jitter)", () => {
    const [p] = placeOnMap([mkScored({ id: 1, _score: 0.5, urgency: 0, importance: 50 })], W, H);
    expect(p!.x).toBeGreaterThan(PADDING - JITTER_TOL - 1);
    expect(p!.x).toBeLessThan(PADDING + JITTER_TOL + 1);
  });

  it("importance=100 places at top (low y, within jitter)", () => {
    const [p] = placeOnMap([mkScored({ id: 1, _score: 0.5, urgency: 50, importance: 100 })], W, H);
    expect(p!.y).toBeGreaterThan(PADDING - JITTER_TOL - 1);
    expect(p!.y).toBeLessThan(PADDING + JITTER_TOL + 1);
  });

  it("importance=0 places at bottom (high y, within jitter)", () => {
    const [p] = placeOnMap([mkScored({ id: 1, _score: 0.5, urgency: 50, importance: 0 })], W, H);
    expect(p!.y).toBeGreaterThan(PADDING + INNER_H - JITTER_TOL - 1);
    expect(p!.y).toBeLessThan(PADDING + INNER_H + JITTER_TOL + 1);
  });

  it("null urgency uses default 30", () => {
    const [p] = placeOnMap([mkScored({ id: 1, _score: 0.5, urgency: null, importance: 50 })], W, H);
    const expected = PADDING + (30 / 100) * INNER_W;
    expect(p!.x).toBeGreaterThan(expected - JITTER_TOL - 1);
    expect(p!.x).toBeLessThan(expected + JITTER_TOL + 1);
  });

  it("null importance uses default 40", () => {
    const [p] = placeOnMap([mkScored({ id: 1, _score: 0.5, urgency: 50, importance: null })], W, H);
    const expected = PADDING + ((100 - 40) / 100) * INNER_H;
    expect(p!.y).toBeGreaterThan(expected - JITTER_TOL - 1);
    expect(p!.y).toBeLessThan(expected + JITTER_TOL + 1);
  });

  it("first scored task has isTop=true", () => {
    const placements = placeOnMap(
      [
        mkScored({ id: 1, _score: 0.9 }),
        mkScored({ id: 2, _score: 0.5 }),
      ],
      W,
      H
    );
    expect(placements[0]!.isTop).toBe(true);
    expect(placements[1]!.isTop).toBe(false);
  });

  it("primaryCat is the first category", () => {
    const [p] = placeOnMap(
      [mkScored({ id: 1, _score: 0.5, categories: ["personal", "work", "health"] })],
      W,
      H
    );
    expect(p!.primaryCat).toBe("personal");
    expect(p!.cats).toEqual(["personal", "work", "health"]);
  });

  it("is deterministic — same input produces same positions", () => {
    const tasks = [
      mkScored({ id: 1, _score: 0.9, urgency: 70, importance: 80 }),
      mkScored({ id: 2, _score: 0.7, urgency: 30, importance: 60 }),
    ];
    const a = placeOnMap(tasks, W, H);
    const b = placeOnMap(tasks, W, H);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.x).toBe(b[i]!.x);
      expect(a[i]!.y).toBe(b[i]!.y);
    }
  });

  it("two tasks at identical (urgency, importance) get different positions via jitter", () => {
    const a = placeOnMap(
      [
        mkScored({ id: 1, _score: 0.5, urgency: 50, importance: 50 }),
        mkScored({ id: 2, _score: 0.4, urgency: 50, importance: 50 }),
      ],
      W,
      H
    );
    expect(a[0]!.x !== a[1]!.x || a[0]!.y !== a[1]!.y).toBe(true);
  });
});

describe("radiusFromEstTime", () => {
  it("null falls back to default (30 min)", () => {
    expect(radiusFromEstTime(null)).toBeGreaterThan(MIN_R);
    expect(radiusFromEstTime(null)).toBeLessThan(MAX_R);
  });

  it("clamps very small values to MIN_R", () => {
    expect(radiusFromEstTime(0)).toBeGreaterThanOrEqual(MIN_R);
  });

  it("clamps very large values to MAX_R", () => {
    expect(radiusFromEstTime(10_000)).toBe(MAX_R);
  });

  it("longer task → larger bubble", () => {
    expect(radiusFromEstTime(120)).toBeGreaterThan(radiusFromEstTime(15));
  });

  it("size grows sub-linearly (sqrt curve, not linear)", () => {
    // 4x time should produce ~2x radius increment over the floor — not 4x.
    const small = radiusFromEstTime(15);
    const large = radiusFromEstTime(60);
    expect(large - MIN_R).toBeLessThan((small - MIN_R) * 4);
  });
});
