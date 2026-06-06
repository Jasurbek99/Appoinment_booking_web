import { useAppointments } from '../hooks/useAppointments.js';
import { useLiveAppointments } from '../hooks/useAppointmentEvents.js';
import { useAppointmentActions } from '../hooks/useAppointmentActions.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { AppointmentCard } from './AppointmentCard.jsx';
import { Empty } from './primitives.jsx';

export function TodayList({ filter }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, isLoading, error } = useAppointments({ mode: 'today' });
  const { handleAction, modals, busy } = useAppointmentActions();
  useLiveAppointments();

  if (isLoading) return <ListSkeleton />;
  if (error) return <Empty>{t('loadFailed')}</Empty>;

  let list = data || [];
  if (filter) list = list.filter(filter);
  if (list.length === 0) return <Empty>{t('empty')}</Empty>;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((a) => (
          <AppointmentCard
            key={a.id}
            appt={a}
            role={user.role}
            onAction={handleAction}
            busy={busy}
          />
        ))}
      </div>
      {modals}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
          <div className="h-4 bg-stone-100 rounded w-1/2 mb-2" />
          <div className="h-3 bg-stone-100 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}
