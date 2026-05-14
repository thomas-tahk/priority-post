import { NextRequest } from "next/server";
import { listTasks } from "@/features/tasks/queries";
import { sortByScore } from "@/features/tasks/scorer";
import {
  streamWhyThisOrder,
  streamAskAITask,
} from "@/features/explain/explain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body =
  | { kind: "why" }
  | { kind: "task"; taskId: number };

function validate(body: unknown): Body | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.kind === "why") return { kind: "why" };
  if (b.kind === "task") {
    if (typeof b.taskId !== "number" || !Number.isFinite(b.taskId)) return null;
    return { kind: "task", taskId: b.taskId };
  }
  return null;
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response("invalid json body", { status: 400 });
  }
  const body = validate(raw);
  if (!body) return new Response("invalid request", { status: 400 });

  const all = await listTasks();
  const now = new Date();
  const open = all.filter((t) => t.doneAt === null);
  const ranked = sortByScore(open, now);

  const iter =
    body.kind === "why"
      ? streamWhyThisOrder(ranked, now)
      : streamAskAITask(ranked, body.taskId, now);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iter) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "stream failed";
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
