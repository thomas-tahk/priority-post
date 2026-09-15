import { describe, it, expect } from "vitest";
import { decideTick, missedDigestDays } from "./tick";

const TZ = "America/Denver";
const schedule = { digestHour: 20, digestMinute: 0, activeStartHour: 16, activeEndHour: 22 };

// 2026-09-07T23:00:00Z = 17:00 Denver — evening, before the digest hour.
const BEFORE = new Date("2026-09-07T23:00:00Z");
// 2026-09-08T02:00:00Z = 20:00 Denver — the digest hour itself.
const AT = new Date("2026-09-08T02:00:00Z");
// 2026-09-08T04:00:00Z = 22:00 Denver — two hours late, outside active hours.
const LATE = new Date("2026-09-08T04:00:00Z");
// 2026-09-07T17:00:00Z = 11:00 Denver — daytime.
const MORNING = new Date("2026-09-07T17:00:00Z");

describe("deciding what an hourly tick should do", () => {
  it("sends the digest once the hour has passed and today's has not gone out", () => {
    const decision = decideTick({ now: AT, timezone: TZ, schedule, lastDigestDay: null });

    expect(decision.sendDigest).toBe(true);
    expect(decision.digestDay).toBe("2026-09-07");
  });

  it("still sends it hours late rather than never", () => {
    // The whole reason the tick asks "has today's gone out?" instead of "is it
    // 20:00?": a runner that skips the 20:00 tick must not skip the day.
    const decision = decideTick({ now: LATE, timezone: TZ, schedule, lastDigestDay: null });

    expect(decision.sendDigest).toBe(true);
  });

  it("does not send it twice on the same day", () => {
    const decision = decideTick({ now: LATE, timezone: TZ, schedule, lastDigestDay: "2026-09-07" });

    expect(decision.sendDigest).toBe(false);
  });

  it("does not send today's before the hour arrives", () => {
    // Yesterday's went out last night, so nothing is owed until 20:00.
    const decision = decideTick({ now: BEFORE, timezone: TZ, schedule, lastDigestDay: "2026-09-06" });

    expect(decision.sendDigest).toBe(false);
  });

  it("sends again the next day once the day has turned in the user's zone", () => {
    const decision = decideTick({ now: AT, timezone: TZ, schedule, lastDigestDay: "2026-09-06" });

    expect(decision.sendDigest).toBe(true);
  });

  it("respects the minute, not just the hour", () => {
    const at1945 = new Date("2026-09-08T01:45:00Z"); // 19:45 Denver
    const late = { ...schedule, digestHour: 19, digestMinute: 50 };

    const decision = decideTick({ now: at1945, timezone: TZ, schedule: late, lastDigestDay: "2026-09-06" });

    expect(decision.sendDigest).toBe(false);
  });
});

// The bug this guards: for four days running, the only tick GitHub actually ran
// after the digest hour landed after midnight. The old rule asked "has TODAY's
// gone out?", today had only just begun, and the evening it had missed was
// dropped on the floor. Nothing failed, so nothing said so.
describe("an evening the scheduler skipped", () => {
  // 2026-09-08T07:45:00Z = 01:45 Denver on the 8th — the first tick to run
  // since 19:28 the previous evening.
  const AFTER_MIDNIGHT = new Date("2026-09-08T07:45:00Z");

  it("is still delivered by the first tick after midnight", () => {
    const decision = decideTick({ now: AFTER_MIDNIGHT, timezone: TZ, schedule, lastDigestDay: "2026-09-06" });

    expect(decision.sendDigest).toBe(true);
    expect(decision.digestDay).toBe("2026-09-07");
  });

  it("is not sent twice when a later tick runs the same morning", () => {
    const decision = decideTick({ now: AFTER_MIDNIGHT, timezone: TZ, schedule, lastDigestDay: "2026-09-07" });

    expect(decision.sendDigest).toBe(false);
  });

  it("does not fire once per skipped day when several were missed", () => {
    // Four evenings lost. One catch-up message goes out, not four.
    const decision = decideTick({ now: AFTER_MIDNIGHT, timezone: TZ, schedule, lastDigestDay: "2026-09-03" });

    expect(decision.sendDigest).toBe(true);
    expect(decision.digestDay).toBe("2026-09-07");
  });

  it("counts the evenings that went missing so the digest can say so", () => {
    expect(missedDigestDays("2026-09-06", "2026-09-07")).toBe(0);
    expect(missedDigestDays("2026-09-03", "2026-09-07")).toBe(3);
    expect(missedDigestDays(null, "2026-09-07")).toBe(0);
  });

  it("crosses a month boundary without arithmetic on the day number", () => {
    const firstOfOctober = new Date("2026-10-01T07:45:00Z"); // 01:45 Denver, Oct 1

    const decision = decideTick({ now: firstOfOctober, timezone: TZ, schedule, lastDigestDay: "2026-09-29" });

    expect(decision.digestDay).toBe("2026-09-30");
    expect(decision.sendDigest).toBe(true);
  });
});

describe("due-soon pings", () => {
  it("are allowed inside the active window", () => {
    expect(decideTick({ now: BEFORE, timezone: TZ, schedule, lastDigestDay: null }).sendDueSoon).toBe(true);
  });

  it("are dropped outside it rather than queued for later", () => {
    expect(decideTick({ now: MORNING, timezone: TZ, schedule, lastDigestDay: null }).sendDueSoon).toBe(false);
  });
});
