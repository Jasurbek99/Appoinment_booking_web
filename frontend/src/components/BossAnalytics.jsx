import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useI18n } from '../contexts/I18nProvider.jsx';

export function BossAnalytics() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', 'boss'],
    queryFn: () => api.get('/api/stats/boss'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <SkeletonGrid />;
  if (error) return <div className="text-stone-500 text-sm">…</div>;

  const cards = [
    { key: 'total', label: t('totalToday'), value: data.total, kind: 'default' },
    { key: 'approved', label: t('approvedCount'), value: data.approved, kind: 'success' },
    { key: 'rejected', label: t('rejectedCount'), value: data.rejected, kind: 'danger' },
    { key: 'completed', label: t('completedCount'), value: data.completed, kind: 'info' },
    { key: 'urgent', label: t('urgentCount'), value: data.urgent, kind: 'warning' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
      {cards.map((c) => (
        <div key={c.key} className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500 uppercase tracking-wide">{c.label}</div>
          <div className={'mt-2 text-3xl font-semibold ' + valueColor(c.kind)}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function valueColor(kind) {
  if (kind === 'success') return 'text-emerald-700';
  if (kind === 'danger') return 'text-rose-700';
  if (kind === 'info') return 'text-indigo-700';
  if (kind === 'warning') return 'text-amber-700';
  return 'text-stone-900';
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
          <div className="h-3 bg-stone-100 rounded w-2/3 mb-3" />
          <div className="h-8 bg-stone-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
