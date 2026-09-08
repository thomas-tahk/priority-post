import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import {
  setTaskStartAt,
  toggleTaskDone,
  updateTaskTitle,
  deleteTask,
} from "@/features/tasks/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function taskId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const id = await taskId(ctx);
  if (id === null) return new Response("bad task id", { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("invalid json body", { status: 400 });
  }

  if (typeof body.done === "boolean") await toggleTaskDone(id, body.done);
  if (typeof body.title === "string" && body.title.trim()) await updateTaskTitle(id, body.title);
  if ("startAt" in body) {
    if (body.startAt === null) {
      await setTaskStartAt(id, null);
    } else if (typeof body.startAt === "string" && !Number.isNaN(Date.parse(body.startAt))) {
      await setTaskStartAt(id, new Date(body.startAt));
    } else {
      return new Response("invalid startAt", { status: 400 });
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const id = await taskId(ctx);
  if (id === null) return new Response("bad task id", { status: 400 });

  await deleteTask(id);
  return Response.json({ ok: true });
}
