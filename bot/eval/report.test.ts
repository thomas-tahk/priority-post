import { describe, it, expect } from "vitest";
import { renderScorecard, summarize } from "./report.js";
import type { CaseResult, RunMeta } from "./types.js";

const META: RunMeta = {
  model: "claude-sonnet-4-6",
  temperature: 0,
  startedAt: new Date("2026-07-19T15:04:00-06:00"),
};

function result(over: Partial<CaseResult> = {}): CaseResult {
  return {
    id: "ac-01",
    category: "action_choice",
    message: "what should I do tonight",
    status: "PASS",
    reasons: [],
    recorded: [],
    ...over,
  };
}

describe("summarize", () => {
  it("counts passes against total per category", () => {
    const s = summarize([
      result({ id: "a", category: "action_choice", status: "PASS" }),
      result({ id: "b", category: "action_choice", status: "FAIL" }),
      result({ id: "c", category: "safety", status: "PASS" }),
    ]);

    expect(s.byCategory.action_choice).toEqual({ passed: 1, total: 2 });
    expect(s.byCategory.safety).toEqual({ passed: 1, total: 2 - 1 });
    expect(s.totalPassed).toBe(2);
    expect(s.total).toBe(3);
  });

  it("counts an ERROR as neither pass nor silent success", () => {
    const s = summarize([
      result({ id: "a", status: "PASS" }),
      result({ id: "b", status: "ERROR", reasons: ["network"] }),
    ]);

    expect(s.totalPassed).toBe(1);
    expect(s.total).toBe(2);
    expect(s.errored).toBe(1);
  });

  it("reports safety separately, since it is the destructive one", () => {
    const s = summarize([
      result({ id: "s1", category: "safety", status: "PASS" }),
      result({ id: "s2", category: "safety", status: "FAIL" }),
      result({ id: "a1", category: "action_choice", status: "PASS" }),
    ]);
    expect(s.safety).toEqual({ passed: 1, total: 2 });
  });

  it("handles an empty run without dividing by zero", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.percent).toBe(0);
  });

  it("computes an overall percentage", () => {
    const s = summarize([
      result({ id: "a", status: "PASS" }),
      result({ id: "b", status: "PASS" }),
      result({ id: "c", status: "FAIL" }),
      result({ id: "d", status: "FAIL" }),
    ]);
    expect(s.percent).toBe(50);
  });
});

describe("renderScorecard", () => {
  it("shows the run header with model and temperature", () => {
    const out = renderScorecard([result()], META);
    expect(out).toContain("claude-sonnet-4-6");
    expect(out).toContain("temperature: 0");
    expect(out).toContain("cases: 1");
  });

  it("lists a line per category with its score", () => {
    const out = renderScorecard(
      [
        result({ id: "a", category: "action_choice", status: "PASS" }),
        result({ id: "b", category: "action_choice", status: "FAIL" }),
        result({ id: "c", category: "time_parsing", status: "PASS" }),
      ],
      META
    );
    expect(out).toMatch(/action_choice\s+1\/2/);
    expect(out).toMatch(/time_parsing\s+1\/1/);
  });

  it("prints a TOTAL with a percentage", () => {
    const out = renderScorecard([result({ status: "PASS" }), result({ id: "b", status: "FAIL" })], META);
    expect(out).toMatch(/TOTAL\s+1\/2/);
    expect(out).toContain("50.0%");
  });

  it("spells out each failure with expected vs actual", () => {
    const out = renderScorecard(
      [
        result({
          id: "ref-04",
          category: "reference",
          message: "move the taxes thing to friday",
          status: "FAIL",
          reasons: ['expected reschedule_task(id=1)\n    actual   reschedule_task(id=2)'],
        }),
      ],
      META
    );
    expect(out).toContain("FAILURES");
    expect(out).toContain("reference/ref-04");
    expect(out).toContain("move the taxes thing to friday");
    expect(out).toContain("reschedule_task(id=1)");
    expect(out).toContain("reschedule_task(id=2)");
  });

  it("keeps errors in their own section so a blip is not read as bad judgment", () => {
    const out = renderScorecard(
      [
        result({ id: "ok", status: "PASS" }),
        result({ id: "boom", status: "ERROR", reasons: ["overloaded_error"] }),
      ],
      META
    );
    expect(out).toContain("ERRORS");
    expect(out).toContain("boom");
    expect(out).toContain("overloaded_error");
  });

  it("omits the failures section entirely on a clean run", () => {
    const out = renderScorecard([result({ status: "PASS" })], META);
    expect(out).not.toContain("FAILURES");
    expect(out).not.toContain("ERRORS");
  });

  it("flags safety as its own headline", () => {
    const out = renderScorecard(
      [result({ id: "s1", category: "safety", status: "PASS" })],
      META
    );
    expect(out).toMatch(/safety\s+1\/1/);
  });
});
