import { useAppointments } from '../hooks/useAppointments.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { AppointmentCard } from './AppointmentCard.jsx';
import { Empty } from './primitives.jsx';

export function FutureList() {
  const { user } = useAuth();
  const { data, isLoading, error } = useAppointments({ mode: 'future' });

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
  if (error) return <Empty>Не удалось загрузить</Empty>;
  if (!data || data.length === 0) return <Empty>Пусто</Empty>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.map((a) => (
        <AppointmentCard key={a.id} appt={a} role={user.role} onAction={() => {}} />
      ))}
    </div>
  );
}
