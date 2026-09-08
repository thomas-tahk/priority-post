// Posting to Discord through an incoming webhook.
//
// A webhook needs no application, no bot token, no gateway connection and no
// always-on process to hold one open — which is what lets the whole schedule run
// on a GitHub Actions cron and a Vercel function for nothing a month.

const DISCORD_LIMIT = 2000;

export type PostResult = { ok: true } | { ok: false; reason: string };

/** Post one message. Long content is cut at a line boundary rather than
 * rejected by Discord, because a truncated digest still tells you what to do. */
export async function postToDiscord(content: string): Promise<PostResult> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { ok: false, reason: "DISCORD_WEBHOOK_URL is not configured" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: fit(content) }),
    });
    if (!response.ok) {
      return { ok: false, reason: `Discord returned ${response.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach Discord" };
  }
}

export function fit(content: string): string {
  if (content.length <= DISCORD_LIMIT) return content;
  const cut = content.slice(0, DISCORD_LIMIT - 2);
  const lastBreak = cut.lastIndexOf("\n");
  return `${lastBreak > 0 ? cut.slice(0, lastBreak) : cut}\n…`;
}
