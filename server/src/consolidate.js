import pg from 'pg';

// One-off migration:
//  1. dedupe board_columns by title (keep lowest id, re-point tasks)
//  2. add tasks.items column
//  3. merge tasks sharing (column, project, work_date) into a single card
//  4. enforce UNIQUE on board_columns.title
// Safe to re-run — merged cards merge into themselves.

pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DATABASE_URL — run `neon env pull` in the project root.');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
const client = await pool.connect();

try {
  await client.query('BEGIN');

  // 1. dedupe columns
  const { rows: dupTitles } = await client.query(
    `SELECT title, array_agg(id ORDER BY id) AS ids
     FROM board_columns GROUP BY title HAVING COUNT(*) > 1`
  );
  for (const { ids } of dupTitles) {
    const [keep, ...extras] = ids;
    for (const extra of extras) {
      await client.query('UPDATE tasks SET column_id = $1 WHERE column_id = $2', [keep, extra]);
      await client.query('DELETE FROM board_columns WHERE id = $1', [extra]);
    }
  }
  // normalize positions inside each column
  const { rows: cols } = await client.query('SELECT id FROM board_columns');
  for (const { id } of cols) {
    await client.query(
      `WITH s AS (
         SELECT id, row_number() OVER (ORDER BY position, id) - 1 AS p
         FROM tasks WHERE column_id = $1
       )
       UPDATE tasks t SET position = s.p FROM s WHERE t.id = s.id`,
      [id]
    );
  }

  // 2. items column
  await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS items TEXT[] NOT NULL DEFAULT '{}'`);

  // 3. merge tasks by (column, project, work_date)
  const { rows: tasks } = await client.query(
    'SELECT * FROM tasks ORDER BY column_id, position, id'
  );
  const groups = new Map();
  for (const t of tasks) {
    const key = `${t.column_id}|${t.project_id ?? 'null'}|${t.work_date}`;
    if (!groups.has(key)) {
      groups.set(key, {
        column_id: t.column_id,
        project_id: t.project_id,
        work_date: t.work_date,
        position: t.position,
        title: '',
        description: '',
        items: [],
        tags: new Set(),
      });
    }
    const g = groups.get(key);
    if (t.title) g.title ||= t.title;
    if (t.description) g.description ||= t.description;
    g.items.push(...(t.items?.length ? t.items : t.title ? [t.title] : []));
    for (const tag of t.tags || []) g.tags.add(tag);
  }

  await client.query('DELETE FROM tasks');
  const merged = [...groups.values()];
  for (const g of merged) {
    await client.query(
      `INSERT INTO tasks (title, description, items, project_id, column_id, position, work_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [g.title, g.description, g.items, g.project_id, g.column_id, g.position, g.work_date, [...g.tags]]
    );
  }

  // 4. unique column titles (prevents the dup bug from recurring)
  await client.query(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'board_columns_title_key') THEN
         ALTER TABLE board_columns ADD CONSTRAINT board_columns_title_key UNIQUE (title);
       END IF;
     END $$;`
  );

  await client.query('COMMIT');
  console.log(`Done: ${tasks.length} tasks -> ${merged.length} cards; ${dupTitles.length} duplicate column title(s) removed.`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
  await pool.end();
}
