import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/useUsers.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { Btn, Input, Select, Empty, Modal, Badge } from './primitives.jsx';

const ROLES = [
  { id: 'secretary', label: 'Секретарь' },
  { id: 'assistant1', label: 'Ассистент Б1' },
  { id: 'assistant2', label: 'Ассистент Б2' },
  { id: 'assistant3', label: 'Ассистент Б3' },
  { id: 'boss1', label: 'Босс 1' },
  { id: 'boss2', label: 'Босс 2' },
  { id: 'boss3', label: 'Босс 3' },
];
const BOSS_ROLES = new Set(['boss1', 'boss2', 'boss3']);
const labelOf = (id) => ROLES.find((r) => r.id === id)?.label || id;

export function UsersSection() {
  const { user: me } = useAuth();
  const { data: users = [], isLoading } = useUsers();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const { push } = useToast();
  const [editing, setEditing] = useState(null);

  const bossUsernames = users.reduce((acc, u) => {
    if (BOSS_ROLES.has(u.role)) acc[u.role] = u.username;
    return acc;
  }, {});

  const onSave = (form, isNew) => {
    const cb = {
      onSuccess: () => setEditing(null),
      onError: (err) => push({ kind: 'error', title: 'Ошибка', message: msgFor(err) }),
    };
    if (isNew) create.mutate(form, cb);
    else {
      const patch = { ...form };
      if (!patch.password) delete patch.password;
      update.mutate({ id: editing.id, ...patch }, cb);
    }
  };

  const onDelete = (id) => {
    if (!confirm('Удалить этого пользователя?')) return;
    remove.mutate(id, { onError: (err) => push({ kind: 'error', title: 'Ошибка', message: msgFor(err) }) });
  };

  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Учётные записи</h3>
        <Btn size="sm" onClick={() => setEditing({ isNew: true, displayName: '', username: '', password: '', role: 'assistant1' })}>
          + Добавить
        </Btn>
      </header>
      {isLoading && <div className="text-stone-500 text-sm">…</div>}
      {!isLoading && users.length === 0 && <Empty>Пусто</Empty>}
      <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
        {users.map((u) => (
          <li key={u.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm">
                {u.displayName} {u.id === me.id && <Badge kind="info">Это вы</Badge>}
              </div>
              <div className="text-xs text-stone-500">@{u.username} · {labelOf(u.role)}</div>
            </div>
            <Btn size="sm" kind="ghost" onClick={() => setEditing({ isNew: false, id: u.id, displayName: u.displayName, username: u.username, password: '', role: u.role })}>
              ✎
            </Btn>
            <Btn size="sm" kind="danger" onClick={() => onDelete(u.id)} disabled={u.id === me.id}>
              ×
            </Btn>
          </li>
        ))}
      </ul>
      {editing && (
        <UserModal
          key={editing.isNew ? 'new' : editing.id}
          editing={editing}
          isMe={editing.id === me.id}
          bossUsernames={bossUsernames}
          onClose={() => setEditing(null)}
          onSave={onSave}
          busy={create.isPending || update.isPending}
        />
      )}
    </section>
  );
}

function UserModal({ editing, isMe, bossUsernames = {}, onClose, onSave, busy }) {
  const [displayName, setDisplayName] = useState(editing.displayName || '');
  const [username, setUsername] = useState(editing.username || '');
  const [password, setPassword] = useState(editing.password || '');
  const [role, setRole] = useState(editing.role || 'assistant1');

  const isNew = editing.isNew;
  const valid =
    displayName.trim() &&
    username.trim() &&
    (isNew ? password.length >= 6 : true);

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Новый пользователь' : 'Редактировать пользователя'}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Отмена</Btn>
          <Btn disabled={busy || !valid} onClick={() => onSave({ display_name: displayName, username, password, role }, isNew)}>
            Сохранить
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm text-stone-600">ФИО</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">Логин</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">
            Пароль {!isNew && <span className="text-stone-400">— оставьте пустым, чтобы не менять</span>}
          </label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">Роль</label>
          <Select value={role} onChange={(e) => setRole(e.target.value)} disabled={isMe}>
            {ROLES.map((r) => {
              const bossName = bossUsernames[r.id];
              const label = bossName ? `@${bossName}` : r.label;
              return (
                <option key={r.id} value={r.id}>{label}</option>
              );
            })}
          </Select>
          {isMe && <div className="text-xs text-stone-500 mt-1">Свою роль изменить нельзя.</div>}
        </div>
      </div>
    </Modal>
  );
}

function msgFor(err) {
  if (err?.code === 'username_taken') return 'Логин уже занят';
  if (err?.code === 'forbidden_self') return 'Нельзя выполнить это действие над своим аккаунтом';
  if (err?.code === 'validation') return 'Проверьте поля';
  return err?.code || 'unknown';
}
