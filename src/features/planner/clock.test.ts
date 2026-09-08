import { describe, it, expect } from "vitest";
import { dayKeyIn, hourIn, isWithinActiveHours, minuteIn } from "./clock";

// 2026-09-07T23:30:00Z is 17:30 in Denver (MDT, UTC-6) and 16:30 in Los Angeles.
const EVENING = new Date("2026-09-07T23:30:00Z");
// 2026-09-08T04:30:00Z is still 2026-09-07 at 22:30 in Denver.
const LATE = new Date("2026-09-08T04:30:00Z");

describe("reading the clock in a named zone", () => {
  it("reads the hour in the zone it is given, not the one it runs in", () => {
    expect(hourIn(EVENING, "America/Denver")).toBe(17);
    expect(hourIn(EVENING, "America/Los_Angeles")).toBe(16);
    expect(hourIn(EVENING, "UTC")).toBe(23);
  });

  it("reads the minute", () => {
    expect(minuteIn(EVENING, "America/Denver")).toBe(30);
  });

  it("knows which calendar day it is for the user, not for the runner", () => {
    expect(dayKeyIn(LATE, "America/Denver")).toBe("2026-09-07");
    expect(dayKeyIn(LATE, "UTC")).toBe("2026-09-08");
  });
});

describe("the window pings are allowed in", () => {
  const window = { startHour: 16, endHour: 22 };

  it("allows an evening inside the window", () => {
    expect(isWithinActiveHours(EVENING, window, "America/Denver")).toBe(true);
  });

  it("refuses the same instant read in a zone where it is not evening yet", () => {
    expect(isWithinActiveHours(EVENING, { startHour: 20, endHour: 22 }, "America/Denver")).toBe(false);
  });

  it("wraps midnight when the start is after the end", () => {
    const night = new Date("2026-09-08T05:30:00Z"); // 23:30 Denver
    expect(isWithinActiveHours(night, { startHour: 22, endHour: 6 }, "America/Denver")).toBe(true);
  });

  it("treats equal bounds as no quiet hours rather than silence forever", () => {
    expect(isWithinActiveHours(EVENING, { startHour: 9, endHour: 9 }, "America/Denver")).toBe(true);
  });
});
