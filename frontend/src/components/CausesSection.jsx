import { useState } from 'react';
import { useCauses, useCreateCause, useUpdateCause, useDeleteCause } from '../hooks/useCauses.js';
import { Btn, Input, Empty, Modal } from './primitives.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';

export function CausesSection() {
  const { data: causes = [], isLoading } = useCauses();
  const create = useCreateCause();
  const update = useUpdateCause();
  const remove = useDeleteCause();
  const { push } = useToast();
  const [editing, setEditing] = useState(null); // null | {id?, label_ru, label_tk, isNew}

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
    if (!confirm('Удалить эту причину?')) return;
    remove.mutate(id, {
      onError: (err) => {
        const msg =
          err?.code === 'system_cause' ? 'Системную причину удалить нельзя' :
          err?.code === 'cause_referenced' ? 'Причина используется в заявках' :
          err?.code || 'unknown';
        push({ kind: 'error', title: 'Ошибка', message: msg });
      },
    });
  };

  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Причины приёма</h3>
        <Btn size="sm" onClick={() => setEditing({ isNew: true, id: '', label_ru: '', label_tk: '' })}>
          + Добавить
        </Btn>
      </header>
      {isLoading && <div className="text-stone-500 text-sm">…</div>}
      {!isLoading && causes.length === 0 && <Empty>Пусто</Empty>}
      <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
        {causes.map((c) => (
          <li key={c.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm">
                {c.label_ru} <span className="text-stone-400">/ {c.label_tk}</span>
              </div>
              <div className="text-xs text-stone-500">id: {c.id}{c.isSystem ? ' · системная' : ''}</div>
            </div>
            {!c.isSystem && (
              <>
                <Btn size="sm" kind="ghost" onClick={() => setEditing({ isNew: false, id: c.id, label_ru: c.label_ru, label_tk: c.label_tk })}>
                  ✎
                </Btn>
                <Btn size="sm" kind="danger" onClick={() => onDelete(c.id)}>×</Btn>
              </>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <CauseModal
          key={`${editing.isNew ? 'new' : editing.id}`}
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
  const [id, setId] = useState(editing.id || '');
  const [labelRu, setLabelRu] = useState(editing.label_ru || '');
  const [labelTk, setLabelTk] = useState(editing.label_tk || '');

  const isNew = editing.isNew;
  const idClash = isNew && id && existingIds.has(id);
  const valid = labelRu.trim() && labelTk.trim() && (!isNew || (id.trim() && !idClash));

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Новая причина' : 'Редактировать причину'}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Отмена</Btn>
          <Btn
            disabled={busy || !valid}
            onClick={() => onSave({ id: isNew ? id : editing.id, label_ru: labelRu, label_tk: labelTk }, isNew)}
          >
            Сохранить
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm text-stone-600">id (нижний регистр, латиница)</label>
          <Input value={id} disabled={!isNew} onChange={(e) => setId(e.target.value)} />
          {idClash && <div className="text-xs text-rose-600 mt-1">id уже используется</div>}
        </div>
        <div>
          <label className="text-sm text-stone-600">Название (RU)</label>
          <Input value={labelRu} onChange={(e) => setLabelRu(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">Название (TK)</label>
          <Input value={labelTk} onChange={(e) => setLabelTk(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
