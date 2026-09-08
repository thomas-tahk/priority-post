import { describe, it, expect } from "vitest";
import { readDraft } from "./intake";

const PROJECTS = ["thomas-tahk/pocket-draft", "thomas-tahk/knowflow"];

function reply(input: Record<string, unknown>) {
  return [{ type: "tool_use", input }];
}

describe("reading the model's draft", () => {
  it("accepts a draft naming a project that was offered", () => {
    const draft = readDraft(
      reply({ repo: "thomas-tahk/knowflow", title: "Make the deploy work", body: "It 404s." }),
      PROJECTS,
    );

    expect(draft).toEqual({
      repo: "thomas-tahk/knowflow",
      title: "Make the deploy work",
      body: "It 404s.",
    });
  });

  it("refuses a project that was never offered", () => {
    // Electing a project is the one switch deciding where the factory may act.
    // A draft naming an unlisted repo would route around it.
    const draft = readDraft(
      reply({ repo: "thomas-tahk/somewhere-else", title: "t", body: "b" }),
      PROJECTS,
    );

    expect(draft).toBeNull();
  });

  it("refuses a draft with no title to show the user", () => {
    expect(readDraft(reply({ repo: PROJECTS[0], title: "   ", body: "b" }), PROJECTS)).toBeNull();
  });

  it("refuses a reply that used no tool at all", () => {
    expect(readDraft([{ type: "text", text: "I'd suggest..." }], PROJECTS)).toBeNull();
    expect(readDraft(null, PROJECTS)).toBeNull();
  });

  it("trims the text a person will read", () => {
    const draft = readDraft(reply({ repo: PROJECTS[0], title: "  Fix it  ", body: "  why  " }), PROJECTS);

    expect(draft?.title).toBe("Fix it");
    expect(draft?.body).toBe("why");
  });
});
