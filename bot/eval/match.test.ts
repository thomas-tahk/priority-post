import { describe, it, expect } from "vitest";
import { matchValue, matchCall, evaluateCase, describeCall } from "./match.js";
import type { RecordedCall } from "./types.js";

describe("matchValue — equals", () => {
  it("matches identical numbers and rejects different ones", () => {
    expect(matchValue({ equals: 3 }, 3)).toBe(true);
    expect(matchValue({ equals: 3 }, 7)).toBe(false);
  });

  it("does not coerce a numeric string to a number", () => {
    expect(matchValue({ equals: 3 }, "3")).toBe(false);
  });

  it("matches null and booleans exactly", () => {
    expect(matchValue({ equals: null }, null)).toBe(true);
    expect(matchValue({ equals: null }, undefined)).toBe(false);
    expect(matchValue({ equals: true }, true)).toBe(true);
    expect(matchValue({ equals: true }, false)).toBe(false);
  });
});

describe("matchValue — isoAt", () => {
  it("treats the same instant written in different offsets as equal", () => {
    expect(matchValue({ isoAt: "2026-07-24T15:00:00-06:00" }, "2026-07-24T21:00:00Z")).toBe(true);
  });

  it("rejects a different instant", () => {
    expect(matchValue({ isoAt: "2026-07-24T15:00:00-06:00" }, "2026-07-24T15:00:00Z")).toBe(false);
  });

  it("rejects an unparseable or non-string value", () => {
    expect(matchValue({ isoAt: "2026-07-24T15:00:00-06:00" }, "next friday")).toBe(false);
    expect(matchValue({ isoAt: "2026-07-24T15:00:00-06:00" }, 1234)).toBe(false);
    expect(matchValue({ isoAt: "2026-07-24T15:00:00-06:00" }, null)).toBe(false);
  });
});

describe("matchValue — contains", () => {
  it("is case-insensitive on substrings", () => {
    expect(matchValue({ contains: "dentist" }, "Call the Dentist")).toBe(true);
    expect(matchValue({ contains: "DENTIST" }, "call the dentist")).toBe(true);
  });

  it("rejects a missing substring or a non-string value", () => {
    expect(matchValue({ contains: "dentist" }, "call the doctor")).toBe(false);
    expect(matchValue({ contains: "dentist" }, 42)).toBe(false);
  });
});

describe("matchValue — any", () => {
  it("accepts any value, including null", () => {
    expect(matchValue({ any: true }, "whatever")).toBe(true);
    expect(matchValue({ any: true }, null)).toBe(true);
    expect(matchValue({ any: true }, 0)).toBe(true);
  });
});

describe("matchCall", () => {
  const call: RecordedCall = {
    tool: "reschedule_task",
    args: { id: 3, start_at: "2026-07-24T15:00:00-06:00" },
  };

  it("matches on tool name plus every constrained arg", () => {
    expect(
      matchCall({ tool: "reschedule_task", args: { id: { equals: 3 } } }, call)
    ).toBe(true);
  });

  it("rejects a different tool", () => {
    expect(matchCall({ tool: "delete_task", args: { id: { equals: 3 } } }, call)).toBe(false);
  });

  it("rejects when any single arg fails", () => {
    expect(
      matchCall(
        { tool: "reschedule_task", args: { id: { equals: 3 }, start_at: { isoAt: "2026-07-25T15:00:00-06:00" } } },
        call
      )
    ).toBe(false);
  });

  it("ignores extra args the case does not constrain", () => {
    expect(matchCall({ tool: "reschedule_task" }, call)).toBe(true);
  });

  it("fails when a constrained arg is absent entirely", () => {
    expect(matchCall({ tool: "reschedule_task", args: { goal_id: { any: true } } }, call)).toBe(false);
  });
});

describe("evaluateCase", () => {
  const rescheduled: RecordedCall = {
    tool: "reschedule_task",
    args: { id: 3, start_at: "2026-07-24T15:00:00-06:00" },
  };

  it("passes when the expected call happened", () => {
    const r = evaluateCase({ calls: [{ tool: "reschedule_task", args: { id: { equals: 3 } } }] }, [rescheduled]);
    expect(r.passed).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it("does not care about call order", () => {
    const calls: RecordedCall[] = [
      { tool: "add_task", args: { title: "milk" } },
      { tool: "add_task", args: { title: "eggs" } },
    ];
    const r = evaluateCase(
      {
        calls: [
          { tool: "add_task", args: { title: { contains: "eggs" } } },
          { tool: "add_task", args: { title: { contains: "milk" } } },
        ],
      },
      calls
    );
    expect(r.passed).toBe(true);
  });

  it("does not let one recorded call satisfy two expectations", () => {
    const r = evaluateCase(
      {
        calls: [
          { tool: "add_task", args: { title: { contains: "milk" } } },
          { tool: "add_task", args: { title: { contains: "milk" } } },
        ],
      },
      [{ tool: "add_task", args: { title: "milk" } }]
    );
    expect(r.passed).toBe(false);
  });

  it("reports the expected call and what actually happened", () => {
    const r = evaluateCase(
      { calls: [{ tool: "reschedule_task", args: { id: { equals: 7 } } }] },
      [rescheduled]
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.join(" ")).toContain("reschedule_task");
    expect(r.reasons.join(" ")).toContain("7");
  });

  it("fails when a forbidden tool was called", () => {
    const r = evaluateCase({ forbidden: ["delete_task"] }, [{ tool: "delete_task", args: { id: 1 } }]);
    expect(r.passed).toBe(false);
    expect(r.reasons.join(" ")).toContain("delete_task");
  });

  it("passes when a forbidden tool was avoided", () => {
    const r = evaluateCase({ forbidden: ["delete_task"] }, [{ tool: "list_tasks", args: {} }]);
    expect(r.passed).toBe(true);
  });

  it("passes a forbidden-only case when nothing at all was called", () => {
    expect(evaluateCase({ forbidden: ["delete_task"] }, []).passed).toBe(true);
  });

  it("checks calls and forbidden together", () => {
    const r = evaluateCase(
      { calls: [{ tool: "list_tasks" }], forbidden: ["delete_task"] },
      [{ tool: "list_tasks", args: {} }, { tool: "delete_task", args: { id: 2 } }]
    );
    expect(r.passed).toBe(false);
    expect(r.reasons).toHaveLength(1);
  });
});

describe("describeCall", () => {
  it("renders a call compactly for the failure report", () => {
    expect(describeCall({ tool: "reschedule_task", args: { id: 7, start_at: "2026-07-24T15:00:00-06:00" } })).toBe(
      "reschedule_task(id=7, start_at=2026-07-24T15:00:00-06:00)"
    );
  });

  it("renders a no-arg call", () => {
    expect(describeCall({ tool: "get_digest", args: {} })).toBe("get_digest()");
  });
});
