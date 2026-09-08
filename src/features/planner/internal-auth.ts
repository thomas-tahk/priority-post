import type { NextRequest } from "next/server";

// Shared-secret gate for /api/internal/* — the Discord bot is the only caller.
// Separate from the app's basic-auth UI gate. Returns an error Response when the
// secret is missing or wrong, or null when the request may proceed.
export function requireInternalSecret(req: NextRequest): Response | null {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    return new Response("INTERNAL_API_SECRET not configured", { status: 500 });
  }
  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
