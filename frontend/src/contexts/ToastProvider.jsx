import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId++;
      const next = { id, kind: 'info', timeout: 4000, ...toast };
      setToasts((cur) => [...cur, next]);
      if (next.timeout) {
        setTimeout(() => dismiss(id), next.timeout);
      }
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, dismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={
            'text-left rounded-2xl border px-4 py-3 shadow-lg bg-white max-w-sm ' +
            (t.kind === 'error'
              ? 'border-rose-200 text-rose-900'
              : t.kind === 'success'
              ? 'border-emerald-200 text-emerald-900'
              : 'border-stone-200 text-stone-900')
          }
        >
          {t.title && <div className="font-semibold text-sm">{t.title}</div>}
          {t.message && <div className="text-sm text-stone-600">{t.message}</div>}
        </button>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
