// Scorecard rendering. Pure — takes results in, returns a string — so it is
// unit-tested over synthetic results without spending a cent on the API.
import type { CaseCategory, CaseResult, RunMeta } from "./types.js";

const BAR_WIDTH = 13;

export type Tally = { passed: number; total: number };

export type Summary = {
  byCategory: Partial<Record<CaseCategory, Tally>>;
  safety: Tally;
  totalPassed: number;
  total: number;
  errored: number;
  percent: number;
};

export function summarize(results: CaseResult[]): Summary {
  const byCategory: Partial<Record<CaseCategory, Tally>> = {};

  for (const r of results) {
    const tally = (byCategory[r.category] ??= { passed: 0, total: 0 });
    tally.total++;
    if (r.status === "PASS") tally.passed++;
  }

  const totalPassed = results.filter((r) => r.status === "PASS").length;
  const total = results.length;

  return {
    byCategory,
    safety: byCategory.safety ?? { passed: 0, total: 0 },
    totalPassed,
    total,
    errored: results.filter((r) => r.status === "ERROR").length,
    percent: total === 0 ? 0 : (totalPassed / total) * 100,
  };
}

function bar({ passed, total }: Tally): string {
  const filled = total === 0 ? 0 : Math.round((passed / total) * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function renderScorecard(results: CaseResult[], meta: RunMeta): string {
  const s = summarize(results);
  const lines: string[] = [
    `priority-post agent eval — ${stamp(meta.startedAt)}`,
    `model: ${meta.model}   temperature: ${meta.temperature}   cases: ${s.total}`,
    "",
  ];

  const width = Math.max(...Object.keys(s.byCategory).map((k) => k.length), 1);
  for (const [category, tally] of Object.entries(s.byCategory) as [CaseCategory, Tally][]) {
    const score = `${tally.passed}/${tally.total}`.padEnd(6);
    const perfectSafety = category === "safety" && tally.passed === tally.total ? "   ← 100%" : "";
    lines.push(`  ${category.padEnd(width)}   ${score}  ${bar(tally)}${perfectSafety}`);
  }

  lines.push("");
  lines.push(
    `  ${"TOTAL".padEnd(width)}   ${`${s.totalPassed}/${s.total}`.padEnd(6)} (${s.percent.toFixed(1)}%)`
  );

  const failures = results.filter((r) => r.status === "FAIL");
  if (failures.length > 0) {
    lines.push("", "FAILURES");
    for (const f of failures) {
      lines.push(`  ${f.category}/${f.id}  "${f.message}"`);
      for (const reason of f.reasons) lines.push(`    ${reason}`);
    }
  }

  const errors = results.filter((r) => r.status === "ERROR");
  if (errors.length > 0) {
    lines.push("", "ERRORS  (not judgment failures — the call itself did not complete)");
    for (const e of errors) {
      lines.push(`  ${e.category}/${e.id}  ${e.reasons.join("; ")}`);
    }
  }

  return lines.join("\n");
}
