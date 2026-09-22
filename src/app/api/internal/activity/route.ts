import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { recordActivity } from "@/features/planner/queries";
import { parseActivity } from "@/features/activity/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The lead assistant's only write path. It runs as a Claude Code cloud routine
// and reports here; the evening digest carries what it wrote.
export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const parsed = parseActivity(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });

  const row = await recordActivity(parsed.entry);
  return Response.json(row, { status: 201 });
}
