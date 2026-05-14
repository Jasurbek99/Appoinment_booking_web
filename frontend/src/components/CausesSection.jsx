import { useState, useMemo } from 'react';
import { useCauses, useCreateCause, useUpdateCause, useDeleteCause } from '../hooks/useCauses.js';
import { Btn, Input, Empty, Modal, Select } from './primitives.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';

const KINDS = ['visit', 'reject', 'reschedule'];

export function CausesSection() {
  const { t } = useI18n();
  const { data: causes = [], isLoading } = useCauses();
  const create = useCreateCause();
  const update = useUpdateCause();
  const remove = useDeleteCause();
  const { push } = useToast();
  const [editing, setEditing] = useState(null); // null | {id?, kind, label_ru, label_tk, isNew}

  const grouped = useMemo(() => {
    const byKind = { visit: [], reject: [], reschedule: [] };
    for (const c of causes) {
      const k = c.kind || 'visit';
      if (byKind[k]) byKind[k].push(c);
    }
    return byKind;
  }, [causes]);

  const onSave = (form, isNew) => {
    const cb = {
      onSuccess: () => setEditing(null),
      onError: (err) => push({ kind: 'error', title: 'Ошибка', message: err?.code || 'unknown' }),
    };
    if (isNew) {
      create.mutate(form, cb);
    } else {
      update.mutate({ id: editing.id, label_ru: form.label_ru, label_tk: form.label_tk }, cb);
    }
  };

  const onDelete = (id) => {
    if (!confirm(t('deleteCauseConfirm') || 'Удалить эту причину?')) return;
    remove.mutate(id, {
      onError: (err) => {
        const msg =
          err?.code === 'system_cause' ? (t('systemCauseError') || 'Системную причину удалить нельзя') :
          err?.code === 'cause_referenced' ? (t('causeReferencedError') || 'Причина используется в заявках') :
          err?.code || 'unknown';
        push({ kind: 'error', title: 'Ошибка', message: msg });
      },
    });
  };

  const sectionTitle = (k) =>
    k === 'visit' ? (t('causesVisit') || 'Причины приёма')
    : k === 'reject' ? (t('causesReject') || 'Причины отказа')
    : (t('causesReschedule') || 'Причины переноса');

  return (
    <section className="space-y-6">
      {isLoading && <div className="text-stone-500 text-sm">…</div>}
      {KINDS.map((kind) => (
        <div key={kind}>
          <header className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{sectionTitle(kind)}</h3>
            <Btn
              size="sm"
              onClick={() => setEditing({ isNew: true, kind, id: '', label_ru: '', label_tk: '' })}
            >
              + {t('addCause') || 'Добавить'}
            </Btn>
          </header>
          {grouped[kind].length === 0 ? (
            <Empty>Пусто</Empty>
          ) : (
            <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
              {grouped[kind].map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm">
                      {c.label_ru} <span className="text-stone-400">/ {c.label_tk}</span>
                    </div>
                    <div className="text-xs text-stone-500">
                      id: {c.id}{c.isSystem ? ` · ${t('systemCauseTag') || 'системная'}` : ''}
                    </div>
                  </div>
                  {!c.isSystem && (
                    <>
                      <Btn
                        size="sm"
                        kind="ghost"
                        onClick={() =>
                          setEditing({
                            isNew: false,
                            id: c.id,
                            kind: c.kind,
                            label_ru: c.label_ru,
                            label_tk: c.label_tk,
                          })
                        }
                      >
                        ✎
                      </Btn>
                      <Btn size="sm" kind="danger" onClick={() => onDelete(c.id)}>×</Btn>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {editing && (
        <CauseModal
          key={`${editing.isNew ? 'new-' + editing.kind : editing.id}`}
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={onSave}
          busy={create.isPending || update.isPending}
          existingIds={new Set(causes.map((c) => c.id))}
        />
      )}
    </section>
  );
}

function CauseModal({ editing, onClose, onSave, busy, existingIds }) {
  const { t } = useI18n();
  const [id, setId] = useState(editing.id || '');
  const [kind, setKind] = useState(editing.kind || 'visit');
  const [labelRu, setLabelRu] = useState(editing.label_ru || '');
  const [labelTk, setLabelTk] = useState(editing.label_tk || '');

  const isNew = editing.isNew;
  const idClash = isNew && id && existingIds.has(id);
  const valid = labelRu.trim() && labelTk.trim() && (!isNew || (id.trim() && !idClash));

  const kindLabel = (k) =>
    k === 'visit' ? (t('kindVisit') || 'Приём')
    : k === 'reject' ? (t('kindReject') || 'Отказ')
    : (t('kindReschedule') || 'Перенос');

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? (t('newCause') || 'Новая причина') : (t('editCause') || 'Редактировать причину')}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>{t('cancel') || 'Отмена'}</Btn>
          <Btn
            disabled={busy || !valid}
            onClick={() =>
              onSave({ id: isNew ? id : editing.id, kind, label_ru: labelRu, label_tk: labelTk }, isNew)
            }
          >
            {t('save') || 'Сохранить'}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm text-stone-600">{t('causeKind') || 'Тип'}</label>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} disabled={!isNew}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{kindLabel(k)}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('causeIdLabel') || 'id (нижний регистр, латиница)'}</label>
          <Input value={id} disabled={!isNew} onChange={(e) => setId(e.target.value)} />
          {idClash && <div className="text-xs text-rose-600 mt-1">{t('idTakenError') || 'id уже используется'}</div>}
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('causeLabelRu') || 'Название (RU)'}</label>
          <Input value={labelRu} onChange={(e) => setLabelRu(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('causeLabelTk') || 'Название (TK)'}</label>
          <Input value={labelTk} onChange={(e) => setLabelTk(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
