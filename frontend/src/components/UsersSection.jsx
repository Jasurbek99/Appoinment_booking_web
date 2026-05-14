import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/useUsers.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { Btn, Input, Select, Empty, Modal, Badge } from './primitives.jsx';

const ROLE_IDS = ['secretary', 'assistant1', 'assistant2', 'assistant3', 'boss1', 'boss2', 'boss3'];
const BOSS_ROLES = new Set(['boss1', 'boss2', 'boss3']);

function roleLabel(id, t) {
  if (id === 'secretary') return t('roleSecretary');
  if (id === 'assistant1') return t('roleAssistant1');
  if (id === 'assistant2') return t('roleAssistant2');
  if (id === 'assistant3') return t('roleAssistant3');
  if (id === 'boss1') return t('roleBoss1');
  if (id === 'boss2') return t('roleBoss2');
  if (id === 'boss3') return t('roleBoss3');
  return id;
}

export function UsersSection() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const { data: users = [], isLoading } = useUsers();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const { push } = useToast();
  const [editing, setEditing] = useState(null);

  const bossNames = users.reduce((acc, u) => {
    if (BOSS_ROLES.has(u.role)) acc[u.role] = u.displayName;
    return acc;
  }, {});

  const onSave = (form, isNew) => {
    const cb = {
      onSuccess: () => setEditing(null),
      onError: (err) => push({ kind: 'error', title: t('errorTitle'), message: msgFor(err, t) }),
    };
    if (isNew) create.mutate(form, cb);
    else {
      const patch = { ...form };
      if (!patch.password) delete patch.password;
      update.mutate({ id: editing.id, ...patch }, cb);
    }
  };

  const onDelete = (id) => {
    if (!confirm(t('deleteUserConfirm'))) return;
    remove.mutate(id, { onError: (err) => push({ kind: 'error', title: t('errorTitle'), message: msgFor(err, t) }) });
  };

  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{t('usersSection')}</h3>
        <Btn size="sm" onClick={() => setEditing({ isNew: true, displayName: '', username: '', password: '', role: 'assistant1' })}>
          + {t('add')}
        </Btn>
      </header>
      {isLoading && <div className="text-stone-500 text-sm">…</div>}
      {!isLoading && users.length === 0 && <Empty>{t('empty')}</Empty>}
      <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
        {users.map((u) => (
          <li key={u.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm">
                {u.displayName} {u.id === me.id && <Badge kind="info">{t('thisIsYou')}</Badge>}
              </div>
              <div className="text-xs text-stone-500">@{u.username} · {roleLabel(u.role, t)}</div>
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
          bossNames={bossNames}
          onClose={() => setEditing(null)}
          onSave={onSave}
          busy={create.isPending || update.isPending}
        />
      )}
    </section>
  );
}

function UserModal({ editing, isMe, bossNames = {}, onClose, onSave, busy }) {
  const { t } = useI18n();
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
      title={isNew ? t('newUser') : t('editUser')}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>{t('cancel')}</Btn>
          <Btn disabled={busy || !valid} onClick={() => onSave({ display_name: displayName, username, password, role }, isNew)}>
            {t('save')}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm text-stone-600">{t('displayName')}</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('username')}</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">
            {t('password')} {!isNew && <span className="text-stone-400">— {t('passwordKeepHint')}</span>}
          </label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('role')}</label>
          <Select value={role} onChange={(e) => setRole(e.target.value)} disabled={isMe}>
            {ROLE_IDS.map((id) => {
              const bossName = bossNames[id];
              const label = bossName ? bossName : roleLabel(id, t);
              return (
                <option key={id} value={id}>{label}</option>
              );
            })}
          </Select>
          {isMe && <div className="text-xs text-stone-500 mt-1">{t('cantChangeOwnRole')}</div>}
        </div>
      </div>
    </Modal>
  );
}

function msgFor(err, t) {
  if (err?.code === 'username_taken') return t('errUsernameTaken');
  if (err?.code === 'forbidden_self') return t('errForbiddenSelf');
  if (err?.code === 'validation') return t('errValidation');
  return err?.code || 'unknown';
}
