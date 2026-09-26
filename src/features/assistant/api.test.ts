import { describe, it, expect, afterEach, vi } from "vitest";
import { HttpPlannerApi } from "./api";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(res: Response): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () => res);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

const api = () => new HttpPlannerApi("https://example.test", "secret");

describe("HttpPlannerApi", () => {
  it("returns parsed tasks on a normal JSON response", async () => {
    stubFetch(
      new Response(JSON.stringify({ tasks: [{ id: 1, title: "a" }] }), {
        headers: { "content-type": "application/json" },
      })
    );

    await expect(api().listTasks()).resolves.toEqual([{ id: 1, title: "a" }]);
  });

  // The production bug: Vercel's deployment-protection wall answered 200 with an
  // HTML login page. The client returned undefined, and the agent told the owner
  // their task list was empty. A 200 that isn't JSON is a failure, not a result.
  it("throws when a 200 response is not JSON", async () => {
    stubFetch(
      new Response("<!doctype html><title>Login</title>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );

    await expect(api().listTasks()).rejects.toThrow(/not JSON/);
  });

  it("throws rather than following a redirect away from our own API", async () => {
    stubFetch(
      new Response(null, { status: 302, headers: { location: "https://vercel.com/sso-api" } })
    );

    await expect(api().getDigest()).rejects.toThrow(/302/);
  });

  it("does not follow redirects", async () => {
    const spy = stubFetch(
      new Response("{}", { headers: { "content-type": "application/json" } })
    );

    await api().listTasks().catch(() => {});

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
  });

  it("includes status and body when the API returns an error", async () => {
    stubFetch(new Response("unauthorized", { status: 401 }));

    await expect(api().listTasks()).rejects.toThrow(/401 unauthorized/);
  });
});
