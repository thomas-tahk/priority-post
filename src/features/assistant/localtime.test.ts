import { describe, it, expect } from "vitest";
import { describeNow, utcOffset } from "./localtime";

// Denver is UTC-7 in winter and UTC-6 in summer; the 2026 change is Mar 8.
const WINTER = new Date("2026-01-15T19:30:00Z");
const SUMMER = new Date("2026-07-15T19:30:00Z");

describe("utcOffset", () => {
  it("reports standard time", () => {
    expect(utcOffset(WINTER, "America/Denver")).toBe("-07:00");
  });

  it("reports daylight time for the same zone", () => {
    expect(utcOffset(SUMMER, "America/Denver")).toBe("-06:00");
  });

  it("renders UTC as an explicit zero offset, not a bare label", () => {
    expect(utcOffset(SUMMER, "UTC")).toBe("+00:00");
  });

  it("handles a half-hour zone", () => {
    expect(utcOffset(SUMMER, "Asia/Kolkata")).toBe("+05:30");
  });
});

describe("describeNow", () => {
  it("states the owner's wall clock, zone, and offset", () => {
    const result = describeNow(SUMMER, "America/Denver");

    expect(result).toContain("13:30");
    expect(result).toContain("America/Denver");
    expect(result).toContain("UTC-06:00");
  });

  it("does not leak the process timezone — UTC input, Denver output", () => {
    // 19:30Z is the same instant; only the rendering should differ.
    expect(describeNow(SUMMER, "UTC")).toContain("19:30");
    expect(describeNow(SUMMER, "America/Denver")).not.toContain("19:30");
  });
});
