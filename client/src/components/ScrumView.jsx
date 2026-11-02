import { useEffect, useState } from 'react';
import { api } from '../api';
import ExportModal from './ExportModal';
import TrashIcon from './TrashIcon';
import { toast } from '../toast';
import { confirmDialog } from '../confirm';
import Spinner from './Spinner';
import { BsFillPersonFill, BsFillCalendarFill } from 'react-icons/bs';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
};
const fmtRail = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { day: DAYS[new Date(y, m - 1, d).getDay()], short: `${d} ${MONTHS[m - 1]}`, year: y };
};

// stable color per date — same day always gets the same tint
const TINTS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899'];
const cardTint = (iso) => TINTS[Number(iso.slice(8, 10)) % TINTS.length];

function NoteCard({ note, onSave, onDelete, onCarry, onPromote, hideDate, isToday }) {
  const tint = cardTint(note.note_date);
  const hasContent = note.points.length > 0 || note.action_items.length > 0;
  const [editing, setEditing] = useState(!hasContent);
  const normPoints = note.points.map((p) =>
    typeof p === 'string' ? { text: p, owner: '' } : { owner: '', ...p }
  );
  const [pointItems, setPointItems] = useState(normPoints);
  const [newPoint, setNewPoint] = useState('');
  const [items, setItems] = useState(note.action_items);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  const cleanPoints = () =>
    pointItems
      .map((p) => ({ text: p.text.trim(), owner: (p.owner || '').trim() }))
      .filter((p) => p.text);
  const dirty =
    JSON.stringify(cleanPoints()) !== JSON.stringify(normPoints) ||
    JSON.stringify(items) !== JSON.stringify(note.action_items);
  const openItems = note.action_items.filter((i) => !i.done).length;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(note.note_date, {
        points: cleanPoints(),
        action_items: items,
      });
    } catch (e) {
      toast(`Save failed: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // checkbox toggles save immediately — status change, not an edit
  const toggleSaved = (idx) =>
    onSave(note.note_date, {
      points: note.points,
      action_items: note.action_items.map((i, j) => (j === idx ? { ...i, done: !i.done } : i)),
    }).catch((e) => toast(`Save failed: ${e.message}`, 'error'));

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setNewItem('');
    setItems([...items, { text, done: false }]);
  };

  const addPoint = () => {
    const text = newPoint.trim();
    if (!text) return;
    setNewPoint('');
    setPointItems([...pointItems, { text, owner: '' }]);
  };

  return (
    <div
      style={{
        backgroundColor: `${tint}0f`,
        borderTop: `3px solid ${tint}`,
      }}
      className={`group rounded-lg p-4 shadow-sm flex flex-col h-80 ${
        isToday ? 'ring-2 ring-indigo-400' : 'ring-1 ring-slate-200'
      }`}
    >
      {/* card header — like a board card */}
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-100">
        {!hideDate && (
          <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            {fmtDate(note.note_date)}
          </span>
        )}
        {isToday && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
            TODAY
          </span>
        )}
        {openItems > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            {openItems} open
          </span>
        )}
        {editing && dirty && (
          <span className="text-[10px] font-medium text-indigo-600">unsaved</span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          {onCarry && (
            <button
              onClick={onCarry}
              className="text-[11px] text-slate-400 hover:text-indigo-600 px-1"
              title="Carry open items from earlier days"
            >
              ⤷
            </button>
          )}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] text-slate-400 hover:text-indigo-600 px-1"
              title="Edit"
            >
              ✎
            </button>
          ) : hasContent ? (
            <button
              onClick={() => setEditing(false)}
              className="text-[11px] text-slate-400 hover:text-slate-600 px-1"
              title="Cancel"
            >
              Cancel
            </button>
          ) : null}
          <button
            onClick={() => onDelete(note.note_date)}
            className="inline-flex text-slate-400 hover:text-red-500 px-1"
            title="Delete note"
          >
            <TrashIcon />
          </button>
        </span>
      </div>

      {editing && (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2.5">
          <ul className="space-y-1.5">
            {pointItems.map((p, i) => (
              <li key={i} className="group/pt flex items-center gap-1.5">
                <input
                  value={p.text}
                  onChange={(e) =>
                    setPointItems(pointItems.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                  placeholder="Discussion point…"
                  className="flex-1 px-2 py-1.5 text-[13px] rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                />
                <input
                  value={p.owner || ''}
                  onChange={(e) =>
                    setPointItems(pointItems.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))
                  }
                  placeholder="@owner"
                  className="w-24 px-1.5 py-1.5 text-[11px] rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                />
                <button
                  onClick={() => setPointItems(pointItems.filter((_, j) => j !== i))}
                  className="hidden group-hover/pt:inline-flex text-slate-300 hover:text-red-500"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
          <input
            value={newPoint}
            onChange={(e) => setNewPoint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPoint()}
            placeholder="+ discussion point… (Enter)"
            className="w-full px-2.5 py-1.5 text-[13px] rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="group/item">
                <div className="flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => setItems(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <span className={`flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                    className="hidden group-hover/item:inline-flex text-slate-300 hover:text-red-500"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-1.5 ml-6 mt-0.5">
                  <input
                    value={item.owner || ''}
                    onChange={(e) =>
                      setItems(items.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))
                    }
                    placeholder="@owner"
                    className="w-24 px-1.5 py-0.5 text-[11px] rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <input
                    type="date"
                    value={item.due_date || ''}
                    onChange={(e) =>
                      setItems(items.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)))
                    }
                    className="px-1.5 py-0.5 text-[11px] rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>
              </li>
            ))}
          </ul>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="+ action item… (Enter)"
            className="w-full px-2.5 py-1.5 text-[13px] rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
      )}
      {editing && (
        <div className="flex justify-end mt-3 shrink-0">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving && <Spinner size={12} className="text-white" />}
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      )}
      {!editing && (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {note.points.length > 0 && (
            <div className="mb-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Discussion
              </p>
              <ul className="space-y-1">
              {note.points.map((p, i) => {
                const text = typeof p === 'string' ? p : p.text;
                const owner = typeof p === 'object' ? p.owner : null;
                return (
                  <li key={i} className="text-[13px] leading-snug text-slate-700 flex items-start gap-1.5">
                    <span className="text-slate-300 shrink-0">•</span>
                    <span className="flex-1">{text}</span>
                    {owner && (
                      <span className="text-slate-500 ml-auto inline-flex items-center gap-0.5 shrink-0">
                        <BsFillPersonFill size={10} /> {owner}
                      </span>
                    )}
                  </li>
                );
              })}
              </ul>
            </div>
          )}
          {note.action_items.length > 0 && (
            <div className={`${note.points.length ? 'pt-2 border-t border-slate-100' : ''}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Action items
              </p>
              <ul className="space-y-1">
                {note.action_items.map((item, i) => (
                  <li key={i} className="group/item flex items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleSaved(i)}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <span className={`flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {item.text}
                      {(item.owner || item.due_date) && (
                        <span className="block text-[11px] mt-0.5">
                          {item.owner && (
                            <span className="text-slate-500 mr-2 inline-flex items-center gap-0.5">
                              <BsFillPersonFill size={11} /> {item.owner}
                            </span>
                          )}
                          {item.due_date && (
                            <span
                              className={`inline-flex items-center gap-0.5 ${
                                !item.done && item.due_date < today
                                  ? 'text-red-500 font-medium'
                                  : 'text-slate-400'
                              }`}
                            >
                              <BsFillCalendarFill size={10} />{' '}
                              {item.due_date.slice(0, 10).split('-').reverse().join('/')}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onPromote?.(item.text, note.note_date)}
                      className="hidden group-hover/item:inline text-[10px] text-indigo-500 hover:underline shrink-0"
                      title="Create a board card from this"
                    >
                      →board
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasContent && (
            <p className="text-xs text-slate-400 italic">Empty — hover and press ✎ to add.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScrumView({ columns, onPromote }) {
  const PAGE = 6;
  const [notes, setNotes] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [newDate, setNewDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [layout, setLayout] = useState('grid'); // 'grid' | 'timeline'
  const today = todayISO();

  const pages = Math.max(1, Math.ceil(total / PAGE));

  const load = async (q = search, p = page) => {
    setLoading(true);
    try {
      const { notes: rows, total } = await api.scrum({ limit: PAGE, offset: p * PAGE, q });
      if (p === 0 && !q && !rows.some((n) => n.note_date === today)) {
        rows.unshift({ note_date: today, points: [], action_items: [], _new: true });
      }
      setNotes(rows);
      setTotal(total);
      return rows;
    } finally {
      setLoading(false);
    }
  };

  const goTo = (p) => {
    setPage(p);
    load(search, p).catch((e) => setLoadError(e.message));
  };

  // debounced server-side search — resets to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      load(search, 0).catch((e) => setLoadError(e.message));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const save = async (date, payload) => {
    const row = await api.saveScrumNote(date, payload);
    setLoadError(null);
    // PUT returns the saved note — patch state directly, no refetch
    setNotes((prev) => prev.map((n) => (n.note_date === date ? row : n)));
    toast('Note saved.', 'success');
  };

  const del = async (date) => {
    if (!(await confirmDialog(`Delete the scrum note for ${date}?`))) return;
    if (date === today) {
      const row = await api.saveScrumNote(date, { points: [], action_items: [] });
      setNotes((prev) => prev.map((n) => (n.note_date === date ? row : n)));
      toast('Note cleared.', 'success');
    } else {
      await api.deleteScrumNote(date);
      toast('Note deleted.', 'success');
      const rows = await load(search, page).catch(() => null);
      if (page > 0 && rows && !rows.length) goTo(page - 1);
    }
  };

  const carry = async () => {
    const earlier = notes
      .filter((n) => n.note_date < today)
      .flatMap((n) => n.action_items.filter((i) => !i.done).map((i) => i.text));
    if (!earlier.length) return toast('No open action items on earlier days.');
    const todayNote = notes.find((n) => n.note_date === today);
    await save(today, {
      points: todayNote.points,
      action_items: [
        ...todayNote.action_items,
        ...earlier
          .filter((t) => !todayNote.action_items.some((i) => i.text === t))
          .map((text) => ({ text, done: false })),
      ],
    });
  };

  const addNote = async () => {
    if (!newDate) return;
    if (notes.some((n) => n.note_date === newDate)) {
      return toast('A note for this date already exists — edit it on its card.');
    }
    // the note may exist on an unloaded page — check the server to avoid overwriting it
    const exists = await api.scrumNote(newDate).then(() => true).catch(() => false);
    if (exists) {
      return toast('A note for this date already exists — search for its date to find it.');
    }
    setNotes(
      [...notes, { note_date: newDate, points: [], action_items: [], _new: true }]
        .sort((a, b) => b.note_date.localeCompare(a.note_date))
    );
  };

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Couldn't load scrum notes: {loadError}
      </div>
    );
  }
  if (!notes) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner size={24} />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-8 py-5">
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search points or action items…"
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setLayout('grid')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${
                layout === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              ▦ Grid
            </button>
            <button
              onClick={() => setLayout('timeline')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${
                layout === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              ☰ Timeline
            </button>
          </div>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            onClick={addNote}
            className="px-3.5 py-1.5 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            + New note
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="px-3.5 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Export
          </button>
        </div>
      </div>
      {layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {notes.map((note) => (
            <NoteCard
              key={note.note_date + (note.updated_at || '')}
              note={note}
              onSave={save}
              onDelete={del}
              onCarry={note.note_date === today ? carry : null}
              onPromote={onPromote}
              isToday={note.note_date === today}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          {notes.map((note) => {
            const rail = fmtRail(note.note_date);
            return (
              <div key={note.note_date + (note.updated_at || '')} className="flex gap-4">
                <div className="w-24 shrink-0 text-right pr-4 pt-2 border-r-2 border-indigo-200 relative">
                  <div className="text-sm font-semibold text-slate-800">{rail.short}</div>
                  <div className="text-[11px] text-slate-400">
                    {rail.day} {rail.year}
                  </div>
                  <span className="absolute top-3 -right-[5px] w-2 h-2 rounded-full bg-indigo-500" />
                </div>
                <div className="flex-1 pb-6">
                  <NoteCard
                    note={note}
                    onSave={save}
                    onDelete={del}
                    onCarry={note.note_date === today ? carry : null}
                    onPromote={onPromote}
                    hideDate
                    isToday={note.note_date === today}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {total > PAGE && (
        <div className="flex items-center justify-center gap-1.5 mt-4 mb-6">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 0 || loading}
            className="px-2.5 py-1 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          >
            ‹
          </button>
          {[...Array(pages).keys()]
            .filter((i) => i === 0 || i === pages - 1 || Math.abs(i - page) <= 2)
            .map((i, idx, arr) => (
              <span key={i} className="flex items-center gap-1.5">
                {idx > 0 && arr[idx - 1] !== i - 1 && (
                  <span className="text-slate-400">…</span>
                )}
                <button
                  onClick={() => goTo(i)}
                  disabled={loading}
                  className={`w-8 h-8 text-sm rounded-lg ${
                    i === page
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              </span>
            ))}
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= pages - 1 || loading}
            className="px-2.5 py-1 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          >
            ›
          </button>
          <span className="text-[11px] text-slate-400 ml-2">{total} notes</span>
        </div>
      )}
      {notes.length === 0 && (
        <p className="text-center text-sm text-slate-400 mt-8">No notes match.</p>
      )}
      {exportOpen && <ExportModal kind="scrum" onClose={() => setExportOpen(false)} />}
      {notes.length <= 1 && (
        <p className="text-center text-sm text-slate-400 mt-8">
          Type points and press "Save note" — today's card saves and stays here.
        </p>
      )}
    </div>
  );
}
