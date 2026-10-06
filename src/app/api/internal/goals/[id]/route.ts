import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { DbPlannerApi } from "@/features/assistant/dbApi";
import { parseDisposition } from "@/features/goals/disposition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const planner = new DbPlannerApi();

async function goalId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function jsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const id = await goalId(ctx);
  if (id === null) return new Response("bad goal id", { status: 400 });
  const body = await jsonBody(req);
  if (!body) return new Response("invalid json body", { status: 400 });

  try {
    await planner.updateGoal(id, body);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "invalid goal", { status: 400 });
  }
  return Response.json({ ok: true });
}

// The body is the disposition: what happens to the goal's tasks. Required —
// deleting a goal never silently decides that.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const id = await goalId(ctx);
  if (id === null) return new Response("bad goal id", { status: 400 });
  const body = await jsonBody(req);
  if (!body) return new Response("invalid json body", { status: 400 });

  try {
    await planner.deleteGoal(id, parseDisposition(body));
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "invalid disposition", { status: 400 });
  }
  return Response.json({ ok: true });
}
