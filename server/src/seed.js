import pg from 'pg';

// Seeds go through the direct (unpooled) connection, not PgBouncer.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DATABASE_URL — run `neon env pull` in the project root.');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
const query = (text, params) => pool.query(text, params);

const COLUMNS = ['To Do', 'In Progress', 'In Review', 'Done'];

const PROJECTS = [
  ['Io.performena', '#6366f1'],
  ['Blogist', '#0ea5e9'],
  ['SportingVibe', '#f59e0b'],
  ['Performena', '#10b981'],
];

// [work_date, project, bullet, tags?] — grouped into one card per project+date below
const WORK = [
  ['2026-10-16', 'Io.performena', 'Developed the Campaign Booking page UI and integrated APIs.', ['ui', 'api']],
  ['2026-10-16', 'Io.performena', 'Worked with the Neon database during development.', ['db']],
  ['2026-10-16', 'Io.performena', 'Shared the update with the group.'],

  ['2026-10-21', 'Io.performena', 'Migrated the database from Neon to AWS RDS PostgreSQL.', ['aws', 'db']],
  ['2026-10-21', 'Io.performena', 'Deployed the API using AWS Lambda and API Gateway.', ['aws', 'api', 'deploy']],
  ['2026-10-21', 'Io.performena', 'Configured production environment variables and database schema.', ['aws']],
  ['2026-10-21', 'Io.performena', 'Deployed the frontend to S3 at io.performena.com.', ['aws', 'deploy']],
  ['2026-10-21', 'Io.performena', 'Handed over the application to the tester for testing.'],

  ['2026-10-22', 'Blogist', 'Updated read APIs to use GET methods for improved caching support.', ['api', 'caching']],
  ['2026-10-22', 'Blogist', 'Applied the changes to TrendBrews staging for testing.', ['deploy']],
  ['2026-10-22', 'Blogist', 'Evaluated caching options (CloudFront, DynamoDB, MySQL, SQS) to improve API performance and reduce database load.', ['caching']],

  ['2026-10-23', 'Performena', "Updated the Showcase page based on Kathan's feedback.", ['ui']],
  ['2026-10-23', 'Performena', 'Shared the changes with the group.'],
  ['2026-10-23', 'Performena', 'Deployed the updates to staging and production.', ['deploy']],

  ['2026-10-25', 'SportingVibe', 'Started developing the SportingVibe UI.', ['ui']],
  ['2026-10-25', 'SportingVibe', 'Started integrating the Blogist video API.', ['api']],

  ['2026-10-26', 'SportingVibe', 'Continued working on the UI and API integration.', ['ui', 'api']],
  ['2026-10-26', 'Blogist', 'Updated image storage on staging to organize images by Domain ID and month/year folders.', ['storage']],
  ['2026-10-26', 'Blogist', 'Updated image handling for new blog posts, banners, and thumbnails.', ['storage']],
  ['2026-10-26', 'Io.performena', 'Added date filters for Insertion Orders (IOs), Dashboard, and Clients.', ['ui']],
  ['2026-10-26', 'Io.performena', 'Improved form validation for client details, VAT/Tax numbers, phone numbers, and passwords.', ['validation']],
  ['2026-10-26', 'Io.performena', 'Added duplicate checks for clients, campaigns, usernames, and emails.', ['validation']],
  ['2026-10-26', 'Io.performena', 'Improved error messages, empty states, currency handling, dashboard icons, favicon, and form components.', ['ui']],

  ['2026-10-27', 'Io.performena', 'Migrated the Campaign Booking frontend and API to AWS S3 and Lambda.', ['aws', 'deploy']],
  ['2026-10-27', 'Blogist', 'Updated Blogist image storage on staging to use Domain ID and month/year folders.', ['storage']],
  ['2026-10-27', 'Blogist', 'Updated image handling for blog posts, banners, and thumbnails.', ['storage']],
  ['2026-10-27', 'Blogist', 'Shared the image handling updates with the group.'],

  ['2026-10-28', 'SportingVibe', 'Integrated the Blogist API for the video feed.', ['api']],
  ['2026-10-28', 'SportingVibe', 'Added category and country filters, pagination, and caching.', ['api', 'caching']],
  ['2026-10-28', 'SportingVibe', 'Improved Shorts, video loading, and swipe/drag navigation.', ['ui']],
  ['2026-10-28', 'SportingVibe', 'Added actual video duration, search result counts, and VAST ads.', ['api']],
  ['2026-10-28', 'SportingVibe', 'Improved scrolling and overall video feed performance.', ['performance']],

  ['2026-10-29', 'Blogist', 'Added category and country dropdowns to the video form.', ['ui']],
  ['2026-10-29', 'Blogist', 'Implemented automatic video duration detection with a 120-second limit.', ['api']],
  ['2026-10-29', 'Blogist', 'Updated video APIs to support category/country filters and pagination.', ['api']],
  ['2026-10-29', 'Blogist', 'Added database support for saving and filtering videos by country.', ['db']],
  ['2026-10-29', 'Blogist', 'Updated API responses to return category and country details.', ['api']],
  ['2026-10-29', 'Performena', 'Updated the Showcase page within the discussed time slots on 21-23 October, based on the available work notes.', ['ui']],
  ['2026-10-29', 'Performena', 'Published the changes to staging and production on 23 October.', ['deploy']],
];

// one card per (date, project)
const CARDS = [];
const cardIndex = new Map();
for (const [date, project, bullet, tags = []] of WORK) {
  const key = `${date}|${project}`;
  if (!cardIndex.has(key)) {
    cardIndex.set(key, { date, project, items: [], tags: new Set() });
    CARDS.push(cardIndex.get(key));
  }
  const c = cardIndex.get(key);
  c.items.push(bullet);
  for (const t of tags) c.tags.add(t);
}

const force = process.argv.includes('--force');

const { rows: existing } = await query('SELECT COUNT(*)::int AS n FROM tasks');
if (existing[0].n > 0 && !force) {
  console.log(`Tasks table already has ${existing[0].n} rows — skipping. Run with --force to reseed.`);
  await pool.end();
  process.exit(0);
}
if (force) await query('DELETE FROM tasks');

// columns (idempotent — title is UNIQUE)
const colIds = {};
for (let i = 0; i < COLUMNS.length; i++) {
  const { rows: [row] } = await query(
    `INSERT INTO board_columns (title, position) VALUES ($1, $2)
     ON CONFLICT (title) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [COLUMNS[i], i]
  );
  colIds[COLUMNS[i]] = row.id;
}

// projects (idempotent)
const projIds = {};
for (const [name, color] of PROJECTS) {
  const { rows: [row] } = await query(
    `INSERT INTO projects (name, color) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, color]
  );
  projIds[name] = row.id;
}

// everything seeded is completed work -> goes to Done, preserving log order
const doneId = colIds['Done'];
for (let i = 0; i < CARDS.length; i++) {
  const c = CARDS[i];
  await query(
    `INSERT INTO tasks (title, items, project_id, column_id, position, work_date, tags)
     VALUES ('', $1, $2, $3, $4, $5, $6)`,
    [c.items, projIds[c.project], doneId, i, c.date, [...c.tags]]
  );
}

console.log(`Seeded ${CARDS.length} cards (${WORK.length} bullets), ${PROJECTS.length} projects, ${COLUMNS.length} columns.`);
await pool.end();
