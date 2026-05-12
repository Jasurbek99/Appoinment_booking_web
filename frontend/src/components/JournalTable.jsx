import { useState } from 'react';
import { useJournal } from '../hooks/useJournal.js';
import { useUsers } from '../hooks/useUsers.js';
import { Input, Select, Empty } from './primitives.jsx';
import { fmtTime } from '../lib/format.js';

const ACTIONS = [
  { id: '', label: 'Все действия' },
  { id: 'create', label: 'создал заявку' },
  { id: 'approve', label: 'одобрил' },
  { id: 'reject', label: 'отклонил' },
  { id: 'invite', label: 'пригласил' },
  { id: 'complete', label: 'завершил' },
];

export function JournalTable({ hideUserFilter = false }) {
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
          placeholder="С"
        />
        <Input
          type="date"
          value={filters.to || ''}
          onChange={(e) => setFilter('to', e.target.value)}
          placeholder="По"
        />
        {!hideUserFilter && <UserFilter value={filters.user_id || ''} onChange={(v) => setFilter('user_id', v)} />}
        <Select value={filters.action || ''} onChange={(e) => setFilter('action', e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a.id || 'all'} value={a.id}>{a.label}</option>
          ))}
        </Select>
      </header>
      {isLoading ? (
        <div className="text-stone-500 text-sm">…</div>
      ) : data.length === 0 ? (
        <Empty>Записей нет</Empty>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="text-left px-3 py-2">Когда</th>
                <th className="text-left px-3 py-2">Кто</th>
                <th className="text-left px-3 py-2">Действие</th>
                <th className="text-left px-3 py-2">Заявка</th>
                <th className="text-left px-3 py-2">Кому</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-stone-500">
                    {new Date(row.at).toLocaleDateString('ru-RU')} {fmtTime(row.at)}
                  </td>
                  <td className="px-3 py-2">
                    {row.user.displayName || row.user.id}
                    {row.user.deleted && <span className="text-xs text-stone-400 ml-1">(удалён)</span>}
                  </td>
                  <td className="px-3 py-2">
                    {ACTIONS.find((a) => a.id === row.action)?.label || row.action}
                    {row.note && <div className="text-xs text-stone-500">{row.note}</div>}
                  </td>
                  <td className="px-3 py-2 text-stone-500">#{row.appointment.id}</td>
                  <td className="px-3 py-2">
                    {row.appointment.visitorName || `emp#${row.appointment.employeeId}`}
                    {row.appointment.visitorCompany && (
                      <div className="text-xs text-stone-500">{row.appointment.visitorCompany}</div>
                    )}
                  </td>
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
  const { data: users = [] } = useUsers();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Все пользователи</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.displayName}</option>
      ))}
    </Select>
  );
}
