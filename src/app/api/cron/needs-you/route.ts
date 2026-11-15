import { NextRequest } from "next/server";
import { listOpenItems } from "@/features/github/queries";
import { buildNudge } from "@/features/github/nudge";
import { postToDiscord } from "@/features/planner/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called once a day by Vercel Cron (vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET"; anyone else is refused.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const message = buildNudge(await listOpenItems(), new Date());
  if (!message) return Response.json({ sent: false, reason: "nothing new" });

  const posted = await postToDiscord(message);
  if (!posted.ok) return Response.json({ sent: false, reason: posted.reason }, { status: 502 });
  return Response.json({ sent: true, message });
}
