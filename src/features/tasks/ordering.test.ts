import { describe, it, expect } from "vitest";
import { midpoint } from "./ordering";

describe("midpoint", () => {
  it("averages two positions", () => {
    expect(midpoint(2, 4)).toBe(3);
  });
  it("goes after when only prev is given", () => {
    expect(midpoint(5, null)).toBe(6);
  });
  it("goes before when only next is given", () => {
    expect(midpoint(null, 5)).toBe(4);
  });
  it("returns 0 for an empty list (no neighbors)", () => {
    expect(midpoint(null, null)).toBe(0);
  });
});
