import { describe, it, expect, vi } from "vitest";
import { editDeferredReply, fit } from "./followup";

describe("fit", () => {
  it("leaves a short reply alone", () => {
    expect(fit("✅ added 'call dentist'")).toBe("✅ added 'call dentist'");
  });

  it("substitutes a placeholder for an empty reply", () => {
    expect(fit("   ")).toBe("(no reply)");
  });

  it("cuts an over-long reply at a line boundary", () => {
    const body = Array.from({ length: 300 }, (_, i) => `• task number ${i}`).join("\n");

    const result = fit(body);

    expect(result.length).toBeLessThanOrEqual(1900);
    expect(result.endsWith("…")).toBe(true);
    expect(result).toContain("• task number 0");
  });

  it("still cuts a single unbroken line", () => {
    const result = fit("x".repeat(5000));

    expect(result.length).toBeLessThanOrEqual(1900);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("editDeferredReply", () => {
  const base = { applicationId: "app-1", interactionToken: "tok-1", content: "done" };

  it("PATCHes the original message with the answer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await editDeferredReply({ ...base, fetchImpl });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/webhooks/app-1/tok-1/messages/@original");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ content: "done" });
  });

  it("carries no bot token — the interaction token is the authorization", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await editDeferredReply({ ...base, fetchImpl });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("reports a refusal instead of throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    expect(await editDeferredReply({ ...base, fetchImpl })).toEqual({
      ok: false,
      reason: "Discord returned 404",
    });
  });

  it("reports an unreachable Discord instead of throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    expect(await editDeferredReply({ ...base, fetchImpl })).toEqual({
      ok: false,
      reason: "Could not reach Discord",
    });
  });
});
