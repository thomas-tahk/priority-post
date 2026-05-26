import { NextResponse, type NextRequest } from "next/server";

// HTTP Basic Auth gate. Single-user app: any username, password from APP_PASSWORD.
// Browser prompts once per device and remembers the credentials for the origin.
export default function proxy(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return new NextResponse("APP_PASSWORD not configured", { status: 500 });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    let decoded: string;
    try {
      decoded = atob(header.slice(6));
    } catch {
      return unauthorized();
    }
    const colon = decoded.indexOf(":");
    const password = colon === -1 ? "" : decoded.slice(colon + 1);
    if (timingSafeEqual(password, expected)) {
      return NextResponse.next();
    }
  }

  return unauthorized();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="priority-post"' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
