import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import Column from './Column';
import TaskCard from './TaskCard';

const colKey = (id) => `col-${id}`;
const taskKey = (id) => `task-${id}`;

export default function Board({ columns, dragDisabled, onMove, onAddTask, onEditTask, onDeleteTask }) {
  const [activeTask, setActiveTask] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const findColumn = (id) =>
    columns.find((c) => colKey(c.id) === id || c.tasks.some((t) => taskKey(t.id) === id));

  const handleDragStart = ({ active }) => {
    const col = findColumn(active.id);
    setActiveTask(col?.tasks.find((t) => taskKey(t.id) === active.id) ?? null);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const src = findColumn(active.id);
    const dst = findColumn(over.id);
    if (!src || !dst) return;

    const next = columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
    const overIsColumn = String(over.id).startsWith('col-');

    if (src.id === dst.id) {
      const col = next.find((c) => c.id === src.id);
      const oldIndex = col.tasks.findIndex((t) => taskKey(t.id) === active.id);
      const overIndex = overIsColumn
        ? col.tasks.length - 1
        : col.tasks.findIndex((t) => taskKey(t.id) === over.id);
      col.tasks = arrayMove(col.tasks, oldIndex, overIndex < 0 ? col.tasks.length - 1 : overIndex);
    } else {
      const srcCol = next.find((c) => c.id === src.id);
      const dstCol = next.find((c) => c.id === dst.id);
      const from = srcCol.tasks.findIndex((t) => taskKey(t.id) === active.id);
      const [moved] = srcCol.tasks.splice(from, 1);
      const insertAt = overIsColumn
        ? dstCol.tasks.length
        : dstCol.tasks.findIndex((t) => taskKey(t.id) === over.id);
      dstCol.tasks.splice(insertAt < 0 ? dstCol.tasks.length : insertAt, 0, moved);
    }
    onMove(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex-1 overflow-x-auto scrollbar-thin">
        <div className="flex gap-5 px-8 py-5 h-full items-stretch w-full">
          {columns.map((col, i) => (
            <Column
              key={col.id}
              column={col}
              index={i}
              dragDisabled={dragDisabled}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
