import { describe, it, expect } from "vitest";
import type { Task } from "@/db/schema";
import { customId, parseCustomId, pickCheckIn, tomorrowFor } from "./checkin";
import { answeredRows, checkInRows } from "./components";

const TZ = "America/Denver";
const NOW = new Date("2026-10-09T00:30:00Z"); // Thursday 18:30 Denver

function task(id: number, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `task ${id}`,
    doneAt: null,
    startAt: null,
    checkedAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...over,
  } as Task;
}

describe("pickCheckIn", () => {
  it("asks about today's and overdue scheduled tasks first, earliest first", () => {
    const tasks = [
      task(1),
      task(2, { startAt: new Date("2026-10-08T20:00:00Z") }), // today 14:00
      task(3, { startAt: new Date("2026-10-05T20:00:00Z") }), // overdue
    ];

    expect(pickCheckIn(tasks, NOW, TZ).map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it("leaves out tasks scheduled after today", () => {
    const tasks = [task(1, { startAt: new Date("2026-10-09T15:00:00Z") })]; // tomorrow 09:00

    expect(pickCheckIn(tasks, NOW, TZ)).toEqual([]);
  });

  it("asks about unscheduled tasks only after a quiet week, least recently asked first", () => {
    const tasks = [
      task(1, { checkedAt: new Date("2026-10-05T00:00:00Z") }), // asked 4 days ago
      task(2, { checkedAt: new Date("2026-09-20T00:00:00Z") }),
      task(3, { createdAt: new Date("2026-10-07T00:00:00Z") }), // new
      task(4, { createdAt: new Date("2026-09-10T00:00:00Z") }),
    ];

    expect(pickCheckIn(tasks, NOW, TZ).map((t) => t.id)).toEqual([4, 2]);
  });

  it("skips finished tasks and caps the list at five", () => {
    const tasks = [task(1, { doneAt: new Date() }), ...[2, 3, 4, 5, 6, 7].map((id) => task(id))];

    expect(pickCheckIn(tasks, NOW, TZ).map((t) => t.id)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("tomorrowFor", () => {
  it("keeps a scheduled task's time of day, counted from today", () => {
    const late = { startAt: new Date("2026-10-05T21:30:00Z") }; // Mon 15:30, three days late

    expect(tomorrowFor(late, NOW, TZ).toISOString()).toBe("2026-10-09T21:30:00.000Z");
  });

  it("puts an unscheduled task at 9am tomorrow", () => {
    expect(tomorrowFor({ startAt: null }, NOW, TZ).toISOString()).toBe("2026-10-09T15:00:00.000Z");
  });
});

describe("custom ids", () => {
  it("round-trips", () => {
    expect(parseCustomId(customId("tomorrow", 42))).toEqual({ action: "tomorrow", taskId: 42 });
  });

  it.each(["checkin:explode:1", "checkin:done:abc", "other:done:1", undefined])("rejects %s", (raw) => {
    expect(parseCustomId(raw)).toBeNull();
  });
});

describe("check-in rows", () => {
  it("collapses only the tapped task's row into a disabled answer", () => {
    const rows = checkInRows([{ id: 1, title: "File taxes" }, { id: 2, title: "Gym" }]);

    const after = answeredRows(rows, 1, "done", "File taxes");

    expect(after[0].components).toEqual([expect.objectContaining({ label: "✅ Done · File taxes", disabled: true })]);
    expect(after[1]).toEqual(rows[1]);
  });

  it("does not mistake task 1 for task 11", () => {
    const rows = checkInRows([{ id: 11, title: "Eleven" }]);

    expect(answeredRows(rows, 1, "drop", "One")).toEqual(rows);
  });

  it("fits a long title into Discord's 80-character label limit", () => {
    const [row] = checkInRows([{ id: 1, title: "x".repeat(200) }]);

    expect(row.components[0].label.length).toBe(80);
  });
});
