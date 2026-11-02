export default function Header({
  view,
  setView,
  search,
  setSearch,
  projectFilter,
  setProjectFilter,
  projects,
  onExport,
  onNewProject,
  onNewTask,
}) {
  const tab = (v, label) => (
    <button
      onClick={() => setView(v)}
      className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
        view === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-wrap">
      <div className="flex items-center gap-2 mr-1">
        <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
          T
        </span>
        <h1 className="font-semibold text-slate-800">Task Board</h1>
      </div>

      <nav className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mr-2">
        {tab('board', 'Board')}
        {tab('scrum', 'Scrum')}
      </nav>

      {view === 'board' && (
        <>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or tags…"
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onNewProject}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              + Project
            </button>
            <button
              onClick={onExport}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Export update
            </button>
            <button
              onClick={onNewTask}
              className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              + Task
            </button>
          </div>
        </>
      )}
    </header>
  );
}
