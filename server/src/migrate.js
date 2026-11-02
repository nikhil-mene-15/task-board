import { readFileSync } from 'node:fs';
import pg from 'pg';

// DDL goes through the direct (unpooled) connection, not PgBouncer.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DATABASE_URL — run `neon env pull` in the project root.');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log(`Schema applied (${process.env.DATABASE_URL_UNPOOLED ? 'unpooled' : 'pooled'} connection).`);
await pool.end();
