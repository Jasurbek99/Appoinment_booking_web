import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar.jsx';
import { useAppointments, useTransitionAppointment } from '../hooks/useAppointments.js';
import { useLiveAppointments } from '../hooks/useAppointmentEvents.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { AppointmentCard } from '../components/AppointmentCard.jsx';
import { RejectModal } from '../components/RejectModal.jsx';
import { Empty } from '../components/primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';

const TABS = ['today', 'future', 'analytics'];

export function BossDashboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState('today');

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <nav className="border-b border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {TABS.map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={
                'px-4 py-3 text-sm border-b-2 transition-colors ' +
                (tab === id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-900')
              }
            >
              {t(id)}
            </button>
          ))}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-1">
        {tab === 'today' && <BossToday />}
        {tab === 'future' && <FutureStub />}
        {tab === 'analytics' && <AnalyticsStub />}
      </main>
    </div>
  );
}

function BossToday() {
  const { user } = useAuth();
  const { push } = useToast();
  const { data, isLoading, error } = useAppointments({ mode: 'today' });
  const transition = useTransitionAppointment();
  const [rejectFor, setRejectFor] = useState(null);
  useLiveAppointments();

  const { pending, queue } = useMemo(() => {
    const list = data || [];
    return {
      pending: list.filter((a) => a.status === 'pending'),
      // Awaiting pickup queue: invited first, then approved by approval time ASC.
      queue: list
        .filter((a) => a.status === 'approved' || a.status === 'invited')
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'invited' ? -1 : 1;
          const aApprove = a.history?.find((h) => h.action === 'approve')?.at || a.history?.[0]?.at;
          const bApprove = b.history?.find((h) => h.action === 'approve')?.at || b.history?.[0]?.at;
          return new Date(aApprove) - new Date(bApprove);
        }),
    };
  }, [data]);

  if (isLoading) return <div className="text-stone-500 text-sm">…</div>;
  if (error) return <Empty>Не удалось загрузить</Empty>;

  const handleAction = (action, appt) => {
    if (action === 'reject') return setRejectFor(appt);
    transition.mutate(
      { id: appt.id, action },
      { onError: (err) => push({ kind: 'error', title: 'Ошибка', message: err?.code || 'unknown' }) },
    );
  };
  const submitReject = (reason) => {
    transition.mutate(
      { id: rejectFor.id, action: 'reject', reason },
      {
        onSuccess: () => setRejectFor(null),
        onError: (err) => push({ kind: 'error', title: 'Ошибка', message: err?.code || 'unknown' }),
      },
    );
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Column title="Ожидают решения" items={pending} role={user.role} onAction={handleAction} busy={transition.isPending} />
        <Column title="Очередь / приглашения" items={queue} role={user.role} onAction={handleAction} busy={transition.isPending} />
      </div>
      <RejectModal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        onConfirm={submitReject}
        busy={transition.isPending}
      />
    </>
  );
}

function Column({ title, items, role, onAction, busy }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">{title}</h2>
      {items.length === 0 ? (
        <Empty>Пусто</Empty>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <AppointmentCard key={a.id} appt={a} role={role} onAction={onAction} busy={busy} />
          ))}
        </div>
      )}
    </section>
  );
}

function FutureStub() {
  return <div className="text-stone-500 text-sm">Будущие — Шаг 9 (расширение).</div>;
}
function AnalyticsStub() {
  return <div className="text-stone-500 text-sm">Аналитика — Шаг 17.</div>;
}
