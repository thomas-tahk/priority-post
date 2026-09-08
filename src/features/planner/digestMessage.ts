import type { Digest } from "./digest";
import type { FoundryItem } from "@/features/foundry/types";

// The digest as a person reads it on a phone. The bot has its own copy of this
// for the chat path; this one is the web app's, and it is the only one that
// knows about the factory.

function taskLine(t: { title: string; startAt: string | null }): string {
  const when = t.startAt ? ` · <t:${Math.floor(Date.parse(t.startAt) / 1000)}:R>` : "";
  return `• **${t.title}**${when}`;
}

const FACTORY_HEADING: Record<FoundryItem["state"], string> = {
  build_failing: "🔴",
  waiting_on_you: "🏭",
  draft_ready: "📄",
  branch_stranded: "🌱",
};

function factoryLine(item: FoundryItem): string {
  const repo = item.repo.includes("/") ? item.repo.split("/")[1] : item.repo;
  return `${FACTORY_HEADING[item.state]} **${item.summary}** — ${repo}`;
}

/** The evening message: your own work first, then what the factory needs.
 *
 * The factory goes second on purpose. It is the thing that produces items on
 * its own schedule, and a list that leads with machine output stops reading as
 * your list. */
export function formatEveningDigest(digest: Digest, factory: FoundryItem[]): string {
  const parts: string[] = ["🌆 **Evening. Here's tonight.**"];

  if (digest.top.length === 0) parts.push("\nNo open tasks — add one and I'll triage it.");
  else parts.push("\n__Worth doing tonight__\n" + digest.top.map(taskLine).join("\n"));

  if (digest.overdueTasks.length > 0) {
    parts.push("\n__Slipped today__\n" + digest.overdueTasks.map(taskLine).join("\n"));
  }
  if (digest.idleGoals.length > 0) {
    parts.push(
      "\n__Idle goals__\n" +
        digest.idleGoals.map((g) => `• **${g.name}** — quiet for ${g.idleDays}d`).join("\n"),
    );
  }
  if (factory.length > 0) {
    parts.push("\n__The factory needs you__\n" + factory.map(factoryLine).join("\n"));
  }

  return parts.join("\n");
}
