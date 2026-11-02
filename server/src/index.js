import express from 'express';
import ExcelJS from 'exceljs';
import { pool, query } from './db.js';

const app = express();
app.use(express.json());

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/board — columns + tasks + projects in one shot
app.get('/api/board', async (req, res) => {
  const [cols, tasks, projects] = await Promise.all([
    query('SELECT * FROM board_columns ORDER BY position'),
    query(
      `SELECT t.*, p.name AS project_name, p.color AS project_color
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       ORDER BY t.position`
    ),
    query('SELECT * FROM projects ORDER BY name'),
  ]);
  res.json({
    columns: cols.rows.map((c) => ({ ...c, tasks: tasks.rows.filter((t) => t.column_id === c.id) })),
    projects: projects.rows,
  });
});

// Tasks
app.post('/api/tasks', async (req, res) => {
  const {
    title = '',
    description = '',
    items = [],
    project_id = null,
    column_id,
    work_date = null,
    due_date = null,
    owner = '',
    tags = [],
  } = req.body;
  if (!column_id) return res.status(400).json({ error: 'column_id is required' });
  if (!title && !items.length) return res.status(400).json({ error: 'title or at least one item is required' });

  // Same project + same date -> append bullets to the existing day card and bump it to the top
  if (project_id) {
    const { rows: [existing] } = await query(
      `SELECT id, column_id, position FROM tasks
       WHERE project_id = $1 AND work_date = COALESCE($2::date, CURRENT_DATE)
       LIMIT 1`,
      [project_id, work_date]
    );
    if (existing) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE tasks SET position = position + 1 WHERE column_id = $1 AND position < $2',
          [existing.column_id, existing.position]
        );
        const { rows: [row] } = await client.query(
          `UPDATE tasks SET
             items = items || $2::text[],
             tags = (SELECT array_agg(DISTINCT x) FROM unnest(tags || $3::text[]) AS x),
             title = CASE WHEN title = '' THEN $4 ELSE title END,
             position = 0,
             updated_at = now()
           WHERE id = $1 RETURNING *`,
          [existing.id, items, tags, title]
        );
        await client.query('COMMIT');
        return res.json(row);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }

  // New cards go to the top of the column — shift existing ones down
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE tasks SET position = position + 1 WHERE column_id = $1', [column_id]);
    const { rows } = await client.query(
      `INSERT INTO tasks (title, description, items, project_id, column_id, position, work_date, due_date, owner, tags)
       VALUES ($1, $2, $3, $4, $5, 0, COALESCE($6::date, CURRENT_DATE), $7::date, $8, $9)
       RETURNING *`,
      [title, description, items, project_id, column_id, work_date, due_date, owner, tags]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  const fields = ['title', 'description', 'items', 'project_id', 'column_id', 'work_date', 'due_date', 'owner', 'tags'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      values.push(req.body[f]);
      sets.push(`${f} = $${values.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  values.push(req.params.id);
  const { rows } = await query(
    `UPDATE tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'task not found' });
  res.json(rows[0]);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'task not found' });
  res.json({ ok: true });
});

