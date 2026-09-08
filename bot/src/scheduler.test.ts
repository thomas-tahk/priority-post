import { describe, it, expect } from "vitest";
import { digestCron, runDueSoonSweep } from "./scheduler.js";
import type { DueEvent, PlannerApi } from "./api.js";

const DENVER = "America/Denver";

function task(id: number, title: string) {
  return {
    id,
    title,
    categories: ["work"],
    urgency: 50,
    importance: 50,
    estTimeMin: 30,
    focus: "medium",
    startAt: "2026-07-20T18:30:00-06:00",
    goalId: null,
    score: 0.5,
  };
}

function fakeApi(events: DueEvent[]) {
  const calls: string[] = [];
  const api = {
    getDueSoon: async () => (calls.push("getDueSoon"), events),
    markReminder: async (id: number, kind: string) => void calls.push(`mark:${id}:${kind}`),
  } as unknown as PlannerApi;
  return { api, calls };
}

describe("digestCron", () => {
  it("puts the minute in the minute field", () => {
    expect(digestCron(16, 45)).toBe("45 16 * * *");
  });

  it("still handles an on-the-hour digest", () => {
    expect(digestCron(8, 0)).toBe("0 8 * * *");
  });
});

describe("runDueSoonSweep", () => {
  const evening = new Date("2026-07-20T18:00:00-06:00");
  const midday = new Date("2026-07-20T10:00:00-06:00");

  it("sends and marks each due event inside the active window", async () => {
    const { api, calls } = fakeApi([
      { kind: "due_soon", task: task(1, "Pick up prescription") },
      { kind: "overdue", task: task(2, "Call the bank") },
    ]);
    const sent: string[] = [];

    const count = await runDueSoonSweep({
      api,
      send: async (t) => void sent.push(t),
      now: evening,
      activeStartHour: 16,
      activeEndHour: 22,
      timezone: DENVER,
    });

    expect(count).toBe(2);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toContain("Pick up prescription");
    expect(calls).toContain("mark:1:due_soon");
    expect(calls).toContain("mark:2:overdue");
  });

  it("sends nothing outside the active window", async () => {
    const { api, calls } = fakeApi([{ kind: "due_soon", task: task(1, "Pick up prescription") }]);
    const sent: string[] = [];

    const count = await runDueSoonSweep({
      api,
      send: async (t) => void sent.push(t),
      now: midday,
      activeStartHour: 16,
      activeEndHour: 22,
      timezone: DENVER,
    });

    expect(count).toBe(0);
    expect(sent).toEqual([]);
  });

  it("does not even query the API outside the window", async () => {
    const { api, calls } = fakeApi([{ kind: "due_soon", task: task(1, "Pick up prescription") }]);

    await runDueSoonSweep({
      api,
      send: async () => {},
      now: midday,
      activeStartHour: 16,
      activeEndHour: 22,
      timezone: DENVER,
    });

    expect(calls).toEqual([]);
  });

  it("skips rather than queues — a ping missed at midday is not sent later", async () => {
    const { api } = fakeApi([{ kind: "due_soon", task: task(1, "Pick up prescription") }]);
    const sent: string[] = [];
    const send = async (t: string) => void sent.push(t);
    const window = { activeStartHour: 16, activeEndHour: 22, timezone: DENVER };

    await runDueSoonSweep({ api, send, now: midday, ...window });
    await runDueSoonSweep({ api, send, now: evening, ...window });

    // Only the event still returned by the API at 6pm goes out — nothing accumulated
    // from the suppressed midday tick.
    expect(sent).toHaveLength(1);
  });
});
