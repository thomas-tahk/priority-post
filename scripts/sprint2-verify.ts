import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { Pool } from "pg";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url });
  await pool.query("DELETE FROM tasks");

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const tomorrow6pm = new Date(now);
  tomorrow6pm.setDate(tomorrow6pm.getDate() + 1);
  tomorrow6pm.setHours(18, 0, 0, 0);

  const seed = [
    {
      title: "review Alex's PR by 5pm",
      categories: ["work"],
      urgency: 85,
      importance: 65,
      est_time_min: 20,
      focus: "medium",
      start_at: oneHourFromNow,
    },
    {
      title: "buy birthday gift for mom",
      categories: ["personal", "errands"],
      urgency: 60,
      importance: 75,
      est_time_min: 45,
      focus: "low",
      start_at: tomorrow6pm,
    },
    {
      title: "30 min run after lunch",
      categories: ["health"],
      urgency: 40,
      importance: 60,
      est_time_min: 30,
      focus: "low",
      start_at: null,
    },
    {
      title: "finish chapter 4 of distributed systems book",
      categories: ["learning", "personal"],
      urgency: 20,
      importance: 80,
      est_time_min: 90,
      focus: "high",
      start_at: null,
    },
    {
      title: "draft Q2 OKRs for the team",
      categories: ["work", "side_project", "personal"],
      urgency: 50,
      importance: 90,
      est_time_min: 120,
      focus: "high",
      start_at: null,
    },
  ];

  for (const t of seed) {
    await pool.query(
      `INSERT INTO tasks (title, categories, urgency, importance, est_time_min, focus, start_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [t.title, t.categories, t.urgency, t.importance, t.est_time_min, t.focus, t.start_at]
    );
  }

  const { rows } = await pool.query(
    "SELECT id, title, urgency, importance, est_time_min, focus, start_at FROM tasks ORDER BY id"
  );
  console.log(`inserted ${rows.length} tasks (all with AI-style fields populated)`);
  for (const r of rows) {
    console.log(
      `  #${r.id} u=${r.urgency} i=${r.importance} t=${r.est_time_min}m focus=${r.focus} start=${
        r.start_at ? r.start_at.toISOString() : "none"
      } :: ${r.title}`
    );
  }
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
