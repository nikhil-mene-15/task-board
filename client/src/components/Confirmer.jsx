import { useEffect, useState } from 'react';
import { onConfirm } from '../confirm';

export default function Confirmer() {
  const [req, setReq] = useState(null);

  useEffect(() => onConfirm(setReq), []);
  if (!req) return null;

  const done = (ok) => {
    req.resolve(ok);
    setReq(null);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[70] p-4"
      onClick={() => done(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5 space-y-4"
      >
        <p className="text-sm text-slate-700">{req.message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => done(false)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={() => done(true)}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
