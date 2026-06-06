import { useState } from 'react';
import { useTransitionAppointment, useDeleteAppointment } from './useAppointments.js';
import { useToast } from '../contexts/ToastProvider.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { RejectModal } from '../components/RejectModal.jsx';
import { RescheduleModal } from '../components/RescheduleModal.jsx';

// Shared appointment action handling for every list that renders an
// AppointmentCard (TodayList, FutureList, BossToday). Centralizing it keeps
// the reject/reschedule modal wiring from drifting between sites — and means
// staff acting on a delegated boss's appointments work identically everywhere.
export function useAppointmentActions() {
  const { t } = useI18n();
  const { push } = useToast();
  const transition = useTransitionAppointment();
  const del = useDeleteAppointment();
  const [rejectFor, setRejectFor] = useState(null);
  const [rescheduleFor, setRescheduleFor] = useState(null);

  const onError = (err) =>
    push({ kind: 'error', title: t('errorTitle'), message: err?.code || 'unknown' });

  const handleAction = (action, appt) => {
    if (action === 'reject') return setRejectFor(appt);
    if (action === 'reschedule') return setRescheduleFor(appt);
    if (action === 'delete') {
      // window.confirm is enough here — this is staff undoing their own
      // mistake on a pending entry, not a destructive action on shared state.
      if (!window.confirm(t('deleteConfirm'))) return;
      return del.mutate(appt.id, { onError });
    }
    transition.mutate({ id: appt.id, action }, { onError });
  };

  const submitReject = ({ causeId, reason }) => {
    transition.mutate(
      { id: rejectFor.id, action: 'reject', reason, causeId },
      { onSuccess: () => setRejectFor(null), onError },
    );
  };
  const submitReschedule = ({ date, causeId, reason }) => {
    transition.mutate(
      { id: rescheduleFor.id, action: 'reschedule', date, causeId, reason },
      { onSuccess: () => setRescheduleFor(null), onError },
    );
  };

  const busy = transition.isPending || del.isPending;

  const modals = (
    <>
      <RejectModal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        onConfirm={submitReject}
        busy={transition.isPending}
      />
      <RescheduleModal
        open={!!rescheduleFor}
        onClose={() => setRescheduleFor(null)}
        onConfirm={submitReschedule}
        busy={transition.isPending}
      />
    </>
  );

  return { handleAction, modals, busy };
}
