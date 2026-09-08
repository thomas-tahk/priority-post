import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { loadTasksAndGoals } from "@/features/planner/queries";
import { toCompact } from "@/features/planner/digest";
import { sortByScore } from "@/features/tasks/scorer";
import { createTask } from "@/features/tasks/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const now = new Date();
  const { tasks } = await loadTasksAndGoals();
  const open = tasks.filter((t) => t.doneAt === null);
  const ranked = sortByScore(open, now).map((t) => toCompact(t, now));
  return Response.json({ tasks: ranked });
}

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response("invalid json body", { status: 400 });
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    return new Response("title is required", { status: 400 });
  }

  const startAt =
    typeof body.startAt === "string" && !Number.isNaN(Date.parse(body.startAt))
      ? new Date(body.startAt)
      : null;
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c): c is string => typeof c === "string")
    : undefined;
  const goalId = typeof body.goalId === "number" ? body.goalId : null;

  const created = await createTask({ title: body.title, categories, goalId, startAt });
  if (!created) return new Response("could not create task", { status: 400 });
  return Response.json({ id: created.id });
}
