import type Anthropic from "@anthropic-ai/sdk";

const MAX_HISTORY = 16;

/**
 * Reduce a full tool-use transcript to a compact, plain-text conversation for the
 * next turn: keep only what was *said* (user text + assistant final text), drop
 * tool_use/tool_result plumbing so there are no dangling pairs. Collapse repeats,
 * ensure it starts with a user turn, and keep the last MAX_HISTORY messages.
 */
export function trimHistory(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const simple: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    const text =
      typeof m.content === "string"
        ? m.content
        : m.content
            .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
            .map((b) => b.text)
            .join("")
            .trim();
    if (!text) continue;

    const last = simple[simple.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content as string}\n${text}`;
    } else {
      simple.push({ role: m.role, content: text });
    }
  }

  while (simple.length > 0 && simple[0]!.role !== "user") simple.shift();
  return simple.slice(-MAX_HISTORY);
}
