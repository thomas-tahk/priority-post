import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { Pool } from "pg";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url });

  await pool.query("DELETE FROM tasks");

  const seed = [
    { title: "review Alex's PR by 5pm", categories: ["work"] },
    { title: "buy birthday gift for mom", categories: ["personal", "errands"] },
    { title: "30 min run after lunch", categories: ["health"] },
    {
      title: "finish chapter 4 of distributed systems book",
      categories: ["learning", "personal"],
    },
    {
      title: "draft Q2 OKRs for the team",
      categories: ["work", "side_project", "personal"],
    },
  ];

  for (const t of seed) {
    await pool.query("INSERT INTO tasks (title, categories) VALUES ($1, $2)", [
      t.title,
      t.categories,
    ]);
  }

  const { rows } = await pool.query(
    "SELECT id, title, categories FROM tasks ORDER BY id"
  );
  console.log(`inserted ${rows.length} tasks:`);
  for (const r of rows) {
    console.log(`  #${r.id} [${r.categories.join(", ")}] ${r.title}`);
  }
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
