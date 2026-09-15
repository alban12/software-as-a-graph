import React, { useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';

export default function EdgeGuardrailToast({ alert, onClose }) {
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => {
      onClose?.();
    }, 4500);
    return () => clearTimeout(timer);
  }, [alert, onClose]);

  if (!alert) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-start gap-3 bg-slate-900/95 border border-rose-500/40 text-slate-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md max-w-lg">
        <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              Architectural Guardrail Blocked
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {alert.reason}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
