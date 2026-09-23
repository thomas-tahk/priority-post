// Discord interaction payloads, narrowed to the parts this endpoint reads.
// https://discord.com/developers/docs/interactions/receiving-and-responding

export const InteractionType = { Ping: 1, ApplicationCommand: 2 } as const;
export const ResponseType = { Pong: 1, Message: 4, Deferred: 5 } as const;

/** Only the owner may see or move the owner's tasks, so a refusal is ephemeral
 * — visible to whoever tried, not posted into the channel. */
const EPHEMERAL = 64;

export type Interaction = {
  type: number;
  data?: { name?: string; options?: { name?: string; value?: unknown }[] };
  member?: { user?: { id?: string } };
  user?: { id?: string };
};

export type Decision =
  | { kind: "pong" }
  | { kind: "reject"; reason: string }
  | { kind: "reply"; text: string; ephemeral: boolean }
  | { kind: "run"; prompt: string }
  | { kind: "reset" };

/** The user id, wherever this interaction came from. A command run in a server
 * carries `member.user`; the same command in a DM carries `user`. */
export function invokerId(interaction: Interaction): string | undefined {
  return interaction.member?.user?.id ?? interaction.user?.id;
}

function optionText(interaction: Interaction): string {
  const raw = interaction.data?.options?.find((o) => o.name === "message")?.value;
  return typeof raw === "string" ? raw.trim() : "";
}

/** What to do with a verified interaction. Pure — the route does the I/O.
 *
 * The owner check is not decoration. This endpoint is a public URL on the
 * internet, and a signature only proves Discord sent the request, not that the
 * right person typed it. Anyone who can reach the app through Discord would
 * otherwise be able to read and delete the owner's tasks. */
export function decideInteraction(interaction: Interaction, ownerId: string | undefined): Decision {
  if (interaction.type === InteractionType.Ping) return { kind: "pong" };

  if (interaction.type !== InteractionType.ApplicationCommand) {
    return { kind: "reject", reason: `unsupported interaction type ${interaction.type}` };
  }

  if (!ownerId) return { kind: "reject", reason: "OWNER_DISCORD_ID is not configured" };

  if (invokerId(interaction) !== ownerId) {
    return { kind: "reply", text: "This planner only answers to its owner.", ephemeral: true };
  }

  const prompt = optionText(interaction);
  if (prompt.toLowerCase() === "reset") return { kind: "reset" };
  if (!prompt) {
    return {
      kind: "reply",
      text: "Say something after the command — e.g. `/pp what's next?` or `/pp add: call the dentist friday 3pm`.",
      ephemeral: true,
    };
  }

  return { kind: "run", prompt };
}

/** The JSON body for a decision that answers immediately. */
export function immediateBody(decision: Decision): Record<string, unknown> | null {
  switch (decision.kind) {
    case "pong":
      return { type: ResponseType.Pong };
    case "reply":
      return {
        type: ResponseType.Message,
        data: { content: decision.text, ...(decision.ephemeral ? { flags: EPHEMERAL } : {}) },
      };
    case "run":
    case "reset":
      // Deferred: Discord needs an answer within 3 seconds and the agent takes
      // longer than that. This shows "thinking…" and opens a 15-minute window
      // to edit the message with the real reply.
      return { type: ResponseType.Deferred };
    case "reject":
      return null;
  }
}
