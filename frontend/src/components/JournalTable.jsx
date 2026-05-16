import { useState } from 'react';
import { useJournal } from '../hooks/useJournal.js';
import { useUsers } from '../hooks/useUsers.js';
import { Input, Select, Empty } from './primitives.jsx';
import { fmtTime, fmtDate } from '../lib/format.js';
import { useI18n } from '../contexts/I18nProvider.jsx';

const ACTION_IDS = ['', 'create', 'approve', 'reject', 'reschedule', 'invite', 'complete', 'delete'];

function statusLabel(id, t) {
  if (!id) return t('allActions');
  if (id === 'create') return t('actionCreate');
  if (id === 'approve') return t('actionApprove');
  if (id === 'reject') return t('actionReject');
  if (id === 'reschedule') return t('actionReschedule');
  if (id === 'invite') return t('actionInvite');
  if (id === 'complete') return t('actionComplete');
  if (id === 'delete') return t('actionDelete');
  return id;
}

function bossLabel(id, t) {
  if (id === 'boss1') return t('roleBoss1');
  if (id === 'boss2') return t('roleBoss2');
  if (id === 'boss3') return t('roleBoss3');
  return id || '';
}

function formatNote(action, note) {
  if (!note) return null;
  if (action === 'reschedule') {
    try {
      const j = JSON.parse(note);
      const parts = [];
      if (j.oldDate && j.newDate) parts.push(`${j.oldDate} → ${j.newDate}`);
      if (j.reason) parts.push(j.reason);
      return parts.join(' · ') || null;
    } catch {
      return note;
    }
  }
  return note;
}

export function JournalTable({ hideUserFilter = false }) {
  const { t } = useI18n();
  const [filters, setFilters] = useState({});
  const { data = [], isLoading } = useJournal(filters);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  return (
    <section>
      <header className={'grid gap-3 mb-4 ' + (hideUserFilter ? 'md:grid-cols-3' : 'md:grid-cols-4')}>
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
        {!hideUserFilter && <UserFilter value={filters.user_id || ''} onChange={(v) => setFilter('user_id', v)} />}
        <Select value={filters.action || ''} onChange={(e) => setFilter('action', e.target.value)}>
          {ACTION_IDS.map((id) => (
            <option key={id || 'all'} value={id}>{statusLabel(id, t)}</option>
          ))}
        </Select>
      </header>
      {isLoading ? (
        <div className="text-stone-500 text-sm">…</div>
      ) : data.length === 0 ? (
        <Empty>{t('noEntries')}</Empty>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="text-left px-3 py-2">{t('when')}</th>
                <th className="text-left px-3 py-2">{t('who')}</th>
                <th className="text-left px-3 py-2">{t('status')}</th>
                <th className="text-left px-3 py-2">{t('appointmentNo')}</th>
                <th className="text-left px-3 py-2">{t('toWhom')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-stone-500">
                    {fmtDate(row.at)} {fmtTime(row.at)}
                  </td>
                  <td className="px-3 py-2">
                    {row.appointment.visitorName || `emp#${row.appointment.employeeId}`}
                    {row.appointment.visitorCompany && (
                      <div className="text-xs text-stone-500">{row.appointment.visitorCompany}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {statusLabel(row.action, t)}
                    {(() => {
                      const formatted = formatNote(row.action, row.note);
                      return formatted ? <div className="text-xs text-stone-500">{formatted}</div> : null;
                    })()}
                  </td>
                  <td className="px-3 py-2 text-stone-500">#{row.appointment.id}</td>
                  <td className="px-3 py-2">{bossLabel(row.appointment.bossId, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UserFilter({ value, onChange }) {
  const { t } = useI18n();
  const { data: users = [] } = useUsers();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('allUsers')}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.displayName}</option>
      ))}
    </Select>
  );
}
