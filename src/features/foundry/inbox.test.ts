import { describe, it, expect } from "vitest";
import { parseInbox } from "./inbox";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "priority-post#42",
    repo: "thomas-tahk/priority-post",
    summary: "Add a settings screen",
    detail: "Because the hour is buried in an env var.",
    state: "waiting_on_you",
    url: "https://github.com/thomas-tahk/priority-post/issues/42",
    since: "2026-09-05T14:02:00Z",
    actions: [
      { key: "approve", label: "Build it", kind: "apply_label", number: 42, value: "factory:approved" },
    ],
    ...overrides,
  };
}

function doc(items: unknown[]) {
  return { generated_at: "2026-09-07T18:00:00Z", items };
}

describe("reading the factory's inbox", () => {
  it("accepts a well-formed item", () => {
    const result = parseInbox(doc([item()]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].summary).toBe("Add a settings screen");
  });

  it("keeps no label name of its own — it writes whatever it is handed", () => {
    const result = parseInbox(
      doc([item({ actions: [{ key: "approve", label: "Build it", kind: "apply_label", number: 7, value: "anything:at:all" }] })]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const action = result.items[0].actions[0];
    expect(action.kind).toBe("apply_label");
    if (action.kind !== "apply_label") return;
    expect(action.value).toBe("anything:at:all");
    expect(action.number).toBe(7);
  });
});

describe("refusing to show something wrong", () => {
  it("drops an item whose state it does not recognise", () => {
    const result = parseInbox(doc([item(), item({ id: "x", state: "invented_state" })]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(["priority-post#42"]);
  });

  it("drops an unknown action but keeps the item", () => {
    const result = parseInbox(
      doc([
        item({
          actions: [
            { key: "merge", label: "Merge", kind: "merge_pr", value: "x" },
            { key: "read", label: "Read", kind: "open_url", value: "https://example.com" },
          ],
        }),
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0].actions.map((a) => a.key)).toEqual(["read"]);
  });

  it("drops a label action that does not say what number to write to", () => {
    const result = parseInbox(
      doc([item({ actions: [{ key: "approve", label: "Build it", kind: "apply_label", value: "factory:approved" }] })]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0].actions).toEqual([]);
  });

  it("reports a malformed file instead of rendering nothing silently", () => {
    expect(parseInbox("not json at all").ok).toBe(false);
    expect(parseInbox({ items: "nope" }).ok).toBe(false);
    expect(parseInbox(null).ok).toBe(false);
  });

  it("drops an item missing the text a person would read", () => {
    const result = parseInbox(doc([item({ summary: "" })]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toEqual([]);
  });
});

describe("the projects work can be asked for in", () => {
  it("carries the list the factory published", () => {
    const result = parseInbox({ ...doc([]), projects: ["thomas-tahk/knowflow"] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projects).toEqual(["thomas-tahk/knowflow"]);
  });

  it("offers none when the file names none, rather than guessing", () => {
    const result = parseInbox(doc([]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projects).toEqual([]);
  });
});

describe("the order the list shows them in", () => {
  it("puts a broken build first and a stranded branch last", () => {
    const result = parseInbox(
      doc([
        item({ id: "d", state: "branch_stranded" }),
        item({ id: "c", state: "draft_ready" }),
        item({ id: "b", state: "waiting_on_you" }),
        item({ id: "a", state: "build_failing" }),
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("puts the thing waiting longest first within a state", () => {
    const result = parseInbox(
      doc([
        item({ id: "new", since: "2026-09-06T00:00:00Z" }),
        item({ id: "old", since: "2026-09-01T00:00:00Z" }),
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(["old", "new"]);
  });
});
