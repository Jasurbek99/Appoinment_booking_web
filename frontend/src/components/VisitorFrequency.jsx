import { useState } from 'react';
import { useVisitorStats } from '../hooks/useVisitorStats.js';
import { Input, Select, Empty } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { fmtDate } from '../lib/format.js';

const TYPES = [
  { id: '', key: 'allTypes' },
  { id: 'employee', key: 'employee' },
  { id: 'guest', key: 'guest' },
  { id: 'foreign', key: 'foreign' },
];

const BOSSES = [
  { id: '', key: 'allBosses' },
  { id: 'boss1', label: 'Boss 1' },
  { id: 'boss2', label: 'Boss 2' },
  { id: 'boss3', label: 'Boss 3' },
];

// `showBossFilter` lets callers (staff) filter by boss; for boss dashboards
// it's hidden because the API force-scopes to the caller's boss_id.
export function VisitorFrequency({ showBossFilter = false }) {
  const { t } = useI18n();
  const [filters, setFilters] = useState({});
  const { data, isLoading, error } = useVisitorStats(filters);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  const rows = data?.rows || [];
  const wideGrid = showBossFilter && !data?.bossScope;

  return (
    <section>
      <header className={'grid gap-3 mb-4 ' + (wideGrid ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
        <Input
          type="date"
          value={filters.from || ''}
          onChange={(e) => setFilter('from', e.target.value)}
          placeholder={t('from')}
        />
        <Input
          type="date"
          value={filters.to || ''}
          onChange={(e) => setFilter('to', e.target.value)}
          placeholder={t('to')}
        />
        <Select
          value={filters.visitor_type || ''}
          onChange={(e) => setFilter('visitor_type', e.target.value)}
        >
          {TYPES.map((tp) => (
            <option key={tp.id || 'all'} value={tp.id}>
              {tp.key === 'allTypes' ? t('allTypes') : t(tp.key)}
            </option>
          ))}
        </Select>
        {showBossFilter && (
          <Select
            value={filters.boss_id || ''}
            onChange={(e) => setFilter('boss_id', e.target.value)}
          >
            {BOSSES.map((b) => (
              <option key={b.id || 'all'} value={b.id}>
                {b.key ? t(b.key) : b.label}
              </option>
            ))}
          </Select>
        )}
      </header>

      {isLoading ? (
        <div className="text-stone-500 text-sm">…</div>
      ) : error ? (
        <div className="text-stone-500 text-sm">…</div>
      ) : rows.length === 0 ? (
        <Empty>{t('noVisitors')}</Empty>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="text-left px-3 py-2 w-10">#</th>
                <th className="text-left px-3 py-2">{t('visitor')}</th>
                <th className="text-left px-3 py-2">{t('company')}</th>
                <th className="text-left px-3 py-2">{t('type')}</th>
                <th className="text-right px-3 py-2">{t('visits')}</th>
                <th className="text-right px-3 py-2">{t('completedCount')}</th>
                <th className="text-left px-3 py-2">{t('lastVisit')}</th>
                {!data?.bossScope && (
                  <th className="text-left px-3 py-2">{t('byBoss')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {rows.map((r, idx) => (
                <tr key={r.key}>
                  <td className="px-3 py-2 text-stone-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    {[r.lastName, r.firstName].filter(Boolean).join(' ') ||
                      (r.employeeId ? `emp#${r.employeeId}` : '—')}
                  </td>
                  <td className="px-3 py-2 text-stone-500">{r.company || '—'}</td>
                  <td className="px-3 py-2 text-stone-500">{t(r.visitorType)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.visits}</td>
                  <td className="px-3 py-2 text-right text-stone-500">{r.completed}</td>
                  <td className="px-3 py-2 text-stone-500 whitespace-nowrap">
                    {fmtDate(r.lastVisit)}
                  </td>
                  {!data?.bossScope && r.byBoss && (
                    <td className="px-3 py-2 text-stone-500 whitespace-nowrap">
                      <span className="mr-2">Б1: {r.byBoss.boss1}</span>
                      <span className="mr-2">Б2: {r.byBoss.boss2}</span>
                      <span>Б3: {r.byBoss.boss3}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
