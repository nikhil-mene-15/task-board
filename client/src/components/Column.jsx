import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';

const COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899'];

export default function Column({ column, index, dragDisabled, onAddTask, onEditTask, onDeleteTask }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });
  const color = COLORS[index % COLORS.length];

  return (
    <div className="flex-1 min-w-0 flex flex-col max-h-full rounded-xl bg-white/70 ring-1 ring-slate-200">
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 rounded-t-xl"
        style={{ borderTop: `3px solid ${color}` }}
      >
        <span className="text-sm font-semibold text-slate-700">{column.title}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {column.tasks.length}
        </span>
        <button
          onClick={() => onAddTask(column.id)}
          className="ml-auto text-slate-400 hover:text-slate-700 text-lg leading-none px-1"
          title="Add task"
        >
          +
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2.5 min-h-24 transition-colors ${
          isOver ? 'bg-slate-100/80' : ''
        }`}
      >
        <SortableContext
          items={column.tasks.map((t) => `task-${t.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              disabled={dragDisabled}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
            />
          ))}
        </SortableContext>
        {column.tasks.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-6 border border-dashed border-slate-300 rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
