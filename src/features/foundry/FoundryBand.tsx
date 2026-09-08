"use client";

import { useState } from "react";
import { FoundryIntake } from "./FoundryIntake";
import { FoundryStrip } from "./FoundryStrip";
import type { InboxResult } from "./types";

/** The factory's work, sitting among the day's tasks rather than in a section
 * of its own. A block below the list is easy to never scroll to, which is the
 * problem this is meant to fix. Only one item is open at a time. */
export function FoundryBand({ inbox }: { inbox: InboxResult }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!inbox.ok) {
    return (
      <p className="foundry-unavailable">
        {inbox.reason}{" "}
        <a href="https://github.com/thomas-tahk/foundry/blob/main/inbox/inbox.json" target="_blank" rel="noreferrer">
          Look at it on GitHub
        </a>
      </p>
    );
  }

  return (
    <>
      {inbox.items.map((item) => (
        <FoundryStrip
          key={item.id}
          item={item}
          open={openId === item.id}
          onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
        />
      ))}
      <FoundryIntake projects={inbox.projects} />
    </>
  );
}
