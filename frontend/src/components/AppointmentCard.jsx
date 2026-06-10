import { Btn, Badge, StatusBadge } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { fmtTime, fmtDate, visitorName, visitorCompany, visitorPhone, todayLocalISO } from '../lib/format.js';
import { useCauses } from '../hooks/useCauses.js';
import { useUsers } from '../hooks/useUsers.js';

export function AppointmentCard({ appt, role, onAction, busy }) {
  const { t, lang } = useI18n();
  const isCarryover = appt.date < todayLocalISO() && (appt.status === 'approved' || appt.status === 'invited');
  const isBossViewer = role === 'boss1' || role === 'boss2' || role === 'boss3';
  const { data: rejectCauses = [] } = useCauses({ kind: 'reject' });
  const rejectCause = appt.rejectionCauseId
    ? rejectCauses.find((c) => c.id === appt.rejectionCauseId)
    : null;
  const rejectCauseLabel = rejectCause
    ? (lang === 'tk' ? rejectCause.label_tk : rejectCause.label_ru)
    : null;
  const { data: visitCauses = [] } = useCauses({ kind: 'visit' });
  const visitCause = appt.causeId && appt.causeId !== 'other'
    ? visitCauses.find((c) => c.id === appt.causeId)
    : null;
  const visitCauseBaseLabel = visitCause
    ? (lang === 'tk' ? visitCause.label_tk : visitCause.label_ru)
    : appt.causeId;
  const visitCauseLabel = appt.causeId === 'other'
    ? appt.customCause
    : appt.causeId === 'work' && appt.customCause
      ? `${visitCauseBaseLabel}: ${appt.customCause}`
      : visitCauseBaseLabel;
  const { data: users = [] } = useUsers({ enabled: !isBossViewer });
  const bossUser = users.find((u) => u.role === appt.bossId);
  const bossLabel = bossUser ? bossUser.displayName : appt.bossId;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{visitorName(appt)}</div>
          {visitorCompany(appt) && (
            <div className="text-xs text-stone-500 truncate">{visitorCompany(appt)}</div>
          )}
          {visitorPhone(appt) && (
            <a href={`tel:${visitorPhone(appt)}`} className="text-xs text-stone-500 hover:text-stone-900">
              ☎ {visitorPhone(appt)}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {appt.urgent && <Badge kind="danger">{t('urgent')}</Badge>}
          <StatusBadge status={appt.status} label={t(appt.status)} />
        </div>
      </div>

      <div className="mt-3 text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
        {!isBossViewer && <span>{bossLabel}</span>}
        <span>{visitCauseLabel}</span>
        <span>{fmtDate(appt.date, lang)}</span>
        {isCarryover && <Badge kind="warning">↻ {t('carryoverBadge')}</Badge>}
        {appt.history?.length > 0 && (
          <span>{t('createdAt')} {fmtTime(appt.history[0].at, lang)}</span>
        )}
      </div>

      {(rejectCauseLabel || appt.rejectionReason) && (
        <div className="mt-2 text-sm text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
          {rejectCauseLabel && <div className="font-medium">{rejectCauseLabel}</div>}
          {appt.rejectionReason && <div>{appt.rejectionReason}</div>}
        </div>
      )}

      <Actions appt={appt} role={role} onAction={onAction} busy={busy} />
    </div>
  );
}

// Bosses who delegate all decisions to the staff (see backend
// appointments.write.js DELEGATED_BOSSES). boss1 acts through the secretary,
// so his own dashboard shows no action buttons and the staff get the full
// decision set on his appointments instead.
const DELEGATED_BOSSES = ['boss1'];

function Actions({ appt, role, onAction, busy }) {
  const { t } = useI18n();

  // A delegated boss (boss1) has no action buttons anywhere — he phones the
  // staff instead of acting in the app himself.
  if (DELEGATED_BOSSES.includes(role)) return null;

  const isOwnBoss = role === appt.bossId;
  const isStaff = ['secretary', 'assistant1', 'assistant2', 'assistant3'].includes(role);
  // Decision actions (approve/reject/invite/reschedule) belong to the owning
  // boss — or to the staff when the appointment's boss is delegated.
  const canDecide = isOwnBoss || (isStaff && DELEGATED_BOSSES.includes(appt.bossId));
  const buttons = [];

  // Staff can delete a pending entry created in error. The button is small
  // and ghost-styled with rose accents so it doesn't compete with the
  // boss's approve/reject buttons but is clearly destructive.
  if (appt.status === 'pending' && isStaff) {
    buttons.push(
      <Btn
        key="delete"
        size="sm"
        kind="ghost"
        onClick={() => onAction('delete', appt)}
        disabled={busy}
        className="text-rose-700 border-rose-200 hover:bg-rose-50"
      >
        {t('delete')}
      </Btn>,
    );
  }

  if (appt.status === 'pending' && canDecide) {
    buttons.push(
      <Btn key="approve" size="sm" kind="success" onClick={() => onAction('approve', appt)} disabled={busy}>
        {t('approve')}
      </Btn>,
      <Btn key="reject" size="sm" kind="danger" onClick={() => onAction('reject', appt)} disabled={busy}>
        {t('reject')}
      </Btn>,
      <Btn key="reschedule" size="sm" kind="info" onClick={() => onAction('reschedule', appt)} disabled={busy}>
        {t('reschedule')}
      </Btn>,
    );
  }
  if (appt.status === 'approved' && canDecide) {
    buttons.push(
      <Btn key="invite" size="sm" kind="info" onClick={() => onAction('invite', appt)} disabled={busy}>
        {t('invite')}
      </Btn>,
    );
  }
  if ((appt.status === 'approved' || appt.status === 'invited') && (isStaff || isOwnBoss)) {
    buttons.push(
      <Btn key="complete" size="sm" kind="ghost" onClick={() => onAction('complete', appt)} disabled={busy}>
        {t('complete')}
      </Btn>,
    );
  }

  if (buttons.length === 0) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{buttons}</div>;
}
