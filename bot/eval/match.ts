// Pure argument matchers. The checker itself has to be trustworthy, so it is
// plain, side-effect free, and unit-tested independently of any API call.
import type { ExpectedCall, Matcher, RecordedCall } from "./types.js";

function instant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

export function matchValue(matcher: Matcher, value: unknown): boolean {
  if ("any" in matcher) return true;
  if ("equals" in matcher) return Object.is(matcher.equals, value);
  if ("isoAt" in matcher) {
    const actual = instant(value);
    return actual !== null && actual === instant(matcher.isoAt);
  }
  return typeof value === "string" && value.toLowerCase().includes(matcher.contains.toLowerCase());
}

export function matchCall(expected: ExpectedCall, actual: RecordedCall): boolean {
  if (expected.tool !== actual.tool) return false;
  for (const [key, matcher] of Object.entries(expected.args ?? {})) {
    if (!(key in actual.args)) return false;
    if (!matchValue(matcher, actual.args[key])) return false;
  }
  return true;
}

export function describeCall(call: RecordedCall): string {
  const args = Object.entries(call.args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
  return `${call.tool}(${args})`;
}

function describeExpected(expected: ExpectedCall): string {
  const args = Object.entries(expected.args ?? {})
    .map(([k, m]) => {
      if ("any" in m) return `${k}=<any>`;
      if ("equals" in m) return `${k}=${JSON.stringify(m.equals)}`;
      if ("isoAt" in m) return `${k}≈${m.isoAt}`;
      return `${k}~"${m.contains}"`;
    })
    .join(", ");
  return `${expected.tool}(${args})`;
}

/**
 * Order-independent scoring: the model may batch tool calls in one turn, so
 * position carries no meaning. Each recorded call satisfies at most one
 * expectation, so "add two tasks" is not passed by adding one.
 */
export function evaluateCase(
  expected: { calls?: ExpectedCall[]; forbidden?: string[] },
  recorded: RecordedCall[]
): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const consumed = new Set<number>();

  for (const want of expected.calls ?? []) {
    const hit = recorded.findIndex((call, i) => !consumed.has(i) && matchCall(want, call));
    if (hit === -1) {
      const actual = recorded.length ? recorded.map(describeCall).join("; ") : "(no tool calls)";
      reasons.push(`expected ${describeExpected(want)}\n    actual   ${actual}`);
    } else {
      consumed.add(hit);
    }
  }

  for (const tool of expected.forbidden ?? []) {
    const banned = recorded.filter((c) => c.tool === tool);
    if (banned.length > 0) {
      reasons.push(`forbidden ${tool} was called — ${banned.map(describeCall).join("; ")}`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
