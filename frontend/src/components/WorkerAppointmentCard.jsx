import { Badge, StatusBadge } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { fmtDate } from '../lib/format.js';

export function WorkerAppointmentCard({ appt }) {
  const { t, lang } = useI18n();

  const name = appt.employee
    ? `${appt.employee.firstName} ${appt.employee.lastName}`
    : appt.visitor
    ? `${appt.visitor.firstName} ${appt.visitor.lastName}`
    : '—';
  const company = appt.employee?.company || appt.visitor?.company || '';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{name}</div>
          {company && <div className="text-xs text-stone-500">{company}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {appt.urgent && <Badge kind="danger">{t('urgent')}</Badge>}
          <StatusBadge status={appt.status} label={t(appt.status)} />
        </div>
      </div>
      <div className="mt-2 text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>{t('boss')}: {appt.bossId}</span>
        <span>{fmtDate(appt.date, lang)}</span>
      </div>
    </div>
  );
}
