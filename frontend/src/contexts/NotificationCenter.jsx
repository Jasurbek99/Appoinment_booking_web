import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastProvider.jsx';

const NotificationContext = createContext(null);

const MAX_ITEMS = 20;

function dndKey(userId) {
  return userId ? `dnd:${userId}` : null;
}

function readDnd(userId) {
  const key = dndKey(userId);
  if (!key || typeof localStorage === 'undefined') return false;
  return localStorage.getItem(key) === '1';
}

function writeDnd(userId, on) {
  const key = dndKey(userId);
  if (!key || typeof localStorage === 'undefined') return;
  if (on) localStorage.setItem(key, '1');
  else localStorage.removeItem(key);
}

export function NotificationCenterProvider({ children }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [dnd, setDndState] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const audioCtxRef = useRef(null);

  // Re-load DND on user change.
  useEffect(() => {
    setDndState(readDnd(user?.id));
    setItems([]);
    setUnread(0);
  }, [user?.id]);

  const setDnd = useCallback(
    (next) => {
      writeDnd(user?.id, next);
      setDndState(next);
    },
    [user?.id],
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission !== 'default') {
      setPermission(Notification.permission);
      return Notification.permission;
    }
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      return res;
    } catch {
      return Notification.permission;
    }
  }, []);

  const playBeep = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      // Some browsers suspend on load; resume on user-triggered or socket-triggered call.
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // ignore — sound is best-effort
    }
  }, []);

  const fireBrowserNotification = useCallback((title, body) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return; // only when tab is hidden
    try {
      new Notification(title, { body: body || undefined });
    } catch {
      // ignore
    }
  }, []);

  // The single entry point. Callers pass:
  //   { id, kind, title, message, sound?, browser?, toast? }
  // DND silences sound + browser notification, but the toast still shows and
  // the badge still increments, so the user can see they missed something.
  const notify = useCallback(
    (input) => {
      const item = {
        id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: input.kind || 'info',
        title: input.title,
        message: input.message || '',
        at: Date.now(),
      };
      setItems((cur) => [item, ...cur].slice(0, MAX_ITEMS));
      setUnread((n) => n + 1);
      if (input.toast !== false) {
        push({ kind: item.kind, title: item.title, message: item.message });
      }
      if (!dnd) {
        if (input.sound !== false) playBeep();
        if (input.browser !== false) fireBrowserNotification(item.title, item.message);
      }
    },
    [dnd, push, playBeep, fireBrowserNotification],
  );

  const clearUnread = useCallback(() => setUnread(0), []);
  const clearAll = useCallback(() => {
    setItems([]);
    setUnread(0);
  }, []);

  const value = useMemo(
    () => ({
      items,
      unread,
      dnd,
      setDnd,
      notify,
      clearUnread,
      clearAll,
      permission,
      requestPermission,
    }),
    [items, unread, dnd, setDnd, notify, clearUnread, clearAll, permission, requestPermission],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationCenter() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationCenter must be used inside NotificationCenterProvider');
  return ctx;
}
