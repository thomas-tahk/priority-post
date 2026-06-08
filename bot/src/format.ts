// Pure formatters: API JSON → Discord message text. No I/O, so unit-testable.
import type { CompactTask, Digest, DueEvent } from "./api.js";

function line(t: CompactTask): string {
  const when = t.startAt ? ` · <t:${Math.floor(Date.parse(t.startAt) / 1000)}:R>` : "";
  return `• **${t.title}**${when}`;
}

export function formatDigest(d: Digest): string {
  const parts: string[] = ["☀️ **Morning. Here's today.**"];

  if (d.top.length === 0) parts.push("\nNo open tasks — add one and I'll triage it.");
  else parts.push("\n__Top focus__\n" + d.top.map(line).join("\n"));

  if (d.overdueTasks.length > 0) {
    parts.push("\n__Slipping__\n" + d.overdueTasks.map(line).join("\n"));
  }
  if (d.idleGoals.length > 0) {
    parts.push(
      "\n__Idle goals__\n" +
        d.idleGoals.map((g) => `• **${g.name}** — quiet for ${g.idleDays}d`).join("\n")
    );
  }
  parts.push("\nReply if you want to replan, add something, or break a goal down.");
  return parts.join("\n");
}

export function formatDueEvent(e: DueEvent): string {
  return e.kind === "due_soon"
    ? `⏳ **${e.task.title}** is coming up <t:${ts(e.task.startAt)}:R>.`
    : `🔴 **${e.task.title}** just slipped past its time. Still on?`;
}

function ts(iso: string | null): number {
  return iso ? Math.floor(Date.parse(iso) / 1000) : 0;
}
