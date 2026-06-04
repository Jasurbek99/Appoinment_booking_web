import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar.jsx';
import {
  useAppointments,
  useBulkReschedule,
} from '../hooks/useAppointments.js';
import { useLiveAppointments } from '../hooks/useAppointmentEvents.js';
import { useAppointmentActions } from '../hooks/useAppointmentActions.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { AppointmentCard } from '../components/AppointmentCard.jsx';
import { BulkRescheduleModal } from '../components/BulkRescheduleModal.jsx';
import { Empty, Btn } from '../components/primitives.jsx';
import { BossAnalytics } from '../components/BossAnalytics.jsx';
import { FutureList } from '../components/FutureList.jsx';
import { JournalTable } from '../components/JournalTable.jsx';
import { VisitorFrequency } from '../components/VisitorFrequency.jsx';
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
  const { t } = useI18n();
  const { user } = useAuth();
  const { push } = useToast();
  const { data, isLoading, error } = useAppointments({ mode: 'today' });
  const { data: futureData } = useAppointments({ mode: 'future' });
  const { handleAction, modals, busy } = useAppointmentActions();
  const bulkReschedule = useBulkReschedule();
  const [bulkOpen, setBulkOpen] = useState(false);
  useLiveAppointments();

  // boss1 delegates everything to the staff, so he gets no action controls —
  // not the per-card buttons (handled in AppointmentCard) and not bulk reschedule.
  const isDelegatedBoss = user.role === 'boss1';

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

  // Affected count for bulk reschedule: every pending/approved/invited row
  // the boss owns — today + carryover (from today's list) plus future.
  // Pending counts because the boss can't decide on them while away;
  // carryover counts because the server clamps past dates to today
  // before shifting.
  const affectedCount = useMemo(() => {
    const isActive = (a) => a.status === 'pending' || a.status === 'approved' || a.status === 'invited';
    const todayQueue = (data || []).filter(isActive);
    const futureQueue = (futureData || []).filter(isActive);
    return todayQueue.length + futureQueue.length;
  }, [data, futureData]);

  if (isLoading) return <div className="text-stone-500 text-sm">…</div>;
  if (error) return <Empty>{t('loadFailed')}</Empty>;

  const submitBulkReschedule = ({ shiftDays, causeId, reason }) => {
    bulkReschedule.mutate(
      { shiftDays, causeId, reason },
      {
        onSuccess: (resp) => {
          setBulkOpen(false);
          const msg = t('bulkRescheduleSuccess').replace('{count}', String(resp?.count ?? 0));
          push({ kind: 'info', title: t('rescheduleTitle'), message: msg });
        },
        onError: (err) => push({ kind: 'error', title: t('errorTitle'), message: err?.code || 'unknown' }),
      },
    );
  };

  return (
    <>
      {!isDelegatedBoss && (
        <div className="flex justify-end mb-4">
          <Btn
            kind="ghost"
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={affectedCount === 0 || bulkReschedule.isPending}
          >
            {t('bulkReschedule')}
            {affectedCount > 0 ? ` (${affectedCount})` : ''}
          </Btn>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Column title={t('pendingDecision')} items={pending} role={user.role} onAction={handleAction} busy={busy} />
        <Column title={t('awaitingPickup')} items={queue} role={user.role} onAction={handleAction} busy={busy} />
      </div>
      {modals}
      {!isDelegatedBoss && (
        <BulkRescheduleModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onConfirm={submitBulkReschedule}
          busy={bulkReschedule.isPending}
          queueCount={affectedCount}
        />
      )}
    </>
  );
}

function Column({ title, items, role, onAction, busy }) {
  const { t } = useI18n();
  return (
    <section>
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">{title}</h2>
      {items.length === 0 ? (
        <Empty>{t('empty')}</Empty>
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
  return <FutureList />;
}
function AnalyticsStub() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <BossAnalytics />
      <section>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
          {t('journal')}
        </h2>
        <JournalTable />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
          {t('visitorFrequency')}
        </h2>
        <VisitorFrequency />
      </section>
    </div>
  );
}
