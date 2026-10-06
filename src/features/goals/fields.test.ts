import { describe, it, expect } from "vitest";
import { checkShape, parseGoalFields } from "./fields";

describe("parseGoalFields", () => {
  it("keeps only the keys that were sent, so it works as a patch", () => {
    expect(parseGoalFields({ name: "  Run a 5k " })).toEqual({ name: "Run a 5k" });
  });

  it("accepts a full gate", () => {
    const fields = parseGoalFields({ name: "Ship CAD", kind: "gate", targetDate: "2026-11-30", color: "learning" });

    expect(fields).toEqual({ name: "Ship CAD", kind: "gate", targetDate: "2026-11-30", color: "learning" });
  });

  it("clears nullable fields with null or an empty string", () => {
    const fields = parseGoalFields({ description: "", milestone: null, weeklyTarget: null, targetDate: null });

    expect(fields).toEqual({ description: null, milestone: null, weeklyTarget: null, targetDate: null });
  });

  it.each([
    [{ name: "  " }, /name/],
    [{ color: "teal" }, /color must be one of/],
    [{ kind: "habit" }, /kind must be one of/],
    [{ targetDate: "next friday" }, /targetDate/],
    [{ targetDate: "2026-13-45" }, /targetDate/],
    [{ weeklyTarget: 0 }, /weeklyTarget/],
    [{ weeklyTarget: 2.5 }, /weeklyTarget/],
    [{ milestone: 5 }, /milestone/],
  ])("rejects %j", (raw, message) => {
    expect(() => parseGoalFields(raw)).toThrow(message);
  });
});

describe("checkShape", () => {
  it("rejects a gate without a date", () => {
    expect(() => checkShape({ kind: "gate", targetDate: null })).toThrow(/needs a targetDate/);
  });

  it("allows a dateless track", () => {
    expect(() => checkShape({ kind: "track", targetDate: null })).not.toThrow();
  });
});
