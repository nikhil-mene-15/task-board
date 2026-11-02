CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_columns (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  position INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  items TEXT[] NOT NULL DEFAULT '{}',
  project_id INT REFERENCES projects(id) ON DELETE SET NULL,
  column_id INT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_work_date ON tasks(work_date);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Daily scrum: discussion points + action items per day
CREATE TABLE IF NOT EXISTS daily_notes (
  id SERIAL PRIMARY KEY,
  note_date DATE NOT NULL UNIQUE,
  points JSONB NOT NULL DEFAULT '[]',
  action_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- upgrade legacy string points -> {text, owner} objects
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_notes' AND column_name = 'points' AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE daily_notes ADD COLUMN points_new JSONB NOT NULL DEFAULT '[]';
    UPDATE daily_notes SET points_new = (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('text', x.p) ORDER BY x.ord), '[]'::jsonb)
      FROM unnest(points) WITH ORDINALITY AS x(p, ord)
    );
    ALTER TABLE daily_notes DROP COLUMN points;
    ALTER TABLE daily_notes RENAME COLUMN points_new TO points;
  END IF;
END $$;
