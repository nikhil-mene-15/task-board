import { useEffect, useState } from 'react';
import {
  BsFillInfoCircleFill,
  BsFillExclamationTriangleFill,
  BsCheckCircleFill,
  BsXLg,
} from 'react-icons/bs';
import { onToast } from '../toast';

const TTL = 4000;

const STYLES = {
  info: 'bg-slate-800 border-slate-700 text-slate-100',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-700',
};

const ICONS = {
  info: <BsFillInfoCircleFill className="text-indigo-300" />,
  success: <BsCheckCircleFill className="text-emerald-500" />,
  error: <BsFillExclamationTriangleFill className="text-red-400" />,
};

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(
    () =>
      onToast((t) => {
        setToasts((ts) => [...ts, t]);
        setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), TTL);
      }),
    []
  );

  const dismiss = (id) => setToasts((ts) => ts.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in pointer-events-auto flex items-start gap-2.5 max-w-sm px-4 py-3 rounded-xl border shadow-lg text-sm ${STYLES[t.type] || STYLES.info}`}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.type] || ICONS.info}</span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="mt-1 shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
          >
            <BsXLg size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
