/**
 * Wipe app data for a clean signup/login test.
 * Usage: node scripts/fresh-start.js
 */
require("dotenv").config();
const { pool } = require("../db");

async function main() {
  const cols = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
     ORDER BY ordinal_position`,
  );
  console.log("users columns:");
  cols.rows.forEach((row) => console.log(`  - ${row.column_name} (${row.data_type})`));

  const before = await pool.query(`SELECT id, email, username, display_name FROM users`);
  console.log(`users before: ${before.rowCount}`);
  before.rows.forEach((row) => console.log(`  - ${row.email} / @${row.username}`));

  // Child tables reference users — clear dependents first where needed.
  await pool.query("BEGIN");
  try {
    await pool.query(`
      TRUNCATE TABLE
        reactions,
        comments,
        photos,
        posts,
        album_members,
        albums,
        friendships,
        users
      RESTART IDENTITY CASCADE
    `);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  const after = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  console.log(`users after: ${after.rows[0].count}`);
  console.log("Fresh start ready. Clear browser site data for localhost:5173, then sign up again.");
}

main()
  .catch((error) => {
    console.error("Fresh start failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
