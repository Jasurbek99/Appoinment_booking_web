import { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar.jsx';
import { Btn, Input, Empty } from '../components/primitives.jsx';
import { WorkerAppointmentCard } from '../components/WorkerAppointmentCard.jsx';
import { useSocket } from '../contexts/SocketContext.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { api, ApiError } from '../lib/api.js';

export function WorkerStatusPage() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { socket } = useSocket();
  const { push } = useToast();
  const subscribedRef = useRef(null);

  async function onSubmit(e) {
    e.preventDefault();
    const lastname = q.trim();
    if (!lastname) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.get('/api/public/appointments', { query: { lastname } });
      setData(list);
      setSubmitted(lastname);
    } catch (err) {
      if (err instanceof ApiError) setError(err.code);
      else setError('unknown');
    } finally {
      setLoading(false);
    }
  }

  // Manage the public:<lastname> room subscription.
  useEffect(() => {
    if (!socket || !submitted) return;
    const room = submitted.toLowerCase();
    if (subscribedRef.current === room) return;
    if (subscribedRef.current) socket.emit('unsubscribe:lastname', subscribedRef.current);
    socket.emit('subscribe:lastname', room);
    subscribedRef.current = room;
    return () => {
      socket.emit('unsubscribe:lastname', room);
      if (subscribedRef.current === room) subscribedRef.current = null;
    };
  }, [socket, submitted]);

  // Receive live updates for the subscribed lastname.
  useEffect(() => {
    if (!socket || !submitted) return;
    const upsert = (dto) => {
      setData((cur) => {
        if (!Array.isArray(cur)) return cur;
        const idx = cur.findIndex((a) => a.id === dto.id);
        if (idx === -1) return [dto, ...cur];
        const next = cur.slice();
        next[idx] = dto;
        return next;
      });
    };
    const onInvited = (dto) => {
      upsert(dto);
      push({ kind: 'info', title: t('notif_invited'), message: t('inviteToast') });
    };
    socket.on('appointment:approved', upsert);
    socket.on('appointment:rejected', upsert);
    socket.on('appointment:invited', onInvited);
    socket.on('appointment:completed', upsert);
    return () => {
      socket.off('appointment:approved', upsert);
      socket.off('appointment:rejected', upsert);
      socket.off('appointment:invited', onInvited);
      socket.off('appointment:completed', upsert);
    };
  }, [socket, submitted, push, t]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="max-w-2xl mx-auto w-full px-4 py-6 flex-1">
        <h2 className="font-semibold mb-1">{t('welcomeWorker')}</h2>
        <p className="text-stone-500 text-sm mb-4">{t('workerHint')}</p>

        <form onSubmit={onSubmit} className="flex gap-2 mb-6">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('sayLastName')}
            autoFocus
          />
          <Btn type="submit" disabled={loading || !q.trim()}>
            {t('search')}
          </Btn>
        </form>

        {error && (
          <div className="text-rose-600 text-sm mb-4">{t('noResults')}</div>
        )}

        {data == null ? (
          <Empty>{t('sayLastName')}</Empty>
        ) : data.length === 0 ? (
          <Empty>{t('noResults')}</Empty>
        ) : (
          <div className="grid gap-3">
            {data.map((a) => (
              <WorkerAppointmentCard key={a.id} appt={a} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
