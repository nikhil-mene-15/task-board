import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import Header from './components/Header';
import Board from './components/Board';
import ScrumView from './components/ScrumView';
import TaskModal from './components/TaskModal';
import ExportModal from './components/ExportModal';
import ProjectModal from './components/ProjectModal';
import Toaster from './components/Toaster';
import Confirmer from './components/Confirmer';
import Spinner from './components/Spinner';
import { toast } from './toast';
import { confirmDialog } from './confirm';

export default function App() {
  const [board, setBoard] = useState({ columns: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [taskModal, setTaskModal] = useState(null); // { task? , columnId? }
  const [exportOpen, setExportOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [view, setView] = useState('board'); // 'board' | 'scrum'

  const load = useCallback(async () => setBoard(await api.board()), []);

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  const filtersActive = search.trim() !== '' || projectFilter !== 'all';

  const visibleColumns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return board.columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter(
        (t) =>
          (projectFilter === 'all' || t.project_id === Number(projectFilter)) &&
          (!q ||
            t.title.toLowerCase().includes(q) ||
            (t.items || []).some((item) => item.toLowerCase().includes(q)) ||
            (t.tags || []).some((tag) => tag.toLowerCase().includes(q)))
      ),
    }));
  }, [board, search, projectFilter]);

  const handleMove = (newColumns) => {
    const changed = newColumns.filter((nc) => {
      const oc = board.columns.find((c) => c.id === nc.id);
      return (
        !oc || JSON.stringify(oc.tasks.map((t) => t.id)) !== JSON.stringify(nc.tasks.map((t) => t.id))
      );
    });
    setBoard((b) => ({ ...b, columns: newColumns }));
    api
      .reorder(changed.map((c) => ({ id: c.id, task_ids: c.tasks.map((t) => t.id) })))
      .catch((e) => {
        console.error(e);
        load();
      });
  };

  // apply a saved task to local state instantly — covers create, update,
  // and same-project+same-date merge (server returns the merged card)
  const upsertTask = (task) =>
    setBoard((b) => {
      const p = b.projects.find((x) => x.id === task.project_id);
      const t = { ...task, project_name: p?.name ?? null, project_color: p?.color ?? null };
      const columns = b.columns.map((c) => ({ ...c, tasks: c.tasks.filter((x) => x.id !== t.id) }));
      const col = columns.find((c) => c.id === t.column_id) ?? columns[0];
      col.tasks.splice(Math.min(t.position, col.tasks.length), 0, t);
      return { ...b, columns };
    });

  const saveTask = async (payload, taskId) => {
    const saved = taskId ? await api.updateTask(taskId, payload) : await api.createTask(payload);
    upsertTask(saved);
    toast(taskId ? 'Task updated.' : 'Task added.', 'success');
    load().catch(() => {}); // silent consistency refresh
  };

  const deleteTask = async (id) => {
    if (!(await confirmDialog('Delete this task?'))) return;
    // remove instantly; rollback via reload on failure
    setBoard((b) => ({
      ...b,
      columns: b.columns.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== id) })),
    }));
    try {
      await api.deleteTask(id);
      toast('Task deleted.', 'success');
    } catch (e) {
      toast(`Delete failed: ${e.message}`, 'error');
      await load();
    }
  };

  // action item -> board card (lands in first column on the note's date)
  const promoteActionItem = async (text, date) => {
    const exists = board.columns.some((c) =>
      c.tasks.some((t) => t.items?.includes(text) || t.title === text)
    );
    if (exists) return toast('Already on the board.');
    await api.createTask({
      items: [text],
      column_id: board.columns[0]?.id,
      work_date: date,
    });
    await load();
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner size={28} />
        Loading board…
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-slate-600">
        <p className="font-semibold text-red-500">Couldn't load the board</p>
        <p className="text-sm max-w-md text-center">{error}</p>
        <p className="text-sm text-slate-400">
          Is the API running (npm run dev)? Run `neon env pull` if .env.local is missing.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header
        view={view}
        setView={setView}
        search={search}
        setSearch={setSearch}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        projects={board.projects}
        onExport={() => setExportOpen(true)}
        onNewProject={() => setProjectOpen(true)}
        onNewTask={() => setTaskModal({ columnId: board.columns[0]?.id })}
      />
      {view === 'board' ? (
        <Board
          columns={visibleColumns}
          dragDisabled={filtersActive}
          onMove={handleMove}
          onAddTask={(columnId) => setTaskModal({ columnId })}
          onEditTask={(task) => setTaskModal({ task })}
          onDeleteTask={deleteTask}
        />
      ) : (
        <ScrumView columns={board.columns} onPromote={promoteActionItem} />
      )}
      {taskModal && (
        <TaskModal
          task={taskModal.task}
          columnId={taskModal.columnId}
          projects={board.projects}
          columns={board.columns}
          owners={[...new Set(board.columns.flatMap((c) => c.tasks.map((t) => t.owner).filter(Boolean)))]}
          onClose={() => setTaskModal(null)}
          onSave={saveTask}
        />
      )}
      <Toaster />
      <Confirmer />
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      {projectOpen && (
        <ProjectModal
          onClose={() => setProjectOpen(false)}
          onCreate={async (p) => {
            await api.createProject(p);
            await load();
          }}
        />
      )}
    </div>
  );
}
