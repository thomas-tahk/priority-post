import { describe, it, expect } from "vitest";
import { parseActivity } from "./parse";

describe("what the assistant may write to the feed", () => {
  it("accepts an actor and a summary, trimmed", () => {
    const result = parseActivity({ actor: " lead ", summary: " Read 5 goals. " });

    expect(result).toEqual({ ok: true, entry: { actor: "lead", summary: "Read 5 goals." } });
  });

  it("refuses an entry with no summary", () => {
    const result = parseActivity({ actor: "lead", summary: "   " });

    expect(result.ok).toBe(false);
  });

  it("refuses an entry with no actor", () => {
    const result = parseActivity({ summary: "Read 5 goals." });

    expect(result.ok).toBe(false);
  });

  it("refuses a body that is not an object", () => {
    expect(parseActivity(null).ok).toBe(false);
    expect(parseActivity("lead").ok).toBe(false);
  });

  // A line in a phone digest. Anything longer is a specialist's working output,
  // which the lead is supposed to have filtered out before it got here.
  it("refuses a summary longer than a digest line should be", () => {
    const result = parseActivity({ actor: "lead", summary: "x".repeat(501) });

    expect(result.ok).toBe(false);
  });
});
