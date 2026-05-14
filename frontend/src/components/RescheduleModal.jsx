import { useState } from 'react';
import { Modal, Btn, Input, Select } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { useCauses } from '../hooks/useCauses.js';
import { tomorrowLocalISO, todayLocalISO } from '../lib/format.js';

export function RescheduleModal({ open, onClose, onConfirm, busy }) {
  const { t, lang } = useI18n();
  const { data: causes = [] } = useCauses({ kind: 'reschedule' });
  const [date, setDate] = useState(tomorrowLocalISO());
  const [causeId, setCauseId] = useState('');
  const [reason, setReason] = useState('');

  function reset() {
    setDate(tomorrowLocalISO());
    setCauseId('');
    setReason('');
  }

  function submit() {
    if (!date) return;
    onConfirm({ date, causeId: causeId || undefined, reason: reason.trim() || undefined });
    reset();
  }

  function close() {
    reset();
    onClose?.();
  }

  const valid = !!date && date >= todayLocalISO();

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('rescheduleModalTitle')}
      footer={
        <>
          <Btn kind="ghost" onClick={close} disabled={busy}>
            {t('cancel')}
          </Btn>
          <Btn kind="info" onClick={submit} disabled={busy || !valid}>
            {t('reschedule')}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm text-stone-600">{t('newDate')}</label>
          <Input
            type="date"
            min={todayLocalISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
