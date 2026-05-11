import { useState } from 'react';
import { Modal, Btn, Input } from './primitives.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';

export function RejectModal({ open, onClose, onConfirm, busy }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');

  function submit() {
    onConfirm(reason.trim() || undefined);
    setReason('');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('reject') || 'Отклонить'}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={busy}>
            Отмена
          </Btn>
          <Btn kind="danger" onClick={submit} disabled={busy}>
            {t('reject') || 'Отклонить'}
          </Btn>
        </>
      }
    >
      <label className="text-sm text-stone-600">Причина отказа (необязательно)</label>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
    </Modal>
  );
}
