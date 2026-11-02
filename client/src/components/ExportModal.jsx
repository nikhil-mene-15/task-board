import { useEffect, useState } from 'react';
import { api } from '../api';
import Spinner from './Spinner';

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const KIND = {
  work: { title: 'Export daily update', text: (f, t) => api.exportText(f, t), xlsx: '/api/export.xlsx' },
  scrum: { title: 'Export scrum notes', text: (f, t) => api.exportScrumText(f, t), xlsx: '/api/scrum-export.xlsx' },
};

export default function ExportModal({ onClose, kind = 'work' }) {
  const cfg = KIND[kind];
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [to, setTo] = useState(() => iso(new Date()));
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const generate = async (f = from, t = to) => {
    setLoading(true);
    try {
      setText(await cfg.text(f, t));
    } catch (e) {
      setText(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5"
      >
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="font-semibold text-slate-800 mr-auto">{cfg.title}</h2>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              generate(e.target.value, to);
            }}
            className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200"
          />
          <span className="text-slate-400 text-sm">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              generate(from, e.target.value);
            }}
            className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200"
          />
        </div>

        <div className="relative">
          <textarea
            readOnly
            value={loading ? '' : text}
            rows={16}
            className="w-full px-3 py-2 text-[13px] font-mono rounded-lg border border-slate-200 bg-slate-50 resize-y focus:outline-none"
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Spinner size={18} />
              Generating…
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          <a
            href={`${cfg.xlsx}?from=${from}&to=${to}`}
            download
            className="px-4 py-2 text-sm rounded-lg border border-emerald-600 text-emerald-700 font-medium hover:bg-emerald-50"
          >
            Download Excel
          </a>
          <button
            onClick={copy}
            disabled={!text}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
