import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { loadTasksAndGoals } from "@/features/planner/queries";
import { buildDigest } from "@/features/planner/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const now = new Date();
  const { tasks, goals } = await loadTasksAndGoals();
  return Response.json(buildDigest(tasks, goals, now));
}
