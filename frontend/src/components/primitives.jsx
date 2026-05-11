// Visual primitives, kept in one file. Layout choices match prototype.jsx
// (rounded-2xl border border-stone-200, no drop-shadow except on modals).

import { useEffect } from 'react';

export function Btn({ kind = 'primary', size = 'md', className = '', ...props }) {
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
  const kinds = {
    primary: 'bg-stone-900 text-white hover:bg-stone-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    info: 'bg-indigo-600 text-white hover:bg-indigo-700',
    ghost: 'bg-white text-stone-900 border border-stone-200 hover:bg-stone-50',
  };
  return (
    <button
      type={props.type || 'button'}
      className={`rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${kinds[kind]} ${className}`}
      {...props}
    />
  );
}

export function Badge({ kind = 'default', children }) {
  const kinds = {
    default: 'bg-stone-100 text-stone-700',
    danger: 'bg-rose-100 text-rose-700',
    success: 'bg-emerald-100 text-emerald-700',
    info: 'bg-indigo-100 text-indigo-700',
    warning: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${kinds[kind]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }) {
  const map = {
    pending: 'warning',
    approved: 'success',
    invited: 'info',
    completed: 'default',
    rejected: 'danger',
  };
  return <Badge kind={map[status] || 'default'}>{label || status}</Badge>;
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Empty({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-dashed border-stone-200 p-6 text-center text-stone-500 text-sm ${className}`}>
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-900/40">
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="text-stone-500 hover:text-stone-900"
              aria-label="close"
            >
              ×
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
