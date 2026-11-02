# Task Board

Personal kanban board for tracking daily work — React + Express + Postgres (Neon).

One card per project per day. Each card holds that day's bullet points, and the board can export them as a ready-to-paste **Daily Work Updates** report (text or styled Excel).

## Features

- **Kanban board** — To Do / In Progress / In Review / Done columns, drag & drop cards
- **Day cards** — one card per project per date, containing the day's work as bullets
- **Auto-merge** — adding items for a project + date that already has a card appends to it
- **Soft project colors** — cards are tinted with their project's color
- **Search & filters** — by project, title, items, or tags (drag pauses while filtering)
- **Export** — pick a date range →
  - **Copy to clipboard**: `Daily Work Updates` text, grouped by date → project → bullets
  - **Download Excel**: styled `.xlsx` with a formatted report sheet + a filterable table sheet
- **Projects** — create projects with color badges

## Setup

The project is wired to Neon via `neon.ts` and the `neon` CLI.

```bash
npm install                          # root deps (@neon/config, @neon/env, concurrently)
npm install --prefix server
npm install --prefix client
neon env pull                        # refresh .env.local with DATABASE_URL etc.
npm run migrate                      # create tables (unpooled connection)
npm run seed                         # your 16–29 Oct work items -> "Done" column
npm run dev                          # API :4100 + UI http://localhost:5173
npm run build                        # production build of the client
```

## Env vars

`.env.local` (gitignored, managed by `neon env pull`):

| Var | Used by |
| --- | --- |
| `DATABASE_URL` | Express app pool (pooled / PgBouncer) |
| `DATABASE_URL_UNPOOLED` | `migrate` / `seed` / `consolidate` scripts (direct, for DDL) |
| `NEON_BRANCH` | current branch name |
| `PORT` | API port (default 4100) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs API (`:4100`) + Vite dev server (`:5173`) together |
| `npm run build` | Production build of the client |
| `npm run migrate` | Applies `server/src/schema.sql` |
| `npm run seed` | Seeds columns, projects, and October work items |
| `npm run seed -- --force` | Wipes tasks and reseeds |
| `npm run consolidate` | One-off migration: dedupes columns, merges tasks into day-cards |

## Project structure

```
task-board/
├── neon.ts              # Neon service config + branch policy
├── .env.local           # pulled by `neon env pull` (gitignored)
├── server/              # Express + pg API
│   └── src/
│       ├── index.js     # routes: board, tasks, reorder, projects, columns, export (+xlsx)
│       ├── db.js        # pooled connection (DATABASE_URL)
│       ├── schema.sql   # tables: projects, board_columns, tasks(items[])
│       ├── migrate.js   # applies schema (unpooled)
│       ├── seed.js      # seeds Oct work items as day-cards
│       └── consolidate.js
└── client/              # Vite + React 19 + Tailwind v4 + dnd-kit
    └── src/
        ├── App.jsx            # board state, filters, modals
        └── components/
            ├── Board.jsx      # DndContext, cross-column drag
            ├── Column.jsx     # droppable column
            ├── TaskCard.jsx   # sortable card (project tint, bullets, tags)
            ├── TaskModal.jsx  # add/edit: items one-per-line, project, date, tags
            ├── ExportModal.jsx# text export + Excel download
            ├── ProjectModal.jsx
            └── Header.jsx
```

## Notes

- API binds to `127.0.0.1` only — safe for local use; add auth before deploying
- `DATE` columns are returned as `YYYY-MM-DD` strings to avoid timezone shifts
- Column titles are `UNIQUE`; deleting a column is refused while it has tasks

hi
