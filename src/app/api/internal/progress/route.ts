import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { loadTasksAndGoals } from "@/features/planner/queries";
import { buildProgressStats } from "@/features/planner/digest";
import { summarizeProgress } from "@/features/planner/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const days = clampDays(Number(new URL(req.url).searchParams.get("days")));
  const now = new Date();
  const { tasks, goals } = await loadTasksAndGoals();
  const stats = buildProgressStats(tasks, goals, now, days);
  const summary = await summarizeProgress(stats);
  return Response.json({ summary, stats });
}

function clampDays(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(Math.round(n), 30);
}
