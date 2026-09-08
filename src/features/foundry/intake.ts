// Turning a sentence into something the factory can build.
//
// The model never files anything. It drafts; the user reads the draft and
// confirms. That is the whole safety model here: the expensive, hard-to-undo
// half of "make the golf app deploy" is a public issue in someone's repo, and a
// person should see the words before they exist.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

export type IssueDraft = { repo: string; title: string; body: string };

type Deps = { client?: Anthropic; apiKey?: string };

const DRAFT_TOOL: Anthropic.Tool = {
  name: "draft_issue",
  description: "Record the issue this request should become.",
  input_schema: {
    type: "object",
    properties: {
      repo: { type: "string", description: "Which project, exactly as listed." },
      title: { type: "string", description: "One line, imperative, as a person would write it." },
      body: {
        type: "string",
        description:
          "A short paragraph saying what is wanted and why, in the user's own terms. " +
          "Do not invent file paths, commands, or technical detail that was not given.",
      },
    },
    required: ["repo", "title", "body"],
    additionalProperties: false,
  },
};

function systemPrompt(projects: string[]): string {
  return [
    "You turn one sentence from the owner of these projects into a GitHub issue.",
    "",
    "Projects you may choose from, and no others:",
    ...projects.map((p) => `- ${p}`),
    "",
    "Write the issue as the owner would write it to themselves: plain, short, no",
    "ceremony. Do not invent technical detail, file paths, or a plan — a later step",
    "reads the codebase and works that out. If the sentence does not clearly name one",
    "of these projects, pick the closest and keep the title honest about the ask.",
  ].join("\n");
}

/** Draft an issue from a sentence. Returns null when the request cannot be
 * turned into one, so the caller shows the sentence back rather than filing
 * something invented. */
export async function draftIssue(
  sentence: string,
  projects: string[],
  deps: Deps = {},
): Promise<IssueDraft | null> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps.client) return null;
  if (projects.length === 0) return null;

  const client = deps.client ?? new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: systemPrompt(projects),
    tools: [DRAFT_TOOL],
    tool_choice: { type: "tool", name: DRAFT_TOOL.name },
    messages: [{ role: "user", content: sentence }],
  });

  return readDraft(response.content, projects);
}

/** Pull the draft out of the model's reply, refusing a project it was not offered.
 *
 * Electing a project is meant to be the one switch that decides where the
 * factory may act. A model that answers with an unlisted repo would quietly
 * route around that switch, so the draft is dropped instead of corrected. */
export function readDraft(content: unknown, projects: string[]): IssueDraft | null {
  if (!Array.isArray(content)) return null;
  const block = content.find(
    (c): c is { type: "tool_use"; input: Record<string, unknown> } =>
      typeof c === "object" && c !== null && (c as { type?: string }).type === "tool_use",
  );
  if (!block) return null;

  const { repo, title, body } = block.input;
  if (typeof repo !== "string" || typeof title !== "string" || typeof body !== "string") return null;
  if (!projects.includes(repo)) return null;
  if (!title.trim()) return null;

  return { repo, title: title.trim(), body: body.trim() };
}
