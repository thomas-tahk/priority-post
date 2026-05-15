import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { Pool } from "pg";
import { triageTask } from "../src/features/triage/triage";

// 20 varied seed tasks covering all 7 categories, full urgency/importance/focus
// range, est-time spread, long-title overflow case, scheduled-task path, and
// near-tied scores to stress the createdAt tie-break.
type Seed = { title: string; startOffsetHours?: number };

const SEEDS: Seed[] = [
  { title: "review Alex's PR by EOD" },
  { title: "buy mom's birthday gift this weekend" },
  { title: "morning run" },
  { title: "finish chapter 3 of Designing Data-Intensive Applications" },
  { title: "pick up dry cleaning" },
  { title: "ship priority-post v1 polish sprint" },
  { title: "schedule dentist appointment" },
  { title: "draft Q2 retrospective doc" },
  { title: "renew passport before June trip" },
  { title: "learn React 19 use() hook patterns" },
  {
    title:
      "this is an unusually long task title that tests how the UI handles overflow without breaking the layout in any of the views or panels including the eisenhower map tooltip",
  },
  { title: "weekly meal prep" },
  { title: "respond to recruiter emails" },
  { title: "fix bathroom faucet leak" },
  { title: "write blog post on prompt caching" },
  { title: "annual physical exam tomorrow at 9am", startOffsetHours: 24 },
  { title: "deep work block: refactor billing service" },
  { title: "grocery run" },
  { title: "review pull request from Sam" },
  { title: "call insurance about claim status" },
];

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const pool = new Pool({ connectionString: url });

  console.log(`wiping tasks table…`);
  await pool.query("DELETE FROM tasks");

  console.log(`seeding ${SEEDS.length} tasks (insert + triage each)…\n`);
  const t0 = Date.now();

  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]!;
    const startAt =
      seed.startOffsetHours !== undefined
        ? new Date(Date.now() + seed.startOffsetHours * 60 * 60 * 1000)
        : null;

    const insert = await pool.query<{ id: number }>(
      `INSERT INTO tasks (title, start_at) VALUES ($1, $2) RETURNING id`,
      [seed.title, startAt]
    );
    const id = insert.rows[0]!.id;

    const triage = await triageTask(seed.title);
    if (!triage) {
      console.error(`  #${id} triage failed: "${seed.title}"`);
      continue;
    }

    await pool.query(
      `UPDATE tasks SET categories=$1, urgency=$2, importance=$3,
       est_time_min=$4, focus=$5 WHERE id=$6`,
      [
        triage.categories,
        triage.urgency,
        triage.importance,
        triage.est_time_min,
        triage.focus,
        id,
      ]
    );

    const label = (i + 1).toString().padStart(2, " ");
    console.log(
      `  ${label}. #${id} ${triage.categories.join("+").padEnd(20)} ` +
        `u${triage.urgency} i${triage.importance} ${triage.est_time_min}m ${triage.focus}` +
        (startAt ? ` @${startAt.toISOString().slice(0, 16)}` : "")
    );
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nseeded ${SEEDS.length} tasks in ${elapsed}s`);
  console.log(`open http://localhost:3000 (run \`pnpm dev\`) to verify ranking + map.`);

  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
