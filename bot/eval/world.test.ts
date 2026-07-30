import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { FIXED_NOW, makeWorld, recordedCallsFrom, timezoneMismatch, TIMEZONE } from "./world.js";

describe("the fixture world", () => {
  it("is pinned to a Monday 6pm Mountain, so 'friday 3pm' has one right answer", () => {
    expect(FIXED_NOW.toISOString()).toBe("2026-07-21T00:00:00.000Z");
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      weekday: "long",
      hour: "numeric",
      hourCycle: "h23",
    }).format(FIXED_NOW);
    expect(local).toContain("Monday");
    expect(local).toContain("18");
  });

  it("has 12 open tasks covering all seven categories", async () => {
    const { api } = makeWorld();
    const tasks = await api.listTasks();
    expect(tasks).toHaveLength(12);
    const cats = new Set(tasks.flatMap((t) => t.categories));
    expect([...cats].sort()).toEqual([
      "errands",
      "health",
      "learning",
      "other",
      "personal",
      "side_project",
      "work",
    ]);
  });

  it("contains the near-collision pair that reference cases hinge on", async () => {
    const { api } = makeWorld();
    const titles = (await api.listTasks()).map((t) => t.title.toLowerCase());
    expect(titles.filter((t) => t.includes("file")).length).toBe(2);
    expect(titles).toContain("file taxes");
    expect(titles).toContain("file expense report");
  });

  it("has 3 goals, exactly one of them idle", async () => {
    const { api } = makeWorld();
    const digest = await api.getDigest();
    expect(digest.idleGoals).toHaveLength(1);
  });

  it("gives every run an identical starting state", async () => {
    const a = makeWorld();
    const b = makeWorld();
    const first = (await a.api.listTasks())[0]!;
    await a.api.deleteTask(first.id);
    expect((await a.api.listTasks()).length).toBe(11);
    expect((await b.api.listTasks()).length).toBe(12);
  });
});

describe("the fixture world applies mutations in memory", () => {
  it("drops a deleted task from the list", async () => {
    const { api } = makeWorld();
    const target = (await api.listTasks())[0]!;
    await api.deleteTask(target.id);
    expect((await api.listTasks()).map((t) => t.id)).not.toContain(target.id);
  });

  it("hides a completed task from the open list", async () => {
    const { api } = makeWorld();
    const target = (await api.listTasks())[0]!;
    await api.patchTask(target.id, { done: true });
    expect((await api.listTasks()).map((t) => t.id)).not.toContain(target.id);
  });

  it("reflects a reschedule", async () => {
    const { api } = makeWorld();
    const target = (await api.listTasks())[0]!;
    await api.patchTask(target.id, { startAt: "2026-07-24T15:00:00-06:00" });
    const after = (await api.listTasks()).find((t) => t.id === target.id);
    expect(after?.startAt).toBe("2026-07-24T15:00:00-06:00");
  });

  it("adds a new task with a fresh id", async () => {
    const { api } = makeWorld();
    const { id } = await api.createTask({ title: "Book flights" });
    const tasks = await api.listTasks();
    expect(tasks).toHaveLength(13);
    expect(tasks.find((t) => t.id === id)?.title).toBe("Book flights");
  });

  it("never touches Postgres or the network", async () => {
    const { api } = makeWorld();
    // getProgress and decomposeGoal are the two that would otherwise call out.
    await expect(api.getProgress(7)).resolves.toHaveProperty("stats");
    await expect(api.decomposeGoal({ goalId: 1 })).resolves.toBeInstanceOf(Array);
  });
});

describe("timezoneMismatch", () => {
  it("accepts the zone the fixture world is written in", () => {
    expect(timezoneMismatch("America/Denver")).toBeNull();
  });

  it("explains the mismatch rather than letting the run score garbage", () => {
    // The agent reads the owner's offset out of now.toString(), which renders in
    // the PROCESS timezone. Run the eval anywhere else and every expected
    // datetime is off by the offset difference — 13 bogus failures, no clue why.
    const msg = timezoneMismatch("America/Los_Angeles");
    expect(msg).not.toBeNull();
    expect(msg).toContain("America/Los_Angeles");
    expect(msg).toContain("America/Denver");
    expect(msg).toContain("TZ=");
  });
});

describe("recordedCallsFrom", () => {
  function assistant(blocks: unknown[]): Anthropic.MessageParam {
    return { role: "assistant", content: blocks as Anthropic.ContentBlockParam[] };
  }

  it("pulls tool name and arguments out of assistant tool_use blocks", () => {
    const calls = recordedCallsFrom([
      { role: "user", content: "move taxes to friday" },
      assistant([
        { type: "text", text: "on it" },
        { type: "tool_use", id: "t1", name: "reschedule_task", input: { id: 3, start_at: "2026-07-24T15:00:00-06:00" } },
      ]),
    ]);

    expect(calls).toEqual([
      { tool: "reschedule_task", args: { id: 3, start_at: "2026-07-24T15:00:00-06:00" } },
    ]);
  });

  it("captures several tools batched into one turn, in order", () => {
    const calls = recordedCallsFrom([
      assistant([
        { type: "tool_use", id: "t1", name: "add_task", input: { title: "milk" } },
        { type: "tool_use", id: "t2", name: "add_task", input: { title: "eggs" } },
      ]),
    ]);
    expect(calls.map((c) => c.args.title)).toEqual(["milk", "eggs"]);
  });

  it("spans multiple rounds", () => {
    const calls = recordedCallsFrom([
      assistant([{ type: "tool_use", id: "t1", name: "list_tasks", input: {} }]),
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "[]" }] },
      assistant([{ type: "tool_use", id: "t2", name: "delete_task", input: { id: 4 } }]),
    ]);
    expect(calls.map((c) => c.tool)).toEqual(["list_tasks", "delete_task"]);
  });

  it("returns an empty list when the model only talked", () => {
    expect(recordedCallsFrom([assistant([{ type: "text", text: "which one do you mean?" }])])).toEqual([]);
  });

  it("ignores user turns and string content", () => {
    expect(recordedCallsFrom([{ role: "user", content: "delete the gym task" }])).toEqual([]);
  });

  it("treats a missing input as empty args rather than throwing", () => {
    const calls = recordedCallsFrom([assistant([{ type: "tool_use", id: "t1", name: "get_digest" }])]);
    expect(calls).toEqual([{ tool: "get_digest", args: {} }]);
  });
});
