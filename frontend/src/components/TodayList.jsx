import { useState } from 'react';
import { useAppointments, useTransitionAppointment } from '../hooks/useAppointments.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { AppointmentCard } from './AppointmentCard.jsx';
import { RejectModal } from './RejectModal.jsx';
import { Empty } from './primitives.jsx';

export function TodayList({ filter }) {
  const { user } = useAuth();
  const { push } = useToast();
  const { data, isLoading, error } = useAppointments({ mode: 'today' });
  const transition = useTransitionAppointment();
  const [rejectFor, setRejectFor] = useState(null);

  if (isLoading) return <ListSkeleton />;
  if (error) return <Empty>Не удалось загрузить</Empty>;

  let list = data || [];
  if (filter) list = list.filter(filter);
  if (list.length === 0) return <Empty>Пусто</Empty>;

  const handleAction = (action, appt) => {
    if (action === 'reject') {
      setRejectFor(appt);
      return;
    }
    transition.mutate(
      { id: appt.id, action },
      {
        onError: (err) => push({ kind: 'error', title: 'Ошибка', message: err?.code || 'unknown' }),
      },
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
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((a) => (
          <AppointmentCard
            key={a.id}
            appt={a}
            role={user.role}
            onAction={handleAction}
            busy={transition.isPending}
          />
        ))}
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
