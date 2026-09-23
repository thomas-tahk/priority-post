const DISCORD_API = "https://discord.com/api/v10";

// Discord truncates at 2000; leave room for the "…" a cut message gets.
const LIMIT = 1900;

/** Replace the "thinking…" placeholder with the real answer.
 *
 * The interaction token authorizes this call, so it carries no bot token — but
 * it expires 15 minutes after the interaction, which is the real deadline the
 * agent runs against. */
export async function editDeferredReply(input: {
  applicationId: string;
  interactionToken: string;
  content: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { applicationId, interactionToken, content, fetchImpl = fetch } = input;
  const url = `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  try {
    const res = await fetchImpl(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: fit(content) }),
    });
    if (!res.ok) return { ok: false, reason: `Discord returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach Discord" };
  }
}

/** Cut at a line boundary rather than mid-word. A truncated answer still tells
 * you what happened; a rejected one tells you nothing. */
export function fit(content: string): string {
  const text = content.trim() || "(no reply)";
  if (text.length <= LIMIT) return text;

  const cut = text.slice(0, LIMIT - 1);
  const lastBreak = cut.lastIndexOf("\n");
  return `${lastBreak > 0 ? cut.slice(0, lastBreak) : cut}…`;
}
