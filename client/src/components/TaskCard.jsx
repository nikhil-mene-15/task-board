import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BsFillPersonFill, BsFillCalendarFill, BsFillExclamationTriangleFill } from 'react-icons/bs';
import TrashIcon from './TrashIcon';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`;
};
const fmtShort = (d) => {
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]}`;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function TaskCard({ task, overlay, disabled, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task-${task.id}`,
    disabled,
  });
  const due = task.due_date ? String(task.due_date).slice(0, 10) : null;
  const overdue = due && due < todayISO();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(task.project_color ? { backgroundColor: `${task.project_color}12` } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group bg-white rounded-lg ring-1 ring-slate-200 p-3 shadow-sm select-none
        ${overlay ? 'shadow-lg rotate-1' : ''}
        ${isDragging ? 'opacity-40' : ''}
        ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:ring-slate-300'}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {task.project_name ? (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full truncate"
            style={{ backgroundColor: `${task.project_color}1a`, color: task.project_color }}
          >
            {task.project_name}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-slate-400 shrink-0">{fmtDate(task.work_date)}</span>
      </div>
      {task.title && (
        <p className="text-[13px] font-medium leading-snug text-slate-800">{task.title}</p>
      )}
      {(task.items || []).length > 0 && (
        <ul className={`space-y-1 ${task.title ? 'mt-1.5' : ''}`}>
          {task.items.map((item, i) => (
            <li key={i} className="text-[13px] leading-snug text-slate-700 flex gap-1.5">
              <span className="text-slate-300 shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {task.description && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {(task.tags || []).map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            {tag}
          </span>
        ))}
        {task.owner && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/5 text-slate-600 font-medium inline-flex items-center gap-0.5">
            <BsFillPersonFill size={10} /> {task.owner}
          </span>
        )}
        {due && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5 ${
              overdue ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700'
            }`}
          >
            {overdue ? <BsFillExclamationTriangleFill size={10} /> : <BsFillCalendarFill size={10} />}
            {fmtShort(due)}
          </span>
        )}
        <span className="ml-auto hidden group-hover:flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="text-[11px] text-slate-400 hover:text-indigo-600 px-1"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="inline-flex text-slate-400 hover:text-red-500 px-1"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </span>
      </div>
    </div>
  );
}
