import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { markReminderSent } from "@/features/planner/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(["due_soon", "overdue"]);

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("invalid json body", { status: 400 });
  }

  if (typeof body.taskId !== "number" || typeof body.kind !== "string" || !KINDS.has(body.kind)) {
    return new Response("taskId (number) and kind (due_soon|overdue) required", { status: 400 });
  }

  await markReminderSent(body.taskId, body.kind);
  return Response.json({ ok: true });
}
