import { describe, it, expect } from "vitest";
import {
  decideInteraction,
  immediateBody,
  invokerId,
  InteractionType,
  ResponseType,
} from "./interaction";

const OWNER = "111222333";

function command(overrides: Record<string, unknown> = {}) {
  return {
    type: InteractionType.ApplicationCommand,
    data: { name: "pp", options: [{ name: "message", value: "what's next?" }] },
    member: { user: { id: OWNER } },
    ...overrides,
  };
}

describe("decideInteraction", () => {
  it("answers Discord's ping without checking anything else", () => {
    expect(decideInteraction({ type: InteractionType.Ping }, undefined)).toEqual({ kind: "pong" });
  });

  it("runs the agent on the owner's prompt", () => {
    expect(decideInteraction(command(), OWNER)).toEqual({
      kind: "run",
      prompt: "what's next?",
    });
  });

  it("turns away anyone who is not the owner", () => {
    const decision = decideInteraction(
      command({ member: { user: { id: "999" } } }),
      OWNER,
    );

    expect(decision).toEqual({
      kind: "reply",
      text: "This planner only answers to its owner.",
      ephemeral: true,
    });
  });

  it("refuses to serve anyone when the owner is not configured", () => {
    const decision = decideInteraction(command(), undefined);

    expect(decision.kind).toBe("reject");
  });

  it("reads the invoker from a DM payload, which has no member", () => {
    const dm = command({ member: undefined, user: { id: OWNER } });

    expect(invokerId(dm)).toBe(OWNER);
    expect(decideInteraction(dm, OWNER).kind).toBe("run");
  });

  it("asks for input instead of running the agent on an empty prompt", () => {
    const decision = decideInteraction(
      command({ data: { name: "pp", options: [{ name: "message", value: "   " }] } }),
      OWNER,
    );

    expect(decision.kind).toBe("reply");
    expect(decision).toMatchObject({ ephemeral: true });
  });

  it("asks for input when the option is missing entirely", () => {
    const decision = decideInteraction(command({ data: { name: "pp" } }), OWNER);

    expect(decision.kind).toBe("reply");
  });

  it("treats 'reset' as the clear-history escape hatch, not a prompt", () => {
    const decision = decideInteraction(
      command({ data: { name: "pp", options: [{ name: "message", value: "Reset" }] } }),
      OWNER,
    );

    expect(decision).toEqual({ kind: "reset" });
  });

  it("rejects an interaction type it does not handle", () => {
    expect(decideInteraction({ type: 99 }, OWNER).kind).toBe("reject");
  });
});

describe("immediateBody", () => {
  it("pongs a ping", () => {
    expect(immediateBody({ kind: "pong" })).toEqual({ type: ResponseType.Pong });
  });

  it("defers work that takes longer than Discord's three seconds", () => {
    expect(immediateBody({ kind: "run", prompt: "hi" })).toEqual({ type: ResponseType.Deferred });
    expect(immediateBody({ kind: "reset" })).toEqual({ type: ResponseType.Deferred });
  });

  it("marks a refusal ephemeral so it is not posted into the channel", () => {
    const body = immediateBody({ kind: "reply", text: "nope", ephemeral: true });

    expect(body).toEqual({ type: ResponseType.Message, data: { content: "nope", flags: 64 } });
  });

  it("omits the ephemeral flag when the reply is meant to be seen", () => {
    const body = immediateBody({ kind: "reply", text: "hello", ephemeral: false });

    expect(body).toEqual({ type: ResponseType.Message, data: { content: "hello" } });
  });

  it("has no body for a rejection — the route answers with a status code", () => {
    expect(immediateBody({ kind: "reject", reason: "nope" })).toBeNull();
  });
});
