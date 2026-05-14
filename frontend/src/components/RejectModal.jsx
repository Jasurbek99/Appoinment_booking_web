import { useState } from 'react';
import { Modal, Btn, Input, Select } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { useCauses } from '../hooks/useCauses.js';

export function RejectModal({ open, onClose, onConfirm, busy }) {
  const { t, lang } = useI18n();
  const { data: causes = [] } = useCauses({ kind: 'reject' });
  const [causeId, setCauseId] = useState('');
  const [reason, setReason] = useState('');

  function submit() {
    onConfirm({ causeId: causeId || undefined, reason: reason.trim() || undefined });
    setCauseId('');
    setReason('');
  }

  function close() {
    setCauseId('');
    setReason('');
    onClose?.();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('reject') || 'Отклонить'}
      footer={
        <>
          <Btn kind="ghost" onClick={close} disabled={busy}>
            {t('cancel') || 'Отмена'}
          </Btn>
          <Btn kind="danger" onClick={submit} disabled={busy}>
            {t('reject') || 'Отклонить'}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm text-stone-600">{t('rejectionCause') || 'Причина отказа'}</label>
          <Select value={causeId} onChange={(e) => setCauseId(e.target.value)} autoFocus>
            <option value="">{t('rejectionCauseAny') || '— не указано —'}</option>
            {causes.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === 'tk' ? c.label_tk : c.label_ru}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('rejectionReason') || 'Причина отказа (необязательно)'}</label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