// Drag & drop reorder — client sends ordered task ids per affected column
app.post('/api/tasks/reorder', async (req, res) => {
  const { columns } = req.body; // [{ id, task_ids: [..] }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const col of columns) {
      await client.query(
        `UPDATE tasks t
         SET column_id = $1, position = v.ord - 1, updated_at = now()
         FROM unnest($2::int[]) WITH ORDINALITY AS v(id, ord)
         WHERE t.id = v.id`,
        [col.id, col.task_ids]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Projects
app.post('/api/projects', async (req, res) => {
  const { name, color = '#6366f1' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const { rows } = await query(
    'INSERT INTO projects (name, color) VALUES ($1, $2) RETURNING *',
    [name.trim(), color]
  );
  res.status(201).json(rows[0]);
});

app.patch('/api/projects/:id', async (req, res) => {
  const fields = ['name', 'color'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      values.push(req.body[f]);
      sets.push(`${f} = $${values.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  values.push(req.params.id);
  const { rows } = await query(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'project not found' });
  res.json(rows[0]);
});

app.delete('/api/projects/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'project not found' });
  res.json({ ok: true });
});

// Columns
app.post('/api/columns', async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const { rows } = await query(
    `INSERT INTO board_columns (title, position)
     VALUES ($1, COALESCE((SELECT MAX(position) + 1 FROM board_columns), 0))
     RETURNING *`,
    [title.trim()]
  );
  res.status(201).json(rows[0]);
});

app.patch('/api/columns/:id', async (req, res) => {
  const { title } = req.body;
  const { rows } = await query(
    'UPDATE board_columns SET title = $1 WHERE id = $2 RETURNING *',
    [title, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'column not found' });
  res.json(rows[0]);
});

app.delete('/api/columns/:id', async (req, res) => {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM tasks WHERE column_id = $1', [req.params.id]);
  if (rows[0].n > 0) return res.status(409).json({ error: 'column is not empty — move or delete its tasks first' });
  const { rowCount } = await query('DELETE FROM board_columns WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'column not found' });
  res.json({ ok: true });
});

// Daily scrum notes — discussion points + action items per day
app.get('/api/scrum', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const offset = Number(req.query.offset) || 0;
  const q = (req.query.q || '').trim();
  const where = q
    ? `WHERE points::text ILIKE '%' || $3 || '%' OR action_items::text ILIKE '%' || $3 || '%'`
    : '';
  const params = q ? [limit, offset, q] : [limit, offset];
  const [rows, count] = await Promise.all([
    query(`SELECT * FROM daily_notes ${where} ORDER BY note_date DESC LIMIT $1 OFFSET $2`, params),
    q
      ? query(
          `SELECT COUNT(*)::int AS n FROM daily_notes
           WHERE points::text ILIKE '%' || $1 || '%' OR action_items::text ILIKE '%' || $1 || '%'`,
          [q]
        )
      : query('SELECT COUNT(*)::int AS n FROM daily_notes'),
  ]);
  res.json({ notes: rows.rows, total: count.rows[0].n });
});

app.put('/api/scrum/:date', async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const { points = [], action_items = [] } = req.body;
  const { rows } = await query(
    `INSERT INTO daily_notes (note_date, points, action_items)
     VALUES ($1::date, $2::jsonb, $3::jsonb)
     ON CONFLICT (note_date) DO UPDATE
       SET points = EXCLUDED.points,
           action_items = EXCLUDED.action_items,
           updated_at = now()
     RETURNING *`,
    [req.params.date, JSON.stringify(points), JSON.stringify(action_items)]
  );
  res.json(rows[0]);
});

app.delete('/api/scrum/:date', async (req, res) => {
  const { rowCount } = await query('DELETE FROM daily_notes WHERE note_date = $1::date', [req.params.date]);
  if (!rowCount) return res.status(404).json({ error: 'note not found' });
  res.json({ ok: true });
});

// Scrum notes export — text
const fetchScrumNotes = async (from, to) => {
  const { rows } = await query(
    `SELECT to_char(note_date, 'YYYY-MM-DD') AS note_date, points, action_items
     FROM daily_notes
     WHERE note_date BETWEEN $1::date AND $2::date
     ORDER BY note_date`,
    [from, to]
  );
  return rows;
};

app.get('/api/scrum-export', async (req, res) => {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
    return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
  }
  const notes = await fetchScrumNotes(from, to);

  let out = `Scrum Notes (${fmt(from)} – ${fmt(to)})\n`;
  for (const n of notes) {
    out += `\n${fmt(n.note_date)}\n`;
    if (n.points.length) {
      out += 'Discussion points:\n';
      for (const p of n.points) {
        const text = typeof p === 'string' ? p : p.text;
        const owner = typeof p === 'object' && p.owner ? ` (@${p.owner})` : '';
        out += `- ${text}${owner}\n`;
      }
    }
    if (n.action_items.length) {
      out += 'Action items:\n';
      for (const a of n.action_items) out += `- [${a.done ? 'x' : ' '}] ${a.text}\n`;
    }
  }
  res.type('text/plain').send(out);
});

// Scrum notes export — styled Excel
app.get('/api/scrum-export.xlsx', async (req, res) => {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
    return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
  }
  const notes = await fetchScrumNotes(from, to);

  const wb = new ExcelJS.Workbook();

  // Sheet 1 — report layout
  const ws = wb.addWorksheet('Scrum Notes');
  ws.columns = [{ width: 4 }, { width: 20 }, { width: 90 }];
  ws.mergeCells('A1:C1');
  const title = ws.getCell('A1');
  title.value = `Scrum Notes (${fmt(from)} – ${fmt(to)})`;
  title.fill = solid('FF4F46E5');
  title.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 26;
  ws.addRow([]);

  for (const n of notes) {
    const dr = ws.addRow([]);
    ws.mergeCells(`A${dr.number}:C${dr.number}`);
    const dc = dr.getCell(1);
    dc.value = fmt(n.note_date);
    dc.fill = solid('FFE2E8F0');
    dc.font = { bold: true, color: { argb: 'FF1E293B' }, size: 12 };
    dc.alignment = { vertical: 'middle', indent: 1 };
    dr.height = 20;

    const section = (label) => {
      const r = ws.addRow([]);
      ws.mergeCells(`A${r.number}:C${r.number}`);
      const c = r.getCell(1);
      c.value = label;
      c.font = { bold: true, color: { argb: 'FF4F46E5' }, size: 11 };
      c.alignment = { indent: 1 };
    };

    if (n.points.length) {
      section('Discussion points');
      for (const p of n.points) {
        const text = typeof p === 'string' ? p : p.text;
        const line = typeof p === 'object' && p.owner ? `${text}  (@${p.owner})` : text;
        const r = ws.addRow([]);
        const dot = r.getCell(1);
        dot.value = '•';
        dot.font = { color: { argb: 'FF94A3B8' } };
        dot.alignment = { horizontal: 'center', vertical: 'top' };
        const c = r.getCell(3);
        c.value = line;
        c.alignment = { wrapText: true, vertical: 'top' };
        r.height = Math.max(16, Math.ceil(line.length / 85) * 15);
      }
    }
    if (n.action_items.length) {
      section('Action items');
      for (const a of n.action_items) {
        const r = ws.addRow([]);
        const dot = r.getCell(1);
        dot.value = a.done ? '☑' : '☐';
        dot.font = { color: { argb: a.done ? 'FF10B981' : 'FF94A3B8' } };
        dot.alignment = { horizontal: 'center', vertical: 'top' };
        const status = r.getCell(2);
        status.value = a.done ? 'Done' : 'Open';
        status.font = { color: { argb: a.done ? 'FF10B981' : 'FFF59E0B' }, size: 10 };
        status.alignment = { vertical: 'top' };
        const c = r.getCell(3);
        c.value = a.text;
        c.font = a.done ? { color: { argb: 'FF94A3B8' }, strike: true } : {};
        c.alignment = { wrapText: true, vertical: 'top' };
        r.height = Math.max(16, Math.ceil(a.text.length / 85) * 15);
      }
    }
    ws.addRow([]);
  }
  ws.eachRow((row) => row.eachCell((c) => { c.border = BORDER; }));

  // Sheet 2 — flat table
  const tbl = wb.addWorksheet('Table');
  tbl.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Item', key: 'item', width: 100 },
    { header: 'Status', key: 'status', width: 10 },
  ];
  const head = tbl.getRow(1);
  head.height = 20;
  head.eachCell((c) => {
    c.fill = solid('FF4F46E5');
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle' };
    c.border = BORDER;
  });
  tbl.autoFilter = 'A1:D1';
  for (const n of notes) {
    for (const p of n.points) {
      const text = typeof p === 'string' ? p : p.text;
      const item = typeof p === 'object' && p.owner ? `${text} (@${p.owner})` : text;
      const r = tbl.addRow({ date: fmt(n.note_date), type: 'Discussion', item, status: '' });
      r.getCell(3).alignment = { wrapText: true, vertical: 'top' };
      r.eachCell((c) => { c.border = BORDER; });
    }
    for (const a of n.action_items) {
      const r = tbl.addRow({
        date: fmt(n.note_date),
        type: 'Action item',
        item: a.text,
        status: a.done ? 'Done' : 'Open',
      });
      r.getCell(4).font = { bold: true, color: { argb: a.done ? 'FF10B981' : 'FFF59E0B' } };
      r.getCell(3).alignment = { wrapText: true, vertical: 'top' };
      r.eachCell((c) => { c.border = BORDER; });
    }
  }
  tbl.views = [{ state: 'frozen', ySplit: 1 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="scrum-notes-${from}-to-${to}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// Single scrum note by date (placed after /api/scrum-export* so they win)
app.get('/api/scrum/:date', async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const { rows } = await query('SELECT * FROM daily_notes WHERE note_date = $1::date', [req.params.date]);
  if (!rows.length) return res.status(404).json({ error: 'note not found' });
  res.json(rows[0]);
});

// Export daily-work-update format for a date range
const fmt = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const joinNames = (names) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;

const fetchUpdates = async (from, to) => {
  const { rows } = await query(
    `SELECT to_char(t.work_date, 'YYYY-MM-DD') AS work_date,
            COALESCE(p.name, 'General') AS project,
            p.color AS project_color,
            t.title, t.items, t.position
     FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.work_date BETWEEN $1::date AND $2::date
     ORDER BY t.work_date, t.position`,
    [from, to]
  );
  const byDate = new Map();
  for (const r of rows) {
    const bullets = r.items?.length ? r.items : r.title ? [r.title] : [];
    if (!byDate.has(r.work_date)) byDate.set(r.work_date, new Map());
    const byProj = byDate.get(r.work_date);
    if (!byProj.has(r.project)) byProj.set(r.project, { color: r.project_color, items: [] });
    byProj.get(r.project).items.push(...bullets);
  }
  return byDate;
};

app.get('/api/export', async (req, res) => {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
    return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
  }
  const byDate = await fetchUpdates(from, to);

  let out = `Daily Work Updates (${fmt(from)} – ${fmt(to)})\n`;
  for (const [date, projects] of byDate) {
    const names = [...projects.keys()];
    out += `\n${fmt(date)} – ${joinNames(names)}\n`;
    if (names.length === 1) {
      for (const t of projects.get(names[0]).items) out += `- ${t}\n`;
    } else {
      for (const [proj, data] of projects) {
        out += `${proj}\n`;
        for (const t of data.items) out += `- ${t}\n`;
      }
    }
  }

  res.type('text/plain').send(out);
});

// Same export as a styled Excel file
const tint = (hex, f = 0.88) => {
  const n = parseInt((hex || '#94a3b8').slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * f).toString(16).padStart(2, '0');
  return `FF${mix(n >> 16 & 255)}${mix(n >> 8 & 255)}${mix(n & 255)}`.toUpperCase();
};
const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const BORDER = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

app.get('/api/export.xlsx', async (req, res) => {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
    return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
  }
  const byDate = await fetchUpdates(from, to);

  const wb = new ExcelJS.Workbook();

  // Sheet 1 — formatted report (mirrors the text update)
  const ws = wb.addWorksheet('Work Updates');
  ws.columns = [{ width: 4 }, { width: 110 }];

  ws.mergeCells('A1:B1');
  const title = ws.getCell('A1');
  title.value = `Daily Work Updates (${fmt(from)} – ${fmt(to)})`;
  title.fill = solid('FF4F46E5');
  title.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 26;
  ws.addRow([]);

  for (const [date, projects] of byDate) {
    const names = [...projects.keys()];
    const dr = ws.addRow([]);
    ws.mergeCells(`A${dr.number}:B${dr.number}`);
    const dc = dr.getCell(1);
    dc.value = `${fmt(date)} – ${joinNames(names)}`;
    dc.fill = solid('FFE2E8F0');
    dc.font = { bold: true, color: { argb: 'FF1E293B' }, size: 12 };
    dc.alignment = { vertical: 'middle', indent: 1 };
    dr.height = 20;

    for (const [proj, data] of projects) {
      if (names.length > 1) {
        const pr = ws.addRow([]);
        ws.mergeCells(`A${pr.number}:B${pr.number}`);
        const pc = pr.getCell(1);
        pc.value = proj;
        pc.fill = solid(tint(data.color));
        pc.font = { bold: true, color: { argb: `FF${(data.color || '#475569').slice(1).toUpperCase()}` }, size: 11 };
        pc.alignment = { vertical: 'middle', indent: 1 };
      }
      for (const item of data.items) {
        const r = ws.addRow([]);
        const dot = r.getCell(1);
        dot.value = '•';
        dot.font = { color: { argb: 'FF94A3B8' } };
        dot.alignment = { horizontal: 'center', vertical: 'top' };
        const cell = r.getCell(2);
        cell.value = item;
        cell.alignment = { wrapText: true, vertical: 'top' };
        r.height = Math.max(16, Math.ceil(item.length / 95) * 15);
      }
    }
    ws.addRow([]);
  }
  ws.eachRow((row) => row.eachCell((c) => { c.border = BORDER; }));

  // Sheet 2 — flat table with filters (one row per work item)
  const tbl = wb.addWorksheet('Table');
  tbl.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Project', key: 'project', width: 28 },
    { header: 'Work update', key: 'item', width: 110 },
  ];
  const head = tbl.getRow(1);
  head.height = 20;
  head.eachCell((c) => {
    c.fill = solid('FF4F46E5');
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle' };
    c.border = BORDER;
  });
  tbl.autoFilter = 'A1:C1';
  for (const [date, projects] of byDate) {
    for (const [proj, data] of projects) {
      for (const item of data.items) {
        const r = tbl.addRow({ date: fmt(date), project: proj, item });
        r.getCell(2).font = {
          bold: true,
          color: { argb: `FF${(data.color || '#475569').slice(1).toUpperCase()}` },
        };
        r.getCell(3).alignment = { wrapText: true, vertical: 'top' };
        r.height = Math.max(15, Math.ceil(item.length / 100) * 15);
        r.eachCell((c) => { c.border = BORDER; });
      }
    }
  }
  tbl.views = [{ state: 'frozen', ySplit: 1 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="work-updates-${from}-to-${to}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

app.use((err, req, res, next) => {
  if (err?.code === '23505') return res.status(409).json({ error: 'already exists' });
  console.error(err);
  res.status(500).json({ error: 'something went wrong' });
});

const port = process.env.PORT || 4100;
// Vercel imports this file as a serverless handler — only listen when running locally
if (!process.env.VERCEL) {
  app.listen(port, '127.0.0.1', () => console.log(`API on http://localhost:${port}`));
}

export default app;
