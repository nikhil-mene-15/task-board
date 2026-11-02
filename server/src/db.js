import pg from 'pg';

const { Pool } = pg;

// Return DATE columns as 'YYYY-MM-DD' strings — avoids timezone shifts
// when serializing (local-midnight Date -> previous day in UTC for UTC+ zones).
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL — run `neon env pull` in the project root.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text, params) => pool.query(text, params);
