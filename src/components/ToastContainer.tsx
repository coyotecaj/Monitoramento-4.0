import React, { useState, useEffect } from 'react';
import { MapPin, Check, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  submessage?: string;
  type: 'success' | 'info' | 'error';
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; submessage?: string; type: 'success' | 'info' | 'error' }>;
      const { message, submessage, type = 'success' } = customEvent.detail;
      const id = Date.now().toString() + Math.random().toString();

      setToasts(prev => [...prev, { id, message, submessage, type }]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4500);
    };

    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 md:px-0">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-top-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-[#0f172a]/95 border-emerald-500/50 text-emerald-400 shadow-emerald-950/40'
              : toast.type === 'error'
              ? 'bg-[#0f172a]/95 border-rose-500/50 text-rose-400 shadow-rose-950/40'
              : 'bg-[#0f172a]/95 border-sky-500/50 text-sky-400 shadow-sky-950/40'
          }`}
        >
          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
            toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
            toast.type === 'error' ? 'bg-rose-500/20 text-rose-400' :
            'bg-sky-500/20 text-sky-400'
          }`}>
            {toast.type === 'success' ? <MapPin size={18} /> : toast.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs text-white">
              <span>{toast.message}</span>
              <Check size={14} className="text-emerald-400 shrink-0" />
            </div>
            {toast.submessage && (
              <p className="text-[11px] font-mono text-slate-300 mt-1 bg-black/40 px-2 py-1 rounded border border-white/10 break-all select-all">
                {toast.submessage}
              </p>
            )}
          </div>

          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="text-slate-400 hover:text-white p-1 rounded transition shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
