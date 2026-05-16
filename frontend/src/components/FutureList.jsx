import { useAppointments, useDeleteAppointment } from '../hooks/useAppointments.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { AppointmentCard } from './AppointmentCard.jsx';
import { Empty } from './primitives.jsx';

export function FutureList() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { push } = useToast();
  const { data, isLoading, error } = useAppointments({ mode: 'future' });
  const del = useDeleteAppointment();

  if (isLoading) {
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
  if (error) return <Empty>{t('loadFailed')}</Empty>;
  if (!data || data.length === 0) return <Empty>{t('empty')}</Empty>;

  const handleAction = (action, appt) => {
    if (action !== 'delete') return;
    if (!window.confirm(t('deleteConfirm'))) return;
    del.mutate(appt.id, {
      onError: (err) =>
        push({ kind: 'error', title: t('errorTitle'), message: err?.code || 'unknown' }),
    });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.map((a) => (
        <AppointmentCard
          key={a.id}
          appt={a}
          role={user.role}
          onAction={handleAction}
          busy={del.isPending}
        />
      ))}
    </div>
  );
}
