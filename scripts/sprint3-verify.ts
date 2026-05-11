import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { Pool } from "pg";
import { triageTask } from "../src/features/triage/triage";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const pool = new Pool({ connectionString: url });

  await pool.query("DELETE FROM tasks");

  const title = "review Alex's PR by 5pm";
  const before = Date.now();

  const insert = await pool.query<{ id: number }>(
    `INSERT INTO tasks (title) VALUES ($1) RETURNING id`,
    [title]
  );
  const id = insert.rows[0]!.id;
  console.log(`inserted task #${id} with null AI fields`);

  console.log(`calling Haiku 4.5 to triage "${title}"...`);
  const result = await triageTask(title);
  const elapsedMs = Date.now() - before;

  if (!result) {
    console.error("triage returned null — see error above");
    await pool.end();
    process.exit(1);
  }

  await pool.query(
    `UPDATE tasks SET categories = $1, urgency = $2, importance = $3,
     est_time_min = $4, focus = $5 WHERE id = $6`,
    [result.categories, result.urgency, result.importance, result.est_time_min, result.focus, id]
  );

  const { rows } = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  const row = rows[0];

  console.log(`\ntriage completed in ${elapsedMs}ms (insert+API+update)`);
  console.log("Claude inferred:");
  console.log(`  categories:   ${row.categories.join(", ")}`);
  console.log(`  urgency:      ${row.urgency}`);
  console.log(`  importance:   ${row.importance}`);
  console.log(`  est_time_min: ${row.est_time_min}`);
  console.log(`  focus:        ${row.focus}`);

  // Sanity-check the inference is plausible for "review Alex's PR by 5pm":
  // urgency should be high (deadline today), focus should be medium (code review).
  const sensible =
    row.categories.includes("work") &&
    row.urgency >= 60 &&
    row.focus !== null;
  console.log(`\nplausibility check: ${sensible ? "PASS" : "FAIL — unexpected inference"}`);

  await pool.end();
  if (!sensible) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
