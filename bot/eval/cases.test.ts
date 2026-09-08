import { describe, it, expect } from "vitest";
import { CASES } from "./cases.js";
import { makeWorld } from "./world.js";
import type { CaseCategory } from "./types.js";

describe("the case list is well-formed", () => {
  it("has unique ids", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the five categories at roughly the planned weights", () => {
    const counts = CASES.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({
      action_choice: 12,
      reference: 8,
      time_parsing: 8,
      safety: 7,
      ambiguity: 5,
    });
    expect(CASES).toHaveLength(40);
  });

  it("gives every case something to check", () => {
    for (const c of CASES) {
      const checks = (c.expect.calls?.length ?? 0) + (c.expect.forbidden?.length ?? 0);
      expect(checks, `${c.id} asserts nothing`).toBeGreaterThan(0);
    }
  });

  it("never expects a task id the fixture world does not have", async () => {
    const { api } = makeWorld();
    const known = new Set((await api.listTasks()).map((t) => t.id));

    for (const c of CASES) {
      for (const call of c.expect.calls ?? []) {
        const idMatcher = call.args?.id;
        if (idMatcher && "equals" in idMatcher) {
          expect(known, `${c.id} references unknown task id ${idMatcher.equals}`).toContain(idMatcher.equals);
        }
      }
    }
  });

  it("only names tools the agent actually has", () => {
    const TOOLS = new Set([
      "list_tasks",
      "get_digest",
      "add_task",
      "reschedule_task",
      "complete_task",
      "delete_task",
      "decompose_goal",
      "get_progress",
    ]);
    for (const c of CASES) {
      for (const call of c.expect.calls ?? []) {
        expect(TOOLS, `${c.id} expects unknown tool ${call.tool}`).toContain(call.tool);
      }
      for (const tool of c.expect.forbidden ?? []) {
        expect(TOOLS, `${c.id} forbids unknown tool ${tool}`).toContain(tool);
      }
    }
  });

  it("keeps every expected datetime anchored to the fixture clock's week", () => {
    // Guards against a case written against today's date by accident.
    for (const c of CASES) {
      for (const call of c.expect.calls ?? []) {
        const m = call.args?.start_at;
        if (m && "isoAt" in m) {
          const t = Date.parse(m.isoAt);
          expect(Number.isNaN(t), `${c.id} has an unparseable expected time`).toBe(false);
          expect(t, `${c.id} expects a time before the fixture clock`).toBeGreaterThan(
            Date.parse("2026-07-20T18:00:00-06:00")
          );
        }
      }
    }
  });

  it("gives each safety confirm-then-delete case the prior turns it needs", () => {
    const confirmCases = CASES.filter(
      (c) => c.category === "safety" && c.expect.calls?.some((k) => k.tool === "delete_task")
    );
    expect(confirmCases.length).toBeGreaterThan(0);
    for (const c of confirmCases) {
      expect(c.history?.length, `${c.id} confirms a delete with no prior turn`).toBeGreaterThan(0);
    }
  });

  it("puts the near-collision pair in play in the reference cases", () => {
    const refs = CASES.filter((c) => c.category === "reference");
    const taxes = refs.find((c) => c.message.includes("taxes"));
    const expense = refs.find((c) => c.message.includes("expense report"));
    expect(taxes?.expect.calls?.[0]?.args?.id).toEqual({ equals: 1 });
    expect(expense?.expect.calls?.[0]?.args?.id).toEqual({ equals: 2 });
  });
});
