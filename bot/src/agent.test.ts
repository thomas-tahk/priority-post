import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "./agent.js";
import type { PlannerApi } from "./api.js";

function fakeApi(): { api: PlannerApi; calls: string[][] } {
  const calls: string[][] = [];
  const api: PlannerApi = {
    listTasks: async () => (calls.push(["listTasks"]), []),
    createTask: async (i) => (calls.push(["createTask", i.title]), { id: 42 }),
    patchTask: async (id, p) => void calls.push(["patchTask", String(id), JSON.stringify(p)]),
    deleteTask: async (id) => void calls.push(["deleteTask", String(id)]),
    getDigest: async () => (calls.push(["getDigest"]), { top: [], overdueTasks: [], idleGoals: [] }),
    getDueSoon: async () => [],
    markReminder: async () => {},
    decomposeGoal: async () => (calls.push(["decomposeGoal"]), ["one", "two"]),
    getProgress: async () => ({
      summary: "good",
      stats: { sinceDays: 7, completed: 1, created: 2, open: 3, overdueOpen: 0, idleGoals: 0 },
    }),
  };
  return { api, calls };
}

// Minimal stand-in for the Anthropic client: returns scripted responses in order.
function fakeAnthropic(scripted: unknown[]): Anthropic {
  let i = 0;
  return { messages: { create: async () => scripted[i++] } } as unknown as Anthropic;
}

// Same, but keeps the request params so we can assert on what was sent.
function recordingAnthropic(): { anthropic: Anthropic; requests: Record<string, unknown>[] } {
  const requests: Record<string, unknown>[] = [];
  const anthropic = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        requests.push(params);
        return { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] };
      },
    },
  } as unknown as Anthropic;
  return { anthropic, requests };
}

describe("runAgent", () => {
  it("executes a tool call then returns the model's final reply", async () => {
    const { api, calls } = fakeApi();
    const anthropic = fakeAnthropic([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "add_task", input: { title: "call dentist" } }],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "✅ added 'call dentist'" }] },
    ]);

    const { reply } = await runAgent(
      [{ role: "user", content: "add call dentist" }],
      api,
      anthropic,
      new Date("2026-06-08T12:00:00Z")
    );

    expect(calls).toContainEqual(["createTask", "call dentist"]);
    expect(reply).toBe("✅ added 'call dentist'");
  });

  it("does not delete when the model only asks for confirmation", async () => {
    const { api, calls } = fakeApi();
    const anthropic = fakeAnthropic([
      { stop_reason: "end_turn", content: [{ type: "text", text: "Delete 'gym'? Confirm and I'll remove it." }] },
    ]);

    const { reply } = await runAgent(
      [{ role: "user", content: "delete the gym task" }],
      api,
      anthropic,
      new Date()
    );

    expect(calls.find((c) => c[0] === "deleteTask")).toBeUndefined();
    expect(reply).toContain("Confirm");
  });

  it("passes temperature through when the caller pins it", async () => {
    const { api } = fakeApi();
    const { anthropic, requests } = recordingAnthropic();

    await runAgent([{ role: "user", content: "hi" }], api, anthropic, new Date(), 0);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.temperature).toBe(0);
  });

  it("omits temperature by default, leaving production behavior unchanged", async () => {
    const { api } = fakeApi();
    const { anthropic, requests } = recordingAnthropic();

    await runAgent([{ role: "user", content: "hi" }], api, anthropic, new Date());

    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toHaveProperty("temperature");
  });
});
