import { Btn, Badge, StatusBadge } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { fmtTime, fmtDate, visitorName, visitorCompany, todayLocalISO } from '../lib/format.js';

export function AppointmentCard({ appt, role, onAction, busy }) {
  const { t, lang } = useI18n();
  const isCarryover = appt.date < todayLocalISO() && (appt.status === 'approved' || appt.status === 'invited');

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{visitorName(appt)}</div>
          {visitorCompany(appt) && (
            <div className="text-xs text-stone-500 truncate">{visitorCompany(appt)}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {appt.urgent && <Badge kind="danger">{t('urgent') || 'Срочно'}</Badge>}
          <StatusBadge status={appt.status} label={t(appt.status)} />
        </div>
      </div>

      <div className="mt-3 text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>{appt.bossId}</span>
        <span>{appt.causeId === 'other' ? appt.customCause : appt.causeId}</span>
        <span>{fmtDate(appt.date, lang)}</span>
        {isCarryover && <Badge kind="warning">↻ перенесено</Badge>}
        {appt.history?.length > 0 && (
          <span>создано {fmtTime(appt.history[0].at, lang)}</span>
        )}
      </div>

      {appt.rejectionReason && (
        <div className="mt-2 text-sm text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
          {appt.rejectionReason}
        </div>
      )}

      <Actions appt={appt} role={role} onAction={onAction} busy={busy} />
    </div>
  );
}

function Actions({ appt, role, onAction, busy }) {
  const { t } = useI18n();
  const isOwnBoss = role === appt.bossId;
  const isStaff = ['secretary', 'assistant1', 'assistant2', 'assistant3'].includes(role);
  const buttons = [];

  if (appt.status === 'pending' && isOwnBoss) {
    buttons.push(
      <Btn key="approve" size="sm" kind="success" onClick={() => onAction('approve', appt)} disabled={busy}>
        {t('approve') || 'Одобрить'}
      </Btn>,
      <Btn key="reject" size="sm" kind="danger" onClick={() => onAction('reject', appt)} disabled={busy}>
        {t('reject') || 'Отклонить'}
      </Btn>,
    );
  }
  if (appt.status === 'approved' && isOwnBoss) {
    buttons.push(
      <Btn key="invite" size="sm" kind="info" onClick={() => onAction('invite', appt)} disabled={busy}>
        {t('invite') || 'Пригласить'}
      </Btn>,
    );
  }
  if ((appt.status === 'approved' || appt.status === 'invited') && (isStaff || isOwnBoss)) {
    buttons.push(
      <Btn key="complete" size="sm" kind="ghost" onClick={() => onAction('complete', appt)} disabled={busy}>
        {t('complete') || 'Завершить'}
      </Btn>,
    );
  }

  if (buttons.length === 0) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{buttons}</div>;
}
