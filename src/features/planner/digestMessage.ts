import type { Digest } from "./digest";
import type { FoundryItem } from "@/features/foundry/types";
import type { Gate, Track } from "@/features/goals/objectives";
import type { ActivityEntry } from "@/features/activity/parse";

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

function gateLine(g: Gate): string {
  const left =
    g.daysLeft === 0 ? "**today**" : g.daysLeft === 1 ? "**tomorrow**" : `in **${g.daysLeft} days**`;
  return `• ${g.name} — ${left}`;
}

/** A track's week, said flatly. No streak, no nudge, no exclamation.
 *
 * The number is the whole message. He slides past applications and the pressure
 * he responds to is external and real, which a formatted reminder is not — so
 * dressing the number up buys nothing and costs the line its credibility. */
function trackLine(t: Track): string {
  if (t.weekly === null) return `• ${t.name}${t.milestone ? ` — ${t.milestone}` : ""}`;
  const { done, target } = t.weekly;
  return `• ${t.name} — **${done} of ${target}** this week`;
}

function activityLine(a: ActivityEntry): string {
  return `• ${a.summary} _— ${a.actor}_`;
}

export type Objectives = { gates: Gate[]; tracks: Track[] };

/** The evening message: the dates first, then your own work, then the factory.
 *
 * Gates lead because they are the only things here whose date he did not
 * choose. The factory goes last on purpose: it produces items on its own
 * schedule, and a list that leads with machine output stops reading as his. */
export function formatEveningDigest(input: {
  digest: Digest;
  objectives?: Objectives;
  activity?: ActivityEntry[];
  factory?: FoundryItem[];
  missedDays?: number;
}): string {
  const { digest, objectives, activity = [], factory = [], missedDays = 0 } = input;
  const parts: string[] = ["🌆 **Evening. Here's tonight.**"];

  if (objectives && objectives.gates.length > 0) {
    parts.push("\n__Dates you did not set__\n" + objectives.gates.map(gateLine).join("\n"));
  }

  // A channel that has been quiet because the scheduler dropped its runs looks
  // exactly like a channel with nothing to say. Say which one it was.
  if (missedDays > 0) {
    const evenings = missedDays === 1 ? "evening" : "evenings";
    parts.push(`\n⚠️ _No digest for the last ${missedDays} ${evenings} — the scheduler dropped those runs._`);
  }

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
  // A track with neither a weekly number nor a milestone renders as its own
  // bare name, which says nothing and pushes the lines that do say something
  // off the top of a phone screen. Those tracks stay in the app; they just
  // have nothing to report until he gives them one.
  const reporting = objectives?.tracks.filter((t) => t.weekly !== null || t.milestone !== null) ?? [];
  if (reporting.length > 0) {
    parts.push("\n__This week__\n" + reporting.map(trackLine).join("\n"));
  }
  if (activity.length > 0) {
    parts.push("\n__What the assistant did__\n" + activity.map(activityLine).join("\n"));
  }
  if (factory.length > 0) {
    parts.push("\n__The factory needs you__\n" + factory.map(factoryLine).join("\n"));
  }

  return parts.join("\n");
}
