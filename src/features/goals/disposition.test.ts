import { describe, it, expect } from "vitest";
import { parseDisposition, validateDisposition, type Disposition } from "./disposition";

describe("validateDisposition", () => {
  it("accepts unassign", () => {
    const d: Disposition = { kind: "unassign" };
    expect(validateDisposition(d, 5)).toEqual(d);
  });

  it("accepts delete", () => {
    const d: Disposition = { kind: "delete" };
    expect(validateDisposition(d, 5)).toEqual(d);
  });

  it("accepts reassign to a different goal", () => {
    const d: Disposition = { kind: "reassign", targetGoalId: 7 };
    expect(validateDisposition(d, 5)).toEqual(d);
  });

  it("rejects reassign to the goal being deleted", () => {
    const d: Disposition = { kind: "reassign", targetGoalId: 5 };
    expect(() => validateDisposition(d, 5)).toThrow(/itself/);
  });
});

describe("parseDisposition", () => {
  it.each([
    [{ kind: "unassign" }, { kind: "unassign" }],
    [{ kind: "delete", targetGoalId: 4 }, { kind: "delete" }],
    [{ kind: "reassign", targetGoalId: 4 }, { kind: "reassign", targetGoalId: 4 }],
  ])("accepts %j", (raw, expected) => {
    expect(parseDisposition(raw)).toEqual(expected);
  });

  it.each([
    [{ kind: "reassign" }, /targetGoalId/],
    [{ kind: "archive" }, /must be one of/],
    [undefined, /must be one of/],
  ])("rejects %j", (raw, message) => {
    expect(() => parseDisposition(raw)).toThrow(message);
  });
});
