import { parseInbox } from "./inbox";
import type { InboxResult } from "./types";

const HUB = "thomas-tahk/foundry";
const PATH = "inbox/inbox.json";

// The list must stop showing work the moment it stops needing the user, but it
// is read on every render of the page. A minute is short enough that acting on
// an item clears it while you are still looking at the screen.
const CACHE_SECONDS = 60;

/** Fetch the factory's published inbox. Never throws — the band renders the
 * reason instead, because a silent empty list is indistinguishable from a
 * finished factory. */
export async function fetchInbox(): Promise<InboxResult> {
  // The hub is a public repo, so reading needs no credential. Only acting on an
  // item does. Reading without one means the list works before anything is set up.
  const token = process.env.GITHUB_TOKEN;

  try {
    const response = await fetch(`https://api.github.com/repos/${HUB}/contents/${PATH}`, {
      headers: {
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: CACHE_SECONDS },
    });

    if (response.status === 404) {
      return { ok: false, reason: "The factory hasn't published an inbox yet." };
    }
    if (!response.ok) {
      return { ok: false, reason: `GitHub returned ${response.status} for the factory's inbox.` };
    }

    return parseInbox(await response.json());
  } catch {
    return { ok: false, reason: "The factory's inbox couldn't be reached." };
  }
}
