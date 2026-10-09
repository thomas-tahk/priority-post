// Discord message components for the check-in: one row of buttons per task.
// https://discord.com/developers/docs/components/reference
import { customId, type CheckInAction } from "./checkin";

const ActionRow = 1;
const Button = 2;
const Style = { Secondary: 2, Success: 3, Danger: 4 } as const;
const LABEL_LIMIT = 80; // Discord rejects longer button labels

export type ButtonComponent = {
  type: typeof Button;
  style: number;
  label: string;
  custom_id: string;
  disabled?: boolean;
};
export type Row = { type: typeof ActionRow; components: ButtonComponent[] };

const OUTCOME: Record<CheckInAction, string> = {
  done: "✅ Done",
  tomorrow: "➡️ Tomorrow",
  keep: "👍 Still on",
  drop: "🗑 Dropped",
};

/** The task's title rides on its first button — a row of bare icons would not
 *  say which task it is about. */
export function checkInRows(tasks: { id: number; title: string }[]): Row[] {
  return tasks.map((t) => ({
    type: ActionRow,
    components: [
      button(Style.Success, `✅ ${t.title}`, customId("done", t.id)),
      button(Style.Secondary, "➡️ Tomorrow", customId("tomorrow", t.id)),
      button(Style.Secondary, "👍 Still on", customId("keep", t.id)),
      button(Style.Danger, "🗑", customId("drop", t.id)),
    ],
  }));
}

/** The message after a tap: that task's row collapses into one disabled button
 *  saying what happened, so the answer stays on screen and can't be tapped twice. */
export function answeredRows(rows: Row[], taskId: number, action: CheckInAction, title: string): Row[] {
  return rows.map((row) => {
    if (!row.components.some((b) => b.custom_id.endsWith(`:${taskId}`))) return row;
    return {
      type: ActionRow,
      components: [{ ...button(Style.Secondary, `${OUTCOME[action]} · ${title}`, customId(action, taskId)), disabled: true }],
    };
  });
}

function button(style: number, label: string, id: string): ButtonComponent {
  const fitted = label.length <= LABEL_LIMIT ? label : `${label.slice(0, LABEL_LIMIT - 1)}…`;
  return { type: Button, style, label: fitted, custom_id: id };
}
