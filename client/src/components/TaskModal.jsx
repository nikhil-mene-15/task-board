import { useState } from 'react';
import { toast } from '../toast';
import Spinner from './Spinner';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function TaskModal({ task, columnId, projects, columns, owners = [], onClose, onSave }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [items, setItems] = useState((task?.items ?? []).join('\n'));
  const [projectId, setProjectId] = useState(task?.project_id ?? '');
  const [column, setColumn] = useState(task?.column_id ?? columnId ?? columns[0]?.id);
  const [workDate, setWorkDate] = useState(task?.work_date?.slice(0, 10) ?? today());
  const [dueDate, setDueDate] = useState(task?.due_date?.slice(0, 10) ?? '');
  const [owner, setOwner] = useState(task?.owner ?? '');
  const [tags, setTags] = useState((task?.tags ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const itemList = items
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  const canSave = (title.trim() || itemList.length) && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() && !itemList.length) return;
    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          items: itemList,
          project_id: projectId === '' ? null : Number(projectId),
          column_id: Number(column),
          work_date: workDate,
          due_date: dueDate || null,
          owner: owner.trim(),
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
        task?.id
      );
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-3"
      >
        <h2 className="font-semibold text-slate-800">{task ? 'Edit task' : 'New task'}</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Work date</span>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="mt-1 w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Column</span>
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              className="mt-1 w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Tags (comma separated)</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="api, aws, deploy"
              className="mt-1 w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Owner</span>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              list="task-owners"
              placeholder="e.g. Nikhil, Kathan"
              className="mt-1 w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <datalist id="task-owners">
              {owners.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Heading (optional) — e.g. Image Handling"
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        />

        <label className="block">
          <span className="text-xs font-medium text-slate-500">Work items — one per line</span>
          <textarea
            autoFocus
            value={items}
            onChange={(e) => setItems(e.target.value)}
            placeholder={'Deployed API to Lambda\nConfigured env variables\nShared update with the group'}
            rows={8}
            className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-y"
          />
          {!task && projectId !== '' && (
            <span className="text-[11px] text-slate-400">
              If this project already has a card for this date, these items are added to it.
            </span>
          )}
        </label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
        />

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving && <Spinner size={13} className="text-white" />}
            {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </form>
    </div>
  );
}
