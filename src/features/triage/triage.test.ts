import { describe, expect, it, vi } from "vitest";
import { triageTask } from "./triage";

function mockClient(toolUseInput: unknown, opts: { name?: string; throws?: unknown } = {}) {
  const name = opts.name ?? "record_triage";
  return {
    messages: {
      create: vi.fn(async () => {
        if (opts.throws) throw opts.throws;
        return {
          content: [{ type: "tool_use", name, input: toolUseInput }],
        };
      }),
    },
  } as unknown as NonNullable<Parameters<typeof triageTask>[2]>["client"];
}

describe("triageTask", () => {
  it("returns parsed triage when SDK returns valid tool_use", async () => {
    const client = mockClient({
      categories: ["work"],
      urgency: 85,
      importance: 70,
      est_time_min: 25,
      focus: "medium",
    });
    const result = await triageTask("review Alex's PR by 5pm", null, { client });
    expect(result).toEqual({
      categories: ["work"],
      urgency: 85,
      importance: 70,
      est_time_min: 25,
      focus: "medium",
    });
  });

  it("filters out unknown categories from the model", async () => {
    const client = mockClient({
      categories: ["work", "fakecategory", "personal"],
      urgency: 50,
      importance: 50,
      est_time_min: 30,
      focus: "low",
    });
    const result = await triageTask("ambiguous task", null, { client });
    expect(result?.categories).toEqual(["work", "personal"]);
  });

  it("returns null when all categories are invalid", async () => {
    const client = mockClient({
      categories: ["bogus"],
      urgency: 50,
      importance: 50,
      est_time_min: 30,
      focus: "low",
    });
    const result = await triageTask("garbage", null, { client });
    expect(result).toBeNull();
  });

  it("returns null when urgency is out of range", async () => {
    const client = mockClient({
      categories: ["work"],
      urgency: 200,
      importance: 50,
      est_time_min: 30,
      focus: "low",
    });
    expect(await triageTask("test", null, { client })).toBeNull();
  });

  it("returns null when focus value is unknown", async () => {
    const client = mockClient({
      categories: ["work"],
      urgency: 50,
      importance: 50,
      est_time_min: 30,
      focus: "extreme",
    });
    expect(await triageTask("test", null, { client })).toBeNull();
  });

  it("returns null when SDK throws an error (no exception bubbles up)", async () => {
    const client = mockClient(null, { throws: new Error("network down") });
    expect(await triageTask("test", null, { client })).toBeNull();
  });

  it("returns null when no tool_use block is in the response", async () => {
    const client = {
      messages: {
        create: vi.fn(async () => ({
          content: [{ type: "text", text: "I refuse." }],
        })),
      },
    } as unknown as NonNullable<Parameters<typeof triageTask>[2]>["client"];
    expect(await triageTask("test", null, { client })).toBeNull();
  });

  it("rounds float-valued numeric fields", async () => {
    const client = mockClient({
      categories: ["work"],
      urgency: 85.7,
      importance: 65.4,
      est_time_min: 22.6,
      focus: "high",
    });
    const result = await triageTask("test", null, { client });
    expect(result?.urgency).toBe(86);
    expect(result?.importance).toBe(65);
    expect(result?.est_time_min).toBe(23);
  });

  it("includes notes in the user message when provided", async () => {
    const create = vi.fn<(arg: { messages: { content: string }[] }) => Promise<unknown>>(
      async () => ({
        content: [
          {
            type: "tool_use",
            name: "record_triage",
            input: {
              categories: ["work"],
              urgency: 50,
              importance: 50,
              est_time_min: 30,
              focus: "medium",
            },
          },
        ],
      })
    );
    const client = { messages: { create } } as unknown as NonNullable<Parameters<typeof triageTask>[2]>["client"];
    await triageTask("write doc", "Cover X, Y, Z", { client });
    const callArg = create.mock.calls[0]![0];
    expect(callArg.messages[0]!.content).toContain("write doc");
    expect(callArg.messages[0]!.content).toContain("Cover X, Y, Z");
  });

  it("returns null and warns when no API key and no client provided", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await triageTask("test", null, { apiKey: undefined });
    expect(result).toBeNull();
    warn.mockRestore();
  });
});
