import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "./agent";
import type { PlannerApi } from "./api";

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
      { now: new Date("2026-06-08T12:00:00Z"), timezone: "America/Denver" }
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
      { now: new Date(), timezone: "America/Denver" }
    );

    expect(calls.find((c) => c[0] === "deleteTask")).toBeUndefined();
    expect(reply).toContain("Confirm");
  });

  // Sonnet 5 rejects `temperature` with a 400, so sending one is not a nudge
  // toward determinism — it is a failed request. The eval harness used to pin
  // it; nothing may put it back.
  it("never sends temperature", async () => {
    const { api } = fakeApi();
    const { anthropic, requests } = recordingAnthropic();

    await runAgent([{ role: "user", content: "hi" }], api, anthropic, {
      now: new Date(),
      timezone: "America/Denver",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toHaveProperty("temperature");
  });
});

// A tool that fails must never be reportable as "you have nothing to do". The
// system prompt says so, but the prompt is a request; this is the guarantee.
describe("runAgent tool failures", () => {
  const ctx = { now: new Date("2026-06-08T12:00:00Z"), timezone: "America/Denver" };

  function failingApi(fail: Partial<Record<keyof PlannerApi, boolean>>): PlannerApi {
    const { api } = fakeApi();
    return new Proxy(api, {
      get: (target, prop: string) =>
        fail[prop as keyof PlannerApi]
          ? async () => {
              throw new Error("planner API GET /api/internal/digest → 401 unauthorized");
            }
          : target[prop as keyof PlannerApi],
    }) as PlannerApi;
  }

  it("warns the owner when a tool failed and the model claimed everything was fine", async () => {
    const anthropic = fakeAnthropic([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_digest", input: {} }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Your task list is completely empty! 🎉" }] },
    ]);

    const { reply } = await runAgent(
      [{ role: "user", content: "what's next?" }],
      failingApi({ getDigest: true }),
      anthropic,
      ctx
    );

    expect(reply).toMatch(/Couldn't reach your planner data/);
    expect(reply).toContain("get_digest");
  });

  it("labels the tool result as an error rather than data", async () => {
    const anthropic = fakeAnthropic([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_digest", input: {} }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] },
    ]);

    const { messages } = await runAgent(
      [{ role: "user", content: "what's next?" }],
      failingApi({ getDigest: true }),
      anthropic,
      ctx
    );

    const result = (messages[2].content as Anthropic.ToolResultBlockParam[])[0];
    expect(result.is_error).toBe(true);
    expect(result.content).toMatch(/TOOL FAILED/);
    expect(result.content).toMatch(/401 unauthorized/);
  });

  it("stays quiet when a retry of the same tool succeeds", async () => {
    let firstCall = true;
    const { api } = fakeApi();
    const flaky: PlannerApi = {
      ...api,
      getDigest: async () => {
        if (firstCall) {
          firstCall = false;
          throw new Error("transient");
        }
        return { top: [], overdueTasks: [], idleGoals: [] };
      },
    };
    const anthropic = fakeAnthropic([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_digest", input: {} }] },
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "get_digest", input: {} }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Nothing due today." }] },
    ]);

    const { reply } = await runAgent([{ role: "user", content: "what's next?" }], flaky, anthropic, ctx);

    expect(reply).toBe("Nothing due today.");
  });

  it("warns even when the loop runs out of rounds", async () => {
    const anthropic = fakeAnthropic(
      Array.from({ length: 6 }, () => ({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t", name: "list_tasks", input: {} }],
      }))
    );

    const { reply } = await runAgent(
      [{ role: "user", content: "what's next?" }],
      failingApi({ listTasks: true }),
      anthropic,
      ctx
    );

    expect(reply).toMatch(/Couldn't reach your planner data/);
  });
});
