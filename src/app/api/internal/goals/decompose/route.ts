import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { getGoal } from "@/features/planner/queries";
import { decomposeGoal } from "@/features/planner/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proposes sub-tasks for a goal. Nothing is created — the bot offers the list and
// the user accepts (a follow-up add). Accepts an existing goalId, or an ad-hoc
// { name, description } so "break down 'launch the newsletter'" works without a goal row.
export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("invalid json body", { status: 400 });
  }

  let goal;
  if (typeof body.goalId === "number") {
    goal = await getGoal(body.goalId);
    if (!goal) return new Response("goal not found", { status: 404 });
  } else if (typeof body.name === "string" && body.name.trim()) {
    goal = {
      id: -1,
      name: body.name.trim(),
      description: typeof body.description === "string" ? body.description : null,
      color: "other",
      createdAt: new Date(),
    };
  } else {
    return new Response("goalId or name required", { status: 400 });
  }

  const proposals = await decomposeGoal(goal);
  return Response.json({ proposals });
}
