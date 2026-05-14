import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { useNotificationCenter } from '../contexts/NotificationCenter.jsx';

const BOSS_ROLES = new Set(['boss1', 'boss2', 'boss3']);

export function NotificationBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const {
    items,
    unread,
    dnd,
    setDnd,
    clearAll,
    clearUnread,
    permission,
    requestPermission,
    notify,
  } = useNotificationCenter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return null;

  const isBoss = BOSS_ROLES.has(user.role);
  const showRequestBtn = permission === 'default';

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) clearUnread();
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggleOpen}
        title={t('notifications')}
        aria-label={t('notifications')}
        className="relative p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100"
      >
        <BellIcon muted={dnd} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[11px] leading-[18px] text-center font-semibold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-lg z-50">
          <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <div className="font-semibold text-sm">{t('notifications')}</div>
            {items.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-stone-500 hover:text-stone-900"
              >
                {t('clearAll')}
              </button>
            )}
          </div>

          {isBoss && (
            <label className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-100">
              <span className="text-sm text-stone-700">{t('dnd')}</span>
              <Switch checked={dnd} onChange={setDnd} />
            </label>
          )}

          {showRequestBtn && (
            <button
              type="button"
              onClick={requestPermission}
              className="w-full text-left px-4 py-2 text-xs text-indigo-700 hover:bg-indigo-50 border-b border-stone-100"
            >
              {t('enableBrowserNotifications')}
            </button>
          )}

          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() =>
                notify({
                  kind: 'info',
                  title: t('testNotification'),
                  message: new Date().toLocaleTimeString(),
                })
              }
              className="w-full text-left px-4 py-2 text-xs text-stone-600 hover:bg-stone-50 border-b border-stone-100"
            >
              {t('testNotification')}
            </button>
          )}

          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-stone-500">
                {t('noNotifications')}
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {items.map((n) => (
                  <li key={n.id} className="px-4 py-3">
                    {n.title && <div className="text-sm font-medium text-stone-900">{n.title}</div>}
                    {n.message && <div className="text-sm text-stone-600">{n.message}</div>}
                    <div className="mt-0.5 text-[11px] text-stone-400">{formatTime(n.at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors ' +
        (checked ? 'bg-stone-900' : 'bg-stone-300')
      }
    >
      <span
        className={
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' +
          (checked ? 'translate-x-4' : 'translate-x-0.5')
        }
      />
    </button>
  );
}

function BellIcon({ muted }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />}
    </svg>
  );
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
