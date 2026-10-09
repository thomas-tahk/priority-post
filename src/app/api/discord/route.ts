import { after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "@/features/assistant/agent";
import { DbPlannerApi } from "@/features/assistant/dbApi";
import { trimHistory } from "@/features/assistant/history";
import { appendExchange, clearTurns, loadTurns } from "@/features/assistant/queries";
import { editDeferredReply } from "@/features/assistant/followup";
import {
  decideInteraction,
  immediateBody,
  ResponseType,
  type Decision,
  type Interaction,
} from "@/features/assistant/interaction";
import { verifySignature } from "@/features/assistant/verify";
import { appTimezone } from "@/features/planner/clock";
import { applyCheckIn } from "@/features/checkin/apply";
import { answeredRows, type Row } from "@/features/checkin/components";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The agent is a few model round-trips; Hobby allows 300s and the interaction
// token stays valid for 15 minutes, so this is the binding limit, not Discord.
export const maxDuration = 300;

/** Discord's interactions endpoint.
 *
 * Replaces the gateway bot: there is no process to keep alive, so the planner
 * answers whenever it is asked rather than whenever a container happens to be
 * up. Proactive messages still come from the hourly tick. */
export async function POST(req: Request) {
  // Must be the exact bytes Discord signed — parsing and re-serializing changes
  // the whitespace and invalidates every signature.
  const rawBody = await req.text();

  const verified = verifySignature({
    rawBody,
    signature: req.headers.get("x-signature-ed25519"),
    timestamp: req.headers.get("x-signature-timestamp"),
    publicKeyHex: process.env.DISCORD_PUBLIC_KEY,
  });
  // Discord probes with bad signatures when saving the URL and requires a 401.
  if (!verified) return new Response("invalid request signature", { status: 401 });

  let interaction: Interaction;
  try {
    interaction = JSON.parse(rawBody) as Interaction;
  } catch {
    return new Response("malformed payload", { status: 400 });
  }

  const decision = decideInteraction(interaction, process.env.OWNER_DISCORD_ID);
  if (decision.kind === "checkin") return Response.json(await answerCheckIn(decision, interaction));
  const body = immediateBody(decision);
  if (!body) {
    return Response.json({ error: (decision as { reason: string }).reason }, { status: 400 });
  }

  // Acknowledge inside Discord's three seconds, then keep working. `after`
  // holds the function alive past the response instead of freezing it.
  if (decision.kind === "run" || decision.kind === "reset") {
    const token = (interaction as { token?: string }).token;
    const applicationId =
      (interaction as { application_id?: string }).application_id ?? process.env.DISCORD_APP_ID;

    if (token && applicationId) {
      after(() => respond(decision, applicationId, token));
    }
  }

  return Response.json(body);
}

/** The slow half: run the agent, then edit the placeholder into the answer.
 *
 * Every failure still produces a message. A deferred interaction that is never
 * edited shows "thinking…" forever, which is indistinguishable from the app
 * being down — so an error the owner can read beats a clean log line. */
async function respond(decision: Decision, applicationId: string, token: string): Promise<void> {
  const content = await produce(decision).catch(
    (error: unknown) => `⚠️ ${error instanceof Error ? error.message : "The planner hit an error."}`,
  );

  const sent = await editDeferredReply({ applicationId, interactionToken: token, content });
  if (!sent.ok) console.error("discord follow-up failed:", sent.reason);
}

async function produce(decision: Decision): Promise<string> {
  if (decision.kind === "reset") {
    const cleared = await clearTurns();
    return `🧹 Forgot the last ${cleared} ${cleared === 1 ? "line" : "lines"} of our conversation.`;
  }
  if (decision.kind !== "run") return "(nothing to do)";

  // Direct DB access, not a fetch to our own deployment: see dbApi.ts.
  const api = new DbPlannerApi();
  const anthropic = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });

  const history = await loadTurns();
  const { reply, messages } = await runAgent(
    [...history, { role: "user", content: decision.prompt }],
    api,
    anthropic,
    { now: new Date(), timezone: appTimezone() },
  );

  // Store the trimmed plain-text view, not the tool-use transcript: it is what
  // the next turn would have been given anyway, and it cannot leave a dangling
  // tool_use/tool_result pair behind.
  const trimmed = trimHistory(messages);
  const lastReply = trimmed[trimmed.length - 1];
  await appendExchange(
    decision.prompt,
    lastReply?.role === "assistant" ? String(lastReply.content) : reply,
  );

  return reply;
}

/** A check-in tap: write it, then redraw the digest with that task's row
 *  collapsed into what happened. One DB write fits inside Discord's 3 seconds,
 *  so this answers synchronously — the owner sees the result, not a spinner. */
async function answerCheckIn(
  decision: Extract<Decision, { kind: "checkin" }>,
  interaction: Interaction,
): Promise<Record<string, unknown>> {
  const title = await applyCheckIn(decision, { now: new Date(), timezone: appTimezone() });
  const rows = (interaction.message?.components ?? []) as Row[];
  const label = title ?? "already gone from the app";
  return {
    type: ResponseType.UpdateMessage,
    data: { components: answeredRows(rows, decision.taskId, decision.action, label) },
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
