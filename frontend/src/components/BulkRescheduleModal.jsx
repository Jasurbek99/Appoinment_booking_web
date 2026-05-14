import { useState } from 'react';
import { Modal, Btn, Input, Select } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { useCauses } from '../hooks/useCauses.js';

// Boss-side "clear my calendar" modal — shifts every approved/invited
// appointment from today onward by N days. Distinct from RescheduleModal,
// which moves a single appointment to a chosen absolute date.
export function BulkRescheduleModal({ open, onClose, onConfirm, busy, queueCount = 0 }) {
  const { t, lang } = useI18n();
  const { data: causes = [] } = useCauses({ kind: 'reschedule' });
  const [shiftDays, setShiftDays] = useState(1);
  const [causeId, setCauseId] = useState('');
  const [reason, setReason] = useState('');

  function reset() {
    setShiftDays(1);
    setCauseId('');
    setReason('');
  }

  function submit() {
    if (!validShift) return;
    onConfirm({
      shiftDays: Number(shiftDays),
      causeId: causeId || undefined,
      reason: reason.trim() || undefined,
    });
    reset();
  }

  function close() {
    reset();
    onClose?.();
  }

  const validShift = Number.isInteger(Number(shiftDays)) && Number(shiftDays) >= 1 && Number(shiftDays) <= 365;

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('bulkReschedule') || 'Перенести все приёмы'}
      footer={
        <>
          <Btn kind="ghost" onClick={close} disabled={busy}>
            {t('cancel')}
          </Btn>
          <Btn kind="info" onClick={submit} disabled={busy || !validShift || queueCount === 0}>
            {t('bulkReschedule')}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-stone-700">
          {(t('bulkRescheduleConfirm') || 'Будет перенесено приёмов: {count}').replace(
            '{count}',
            String(queueCount),
          )}
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('shiftDays') || 'На сколько дней вперёд'}</label>
          <Input
            type="number"
            min={1}
            max={365}
            value={shiftDays}
            onChange={(e) => setShiftDays(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('rescheduleCause')}</label>
          <Select value={causeId} onChange={(e) => setCauseId(e.target.value)}>
            <option value="">{t('rescheduleCauseAny')}</option>
            {causes.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === 'tk' ? c.label_tk : c.label_ru}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('rescheduleReason')}</label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
