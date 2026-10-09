import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { DbPlannerApi } from "@/features/assistant/dbApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same logic as the Discord assistant: both go through DbPlannerApi, so the
// REPL and /pp cannot drift apart on validation.
const planner = new DbPlannerApi();

export async function GET(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  return Response.json({ goals: await planner.listGoals() });
}

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("invalid json body", { status: 400 });
  }

  try {
    return Response.json(await planner.createGoal(body));
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "invalid goal", { status: 400 });
  }
}
