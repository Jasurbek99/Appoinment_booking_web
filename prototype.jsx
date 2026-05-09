import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell, Plus, Search, Check, X, Clock, AlertTriangle,
  Calendar, BookText, Settings as SettingsIcon,
  User, Building2, Globe2, RotateCcw, Users, BarChart3,
  Trash2, Edit2, ArrowLeft, MessageCircle, UserCircle, KeyRound, Shield
} from 'lucide-react';

// ============================================================
// PROTOTYPE — Appointment Booking System
// Stack target: React + MSSQL + Express + Socket.io
// Single-file clickable mock with in-memory state +
// window.storage persistence. No real backend.
// ============================================================

const STORAGE_KEY = 'appt_app_v2';

const BOSSES = [
  { id: 'boss1', name_ru: 'Босс 1', name_tk: 'Başlyk 1' },
  { id: 'boss2', name_ru: 'Босс 2', name_tk: 'Başlyk 2' },
  { id: 'boss3', name_ru: 'Босс 3', name_tk: 'Başlyk 3' },
];

// Roles are categories — each user holds exactly one role.
// Multiple users can share the same role (e.g. two secretaries).
const ROLES = [
  { id: 'secretary',  label_ru: 'Секретарь',     label_tk: 'Sekretar',    kind: 'staff' },
  { id: 'assistant1', label_ru: 'Ассистент Б1',  label_tk: 'Kömekçi B1',  kind: 'staff' },
  { id: 'assistant2', label_ru: 'Ассистент Б2',  label_tk: 'Kömekçi B2',  kind: 'staff' },
  { id: 'assistant3', label_ru: 'Ассистент Б3',  label_tk: 'Kömekçi B3',  kind: 'staff' },
  { id: 'boss1',      label_ru: 'Босс 1',        label_tk: 'Başlyk 1',    kind: 'boss' },
  { id: 'boss2',      label_ru: 'Босс 2',        label_tk: 'Başlyk 2',    kind: 'boss' },
  { id: 'boss3',      label_ru: 'Босс 3',        label_tk: 'Başlyk 3',    kind: 'boss' },
];
const ROLE_KIND = (rid) => ROLES.find(r => r.id === rid)?.kind;

// Default users — one per role slot. Settings panel can add more.
const INITIAL_USERS = [
  { id: 'u_sec1', displayName: 'Иванова А.А.',   username: 'sec1', role: 'secretary'  },
  { id: 'u_ass1', displayName: 'Сидорова М.П.',  username: 'ass1', role: 'assistant1' },
  { id: 'u_ass2', displayName: 'Петрова О.К.',   username: 'ass2', role: 'assistant2' },
  { id: 'u_ass3', displayName: 'Курбанова Г.Р.', username: 'ass3', role: 'assistant3' },
  { id: 'u_b1',   displayName: 'Иванов И.И.',    username: 'b1',   role: 'boss1'      },
  { id: 'u_b2',   displayName: 'Петров П.П.',    username: 'b2',   role: 'boss2'      },
  { id: 'u_b3',   displayName: 'Сидоров С.С.',   username: 'b3',   role: 'boss3'      },
];

// Mock employee directory — replaced by real API in production
const INITIAL_EMPLOYEES = [
  { id: 1, firstName: 'Иван',    lastName: 'Петров',     company: 'ООО «Альянс»' },
  { id: 2, firstName: 'Мария',   lastName: 'Сидорова',   company: 'ООО «Альянс»' },
  { id: 3, firstName: 'Maral',   lastName: 'Atayeva',    company: 'Türkmengaz' },
  { id: 4, firstName: 'Aly',     lastName: 'Bayramow',   company: 'Türkmennebit' },
  { id: 5, firstName: 'Сергей',  lastName: 'Иванов',     company: 'СП «Восток»' },
  { id: 6, firstName: 'Gözel',   lastName: 'Hojaýewa',   company: 'Türkmenhowaýollary' },
  { id: 7, firstName: 'Дмитрий', lastName: 'Кузнецов',   company: 'ООО «Альянс»' },
];

const INITIAL_CAUSES = [
  { id: 'work',     label_ru: 'По работе',          label_tk: 'Iş boýunça' },
  { id: 'personal', label_ru: 'По своим причинам',  label_tk: 'Şahsy sebäpler' },
  { id: 'other',    label_ru: 'Другое',             label_tk: 'Beýleki' },
];

// ============================================================
// i18n
// ============================================================
const T = {
  ru: {
    appName: 'Запись на приём',
    today: 'Сегодня', future: 'Будущие', journal: 'Журнал',
    settings: 'Настройки', analytics: 'Аналитика',
    employee: 'Сотрудник', guest: 'Гость', foreign: 'Иностранный гость',
    search: 'Поиск', searchByName: 'Поиск по фамилии…',
    firstName: 'Имя', lastName: 'Фамилия', company: 'Фирма',
    boss: 'Босс', urgent: 'Срочно', cause: 'Причина',
    create: 'Создать', cancel: 'Отмена', save: 'Сохранить',
    approve: 'Одобрить', reject: 'Отклонить',
    invite: 'Пригласить', complete: 'Завершить',
    pending: 'Ожидает', approved: 'Одобрено',
    rejected: 'Отклонено', invited: 'Приглашён',
    completed: 'Завершено',
    date: 'Дата', notifications: 'Уведомления',
    newAppointment: 'Новая заявка', status: 'Статус',
    actionLog: 'Журнал действий',
    rejectionReason: 'Причина отказа (необязательно)',
    rejectionLabel: 'Причина отказа',
    customCause: 'Опишите причину',
    addManually: 'Вписать вручную', backToSearch: 'Назад',
    noResults: 'Ничего не найдено',
    searchEmployee: 'Поиск по имени, фамилии или фирме',
    yourRequests: 'Ваши заявки',
    todayList: 'Заявки на сегодня',
    pendingDecision: 'Ожидают решения', awaitingPickup: 'Ожидают приглашения',
    fromYesterday: 'перенесено',
    urgentBadge: 'Срочно', totalToday: 'Всего сегодня',
    approvedCount: 'Одобрено', rejectedCount: 'Отклонено',
    completedCount: 'Завершено', urgentCount: 'Срочных',
    causes: 'Список причин', addCause: 'Добавить причину',
    delete: 'Удалить', edit: 'Редактировать',
    resetData: 'Сбросить демо-данные',
    resetConfirm: 'Вернуть исходные демо-данные?',
    role: 'Роль', language: 'Язык',
    noPending: 'Нет заявок, ожидающих решения',
    noApproved: 'Нет приглашений в очереди',
    actionCreate: 'создал заявку', actionApprove: 'одобрил',
    actionReject: 'отклонил', actionInvite: 'пригласил',
    actionComplete: 'завершил',
    notif_newRequest: 'Новая заявка',
    notif_approved: 'Заявка одобрена',
    notif_rejected: 'Заявка отклонена',
    notif_invited: 'Босс зовёт сейчас',
    notif_completed: 'Заявка завершена',
    selectBoss: 'Выберите босса', selectCause: 'Выберите причину',
    sayLastName: 'Введите фамилию для поиска статуса',
    nothingHere: 'Здесь пока ничего нет',
    requestCreated: 'Заявка создана',
    futureNotice: 'Появятся в основном списке в день визита',
    causeLabelRu: 'Название (RU)', causeLabelTk: 'Название (TK)',
    actionLogDesc: 'Полная история по каждой заявке',
    when: 'Когда', who: 'Кто', what: 'Действие',
    appointmentNo: 'Заявка',
    welcomeWorker: 'Проверка статуса заявки',
    workerHint: 'Это публичная страница — без входа',
    youAreInvited: 'Вас зовут к',
    inviteToast: 'просит зайти',
    // user management
    users: 'Пользователи',
    addUser: 'Добавить пользователя',
    displayName: 'ФИО',
    username: 'Логин',
    password: 'Пароль',
    setPassword: 'Сменить пароль',
    leaveBlankToKeep: 'Оставьте пустым, чтобы не менять',
    selectRole: 'Выберите роль',
    workerPublic: 'Сотрудник (публичная страница)',
    cannotDeleteSelf: 'Нельзя удалить активного пользователя',
    deleteUserConfirm: 'Удалить этого пользователя?',
    activeUser: 'Активный',
    secretaryAlsoAdmin: 'Секретарь имеет права администратора пользователей',
    chooseUser: 'Выберите пользователя',
    loginAs: 'Войти как',
    causesSection: 'Причины приёма',
    usersSection: 'Учётные записи',
  },
  tk: {
    appName: 'Kabula ýazylyş',
    today: 'Şu gün', future: 'Geljekki', journal: 'Žurnal',
    settings: 'Sazlamalar', analytics: 'Analitika',
    employee: 'Işgär', guest: 'Myhman', foreign: 'Daşary ýurtly myhman',
    search: 'Gözleg', searchByName: 'Familiýa boýunça gözleg…',
    firstName: 'At', lastName: 'Familiýa', company: 'Kärhana',
    boss: 'Başlyk', urgent: 'Gyssagly', cause: 'Sebäp',
    create: 'Döretmek', cancel: 'Goý bolsun', save: 'Saklamak',
    approve: 'Tassyklamak', reject: 'Ret etmek',
    invite: 'Çagyrmak', complete: 'Tamamlamak',
    pending: 'Garaşýar', approved: 'Tassyklanan',
    rejected: 'Ret edilen', invited: 'Çagyrylan',
    completed: 'Tamamlanan',
    date: 'Sene', notifications: 'Bildirişler',
    newAppointment: 'Täze haýyş', status: 'Status',
    actionLog: 'Hereketler žurnaly',
    rejectionReason: 'Ret etmegiň sebäbi (hökman däl)',
    rejectionLabel: 'Ret etmegiň sebäbi',
    customCause: 'Sebäbi ýazyň',
    addManually: 'El bilen ýazmak', backToSearch: 'Yza',
    noResults: 'Hiç zat tapylmady',
    searchEmployee: 'At, familiýa ýa-da kärhana boýunça gözleg',
    yourRequests: 'Siziň haýyşlaryňyz',
    todayList: 'Şu günki haýyşlar',
    pendingDecision: 'Çözüme garaşýar', awaitingPickup: 'Çagyrylmaga garaşýar',
    fromYesterday: 'geçirilen',
    urgentBadge: 'Gyssagly', totalToday: 'Şu gün jemi',
    approvedCount: 'Tassyklanan', rejectedCount: 'Ret edilen',
    completedCount: 'Tamamlanan', urgentCount: 'Gyssaglysy',
    causes: 'Sebäpleriň sanawy', addCause: 'Sebäp goşmak',
    delete: 'Pozmak', edit: 'Üýtgetmek',
    resetData: 'Demo-maglumatlary täzelemek',
    resetConfirm: 'Demo-maglumatlary gaýtaryp getirmek?',
    role: 'Rol', language: 'Dil',
    noPending: 'Çözüme garaşýan haýyş ýok',
    noApproved: 'Çagyryş nobatynda hiç kim ýok',
    actionCreate: 'haýyş döretdi', actionApprove: 'tassyklady',
    actionReject: 'ret etdi', actionInvite: 'çagyrdy',
    actionComplete: 'tamamlady',
    notif_newRequest: 'Täze haýyş',
    notif_approved: 'Haýyş tassyklandy',
    notif_rejected: 'Haýyş ret edildi',
    notif_invited: 'Başlyk häzir çagyrýar',
    notif_completed: 'Haýyş tamamlandy',
    selectBoss: 'Başlygy saýlaň', selectCause: 'Sebäbi saýlaň',
    sayLastName: 'Statusy görmek üçin familiýaňyzy giriziň',
    nothingHere: 'Bu ýerde hiç zat ýok',
    requestCreated: 'Haýyş döredildi',
    futureNotice: 'Baryp görüljek günde esasy sanawda peýda bolar',
    causeLabelRu: 'Ady (RU)', causeLabelTk: 'Ady (TK)',
    actionLogDesc: 'Her haýyş boýunça doly taryh',
    when: 'Haçan', who: 'Kim', what: 'Hereket',
    appointmentNo: 'Haýyş',
    welcomeWorker: 'Haýyşyň statusyny barlamak',
    workerHint: 'Bu açyk sahypa — girişsiz',
    youAreInvited: 'Sizi çagyrýar',
    inviteToast: 'çagyrýar',
    // user management
    users: 'Ulanyjylar',
    addUser: 'Ulanyjy goşmak',
    displayName: 'F.A.A.',
    username: 'Login',
    password: 'Açar söz',
    setPassword: 'Açar sözi üýtgetmek',
    leaveBlankToKeep: 'Üýtgetmezlik üçin boş goýuň',
    selectRole: 'Roly saýlaň',
    workerPublic: 'Işgär (açyk sahypa)',
    cannotDeleteSelf: 'Aktiw ulanyjyny pozup bolmaýar',
    deleteUserConfirm: 'Bu ulanyjyny pozmaly?',
    activeUser: 'Aktiw',
    secretaryAlsoAdmin: 'Sekretarda ulanyjy administratory haklary bar',
    chooseUser: 'Ulanyjy saýlaň',
    loginAs: 'Şulaýyn giriş',
    causesSection: 'Kabul sebäpleri',
    usersSection: 'Hasaplar',
  }
};

// ============================================================
// Helpers
// ============================================================
const today = () => new Date().toISOString().split('T')[0];
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (yyyymmdd, lang) => {
  if (!yyyymmdd) return '';
  const d = new Date(yyyymmdd + 'T00:00:00');
  return d.toLocaleDateString(lang === 'tk' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short' });
};
const bossName = (id, lang) => BOSSES.find(b => b.id === id)?.[`name_${lang}`] || id;
const roleName = (id, lang) => ROLES.find(r => r.id === id)?.[`label_${lang}`] || id;
const causeName = (id, causes, lang) => causes.find(c => c.id === id)?.[`label_${lang}`] || id;
const userById = (id, users) => users.find(u => u.id === id);

// Resolve "by" field of history entry — could be userId or legacy role string
const resolveActor = (by, users, lang) => {
  const u = userById(by, users);
  if (u) return { name: u.displayName, role: roleName(u.role, lang) };
  // fallback: maybe it's a role id
  return { name: roleName(by, lang), role: '' };
};

const visitorDisplay = (a, employees) => {
  if (a.visitorType === 'employee') {
    const e = employees.find(x => x.id === a.employeeId);
    return e ? { name: `${e.firstName} ${e.lastName}`, company: e.company }
             : { name: '—', company: '' };
  }
  return { name: `${a.visitor.firstName} ${a.visitor.lastName}`, company: a.visitor.company || '' };
};

// Initial demo appointments — covers all states
const buildInitialAppointments = () => {
  const t = today();
  const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tom = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const ts = (mins) => new Date(Date.now() - mins * 60000).toISOString();
  return [
    { id: 1, visitorType: 'employee', employeeId: 1, bossId: 'boss1',
      causeId: 'work', urgent: true, date: t, status: 'pending',
      history: [{ action: 'create', by: 'u_sec1', at: ts(45) }] },
    { id: 2, visitorType: 'employee', employeeId: 3, bossId: 'boss1',
      causeId: 'personal', urgent: false, date: t, status: 'pending',
      history: [{ action: 'create', by: 'u_sec1', at: ts(30) }] },
    { id: 3, visitorType: 'guest', visitor: { firstName: 'Andrey', lastName: 'Smirnov' },
      bossId: 'boss2', causeId: 'work', urgent: false, date: t, status: 'approved',
      history: [
        { action: 'create',  by: 'u_sec1', at: ts(120) },
        { action: 'approve', by: 'u_b2',   at: ts(100) }
      ] },
    { id: 4, visitorType: 'employee', employeeId: 4, bossId: 'boss1',
      causeId: 'work', urgent: false, date: yest, status: 'approved',
      history: [
        { action: 'create',  by: 'u_sec1', at: ts(1500) },
        { action: 'approve', by: 'u_b1',   at: ts(1450) }
      ] },
    { id: 5, visitorType: 'employee', employeeId: 5, bossId: 'boss3',
      causeId: 'other', customCause: 'Согласование документов',
      urgent: false, date: t, status: 'completed',
      history: [
        { action: 'create',   by: 'u_sec1', at: ts(300) },
        { action: 'approve',  by: 'u_b3',   at: ts(280) },
        { action: 'invite',   by: 'u_b3',   at: ts(120) },
        { action: 'complete', by: 'u_sec1', at: ts(90) }
      ] },
    { id: 6, visitorType: 'foreign', visitor: { firstName: 'John', lastName: 'Mueller' },
      bossId: 'boss2', causeId: 'work', urgent: false, date: t, status: 'rejected',
      rejectionReason: 'Босс уехал на встречу',
      history: [
        { action: 'create', by: 'u_sec1', at: ts(200) },
        { action: 'reject', by: 'u_b2',   at: ts(180), note: 'Босс уехал на встречу' }
      ] },
    { id: 7, visitorType: 'employee', employeeId: 6, bossId: 'boss1',
      causeId: 'work', urgent: false, date: tom, status: 'pending',
      history: [{ action: 'create', by: 'u_sec1', at: ts(20) }] },
  ];
};

// ============================================================
// Storage
// ============================================================
const loadState = async () => {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
};
const saveState = async (state) => {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error('storage save', e); }
};

// ============================================================
// Reusable UI
// ============================================================
const Btn = ({ variant = 'primary', children, ...p }) => {
  const v = {
    primary:  'bg-stone-900 text-white hover:bg-stone-800',
    soft:     'bg-stone-100 text-stone-900 hover:bg-stone-200',
    success:  'bg-emerald-600 text-white hover:bg-emerald-700',
    danger:   'bg-rose-600 text-white hover:bg-rose-700',
    ghost:    'bg-transparent text-stone-700 hover:bg-stone-100',
    outline:  'border border-stone-300 text-stone-900 hover:bg-stone-50',
  }[variant];
  return (
    <button {...p} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${v} ${p.className || ''}`}>
      {children}
    </button>
  );
};

const Badge = ({ tone = 'neutral', children, icon: Icon }) => {
  const tones = {
    neutral:   'bg-stone-100 text-stone-700',
    urgent:    'bg-rose-100 text-rose-700',
    pending:   'bg-amber-100 text-amber-800',
    approved:  'bg-emerald-100 text-emerald-700',
    rejected:  'bg-stone-200 text-stone-600',
    invited:   'bg-indigo-100 text-indigo-700',
    completed: 'bg-stone-100 text-stone-500',
    info:      'bg-sky-100 text-sky-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${tones[tone]}`}>
      {Icon && <Icon size={12} />}{children}
    </span>
  );
};

const StatusBadge = ({ status, lang }) => {
  const map = {
    pending:   { tone: 'pending',   label: T[lang].pending },
    approved:  { tone: 'approved',  label: T[lang].approved },
    rejected:  { tone: 'rejected',  label: T[lang].rejected },
    invited:   { tone: 'invited',   label: T[lang].invited },
    completed: { tone: 'completed', label: T[lang].completed },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
};

const Modal = ({ children, onClose, title, wide }) => (
  <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
    <div onClick={e => e.stopPropagation()}
         className={`bg-white rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-md'} w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X size={18}/></button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-medium text-stone-600 mb-1.5 block">{label}</span>
    {children}
  </label>
);

const Input = (p) => (
  <input {...p}
    className={`w-full px-3 py-2 rounded-xl border border-stone-300 text-sm
                focus:outline-none focus:border-stone-900 transition ${p.className || ''}`} />
);

const Select = ({ children, ...p }) => (
  <select {...p}
    className={`w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white
                focus:outline-none focus:border-stone-900 transition ${p.className || ''}`}>
    {children}
  </select>
);

const Empty = ({ icon: Icon = Calendar, text }) => (
  <div className="text-center py-12 text-stone-400">
    <Icon size={32} className="mx-auto mb-2 opacity-50" />
    <div className="text-sm">{text}</div>
  </div>
);

// ============================================================
// Top Bar — user switcher (replaces real auth in prototype)
// ============================================================
const TopBar = ({ lang, setLang, currentUserId, setCurrentUserId,
                  users, notifs, onClearNotifs }) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const t = T[lang];
  const usersByRole = ROLES.map(r => ({
    role: r,
    items: users.filter(u => u.role === r.id)
  })).filter(g => g.items.length > 0);

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-white">
            <Calendar size={16} />
          </div>
          <h1 className="font-semibold text-stone-900 text-sm sm:text-base">{t.appName}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setShowNotifs(s => !s)} className="relative p-2 hover:bg-stone-100 rounded-xl">
              <Bell size={18} />
              {notifs.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />}
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-lg p-2 z-50">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">{t.notifications}</span>
                  {notifs.length > 0 && (
                    <button onClick={onClearNotifs} className="text-xs text-stone-500 hover:text-stone-900">×</button>
                  )}
                </div>
                {notifs.length === 0 ? (
                  <div className="text-sm text-stone-400 px-3 py-6 text-center">—</div>
                ) : notifs.slice().reverse().map(n => (
                  <div key={n.id} className="px-3 py-2 hover:bg-stone-50 rounded-xl text-sm">
                    <div className="font-medium text-stone-900">{n.title}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{n.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Language */}
          <div className="flex items-center bg-stone-100 rounded-xl p-0.5 text-xs font-medium">
            {['ru','tk'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-lg transition ${lang===l ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* User switcher (prototype only — replaces real login) */}
          <Select value={currentUserId || ''} onChange={e => setCurrentUserId(e.target.value || null)}
                  className="!py-1.5 !text-xs !w-auto pr-8">
            <option value="">— {t.workerPublic}</option>
            {usersByRole.map(g => (
              <optgroup key={g.role.id} label={g.role[`label_${lang}`]}>
                {g.items.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
      </div>
    </header>
  );
};

// ============================================================
// Toast (websocket sim)
// ============================================================
const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [toast.id, onClose]);
  const tones = {
    info:    'bg-stone-900 text-white',
    urgent:  'bg-rose-600 text-white',
    success: 'bg-emerald-600 text-white',
  };
  return (
    <div className={`fixed bottom-6 right-6 ${tones[toast.tone||'info']} px-4 py-3 rounded-2xl shadow-lg z-50 max-w-sm`}>
      <div className="font-semibold text-sm">{toast.title}</div>
      {toast.body && <div className="text-xs opacity-90 mt-0.5">{toast.body}</div>}
    </div>
  );
};

// ============================================================
// Appointment Card
// ============================================================
const AppointmentCard = ({ a, lang, employees, causes, role, onAction }) => {
  const t = T[lang];
  const v = visitorDisplay(a, employees);
  const isStaff = ROLE_KIND(role) === 'staff';
  const isBoss  = ROLE_KIND(role) === 'boss';
  const carriedOver = a.date < today() && a.status !== 'completed' && a.status !== 'rejected';
  const typeLabel = { employee: t.employee, guest: t.guest, foreign: t.foreign }[a.visitorType];

  return (
    <div className={`bg-white rounded-2xl border ${a.urgent && a.status==='pending' ? 'border-rose-300' : 'border-stone-200'} p-4 transition hover:shadow-sm`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {a.urgent && <Badge tone="urgent" icon={AlertTriangle}>{t.urgentBadge}</Badge>}
            <StatusBadge status={a.status} lang={lang} />
            {carriedOver && <Badge tone="info" icon={RotateCcw}>{t.fromYesterday}</Badge>}
            <span className="text-xs text-stone-400">#{a.id}</span>
          </div>
          <div className="text-base font-semibold text-stone-900">{v.name}</div>
          <div className="text-sm text-stone-500 flex items-center gap-3 flex-wrap mt-0.5">
            {v.company && <span className="flex items-center gap-1"><Building2 size={12}/> {v.company}</span>}
            <span className="text-stone-300">·</span>
            <span>{typeLabel}</span>
            <span className="text-stone-300">·</span>
            <span>→ {bossName(a.bossId, lang)}</span>
          </div>
          <div className="text-sm text-stone-600 mt-2">
            <span className="text-stone-400">{t.cause}:</span>{' '}
            {a.causeId === 'other' && a.customCause ? a.customCause : causeName(a.causeId, causes, lang)}
          </div>
          {a.status === 'rejected' && a.rejectionReason && (
            <div className="text-sm text-stone-500 mt-1.5 italic">«{a.rejectionReason}»</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-xs text-stone-400">{fmtTime(a.history[0].at)}</span>
        </div>
      </div>

      {isBoss && a.status === 'pending' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
          <Btn variant="success" onClick={() => onAction('approve', a)}>
            <Check size={14} className="inline mr-1"/>{t.approve}
          </Btn>
          <Btn variant="outline" onClick={() => onAction('rejectStart', a)}>
            <X size={14} className="inline mr-1"/>{t.reject}
          </Btn>
        </div>
      )}
      {isBoss && a.status === 'approved' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
          <Btn variant="primary" onClick={() => onAction('invite', a)}>
            <MessageCircle size={14} className="inline mr-1"/>{t.invite}
          </Btn>
          <Btn variant="ghost" onClick={() => onAction('complete', a)}>{t.complete}</Btn>
        </div>
      )}
      {isBoss && a.status === 'invited' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
          <Btn variant="ghost" onClick={() => onAction('complete', a)}>{t.complete}</Btn>
        </div>
      )}
      {isStaff && (a.status === 'approved' || a.status === 'invited') && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
          <Btn variant="ghost" onClick={() => onAction('complete', a)}>{t.complete}</Btn>
        </div>
      )}
    </div>
  );
};

// ============================================================
// New Appointment Modal
// ============================================================
const NewAppointmentModal = ({ lang, employees, causes, onCreate, onClose }) => {
  const t = T[lang];
  const [type, setType] = useState('employee');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);
  const [manual, setManual] = useState({ firstName: '', lastName: '', company: '' });
  const [bossId, setBossId] = useState('');
  const [causeId, setCauseId] = useState('');
  const [customCause, setCustomCause] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [date, setDate] = useState(today());
  const [manualMode, setManualMode] = useState(false);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    return employees.filter(e =>
      e.firstName.toLowerCase().includes(s) ||
      e.lastName.toLowerCase().includes(s) ||
      e.company.toLowerCase().includes(s)
    ).slice(0, 6);
  }, [search, employees]);

  const canSubmit = bossId && causeId &&
    (causeId !== 'other' || customCause.trim()) &&
    (type === 'employee' ? (picked || (manualMode && manual.firstName && manual.lastName))
                         : (manual.firstName && manual.lastName));

  const handleCreate = () => {
    onCreate({
      visitorType: type,
      employeeId: type === 'employee' && picked ? picked.id : undefined,
      visitor: type !== 'employee' || (type === 'employee' && manualMode)
                ? { firstName: manual.firstName, lastName: manual.lastName, company: manual.company || undefined }
                : undefined,
      bossId, causeId,
      customCause: causeId === 'other' ? customCause : undefined,
      urgent, date,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose} title={t.newAppointment} wide>
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-5 text-sm font-medium">
        {[
          ['employee', User,   t.employee],
          ['guest',    Users,  t.guest],
          ['foreign',  Globe2, t.foreign],
        ].map(([k, Icon, label]) => (
          <button key={k} onClick={() => { setType(k); setPicked(null); setManualMode(k!=='employee'); setManual({firstName:'',lastName:'',company:''}); }}
                  className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition
                              ${type===k ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {type === 'employee' && !manualMode && (
        <div className="mb-4">
          <Field label={t.searchEmployee}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/>
              <Input value={search} onChange={e => { setSearch(e.target.value); setPicked(null); }}
                     placeholder={t.searchByName} className="pl-9" />
            </div>
          </Field>
          {search && (
            <div className="mt-2 border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-48 overflow-y-auto">
              {matches.length === 0 ? (
                <div className="px-3 py-4 text-sm text-stone-400 text-center">
                  {t.noResults}
                  <button onClick={() => { setManualMode(true); setManual({...manual, lastName: search}); }}
                          className="block mx-auto mt-2 text-stone-900 font-medium underline">
                    {t.addManually}
                  </button>
                </div>
              ) : matches.map(e => (
                <button key={e.id} onClick={() => setPicked(e)}
                        className={`w-full text-left px-3 py-2 hover:bg-stone-50 ${picked?.id===e.id?'bg-stone-100':''}`}>
                  <div className="text-sm font-medium text-stone-900">{e.firstName} {e.lastName}</div>
                  <div className="text-xs text-stone-500">{e.company}</div>
                </button>
              ))}
            </div>
          )}
          {picked && (
            <div className="mt-2 px-3 py-2 bg-stone-900 text-white rounded-xl text-sm flex items-center justify-between">
              <span>{picked.firstName} {picked.lastName} · {picked.company}</span>
              <button onClick={() => setPicked(null)}><X size={14}/></button>
            </div>
          )}
        </div>
      )}

      {(type !== 'employee' || manualMode) && (
        <>
          {type === 'employee' && (
            <button onClick={() => { setManualMode(false); setManual({firstName:'',lastName:'',company:''}); }}
                    className="text-xs text-stone-500 hover:text-stone-900 mb-3 flex items-center gap-1">
              <ArrowLeft size={12}/> {t.backToSearch}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label={t.firstName}>
              <Input value={manual.firstName} onChange={e => setManual({...manual, firstName: e.target.value})} />
            </Field>
            <Field label={t.lastName}>
              <Input value={manual.lastName} onChange={e => setManual({...manual, lastName: e.target.value})} />
            </Field>
            {type !== 'foreign' && (
              <div className="col-span-2">
                <Field label={t.company}>
                  <Input value={manual.company} onChange={e => setManual({...manual, company: e.target.value})} />
                </Field>
              </div>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label={t.boss}>
          <Select value={bossId} onChange={e => setBossId(e.target.value)}>
            <option value="">{t.selectBoss}</option>
            {BOSSES.map(b => <option key={b.id} value={b.id}>{b[`name_${lang}`]}</option>)}
          </Select>
        </Field>
        <Field label={t.date}>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} min={today()} />
        </Field>
        <div className="col-span-2">
          <Field label={t.cause}>
            <Select value={causeId} onChange={e => setCauseId(e.target.value)}>
              <option value="">{t.selectCause}</option>
              {causes.map(c => <option key={c.id} value={c.id}>{c[`label_${lang}`]}</option>)}
            </Select>
          </Field>
        </div>
        {causeId === 'other' && (
          <div className="col-span-2">
            <Field label={t.customCause}>
              <Input value={customCause} onChange={e => setCustomCause(e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 mb-5 cursor-pointer text-sm">
        <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)}
               className="w-4 h-4 rounded accent-rose-600" />
        <AlertTriangle size={14} className="text-rose-500"/>
        <span className="font-medium text-stone-900">{t.urgent}</span>
      </label>

      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>{t.cancel}</Btn>
        <Btn variant="primary" onClick={handleCreate} disabled={!canSubmit}
             className={!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}>
          {t.create}
        </Btn>
      </div>
    </Modal>
  );
};

// ============================================================
// Reject Modal
// ============================================================
const RejectModal = ({ lang, appt, onConfirm, onClose, employees }) => {
  const t = T[lang];
  const [reason, setReason] = useState('');
  if (!appt) return null;
  const v = visitorDisplay(appt, employees);
  return (
    <Modal onClose={onClose} title={t.rejectionLabel}>
      <div className="text-sm text-stone-600 mb-3">{v.name}</div>
      <Field label={t.rejectionReason}>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-stone-900" />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>{t.cancel}</Btn>
        <Btn variant="danger" onClick={() => onConfirm(reason)}>{t.reject}</Btn>
      </div>
    </Modal>
  );
};

// ============================================================
// User Edit Modal
// ============================================================
const UserModal = ({ lang, user, onSave, onClose, existingUsernames }) => {
  const t = T[lang];
  const isNew = !user;
  const [draft, setDraft] = useState(user || { displayName: '', username: '', role: '', password: '' });
  const [pwd, setPwd] = useState('');

  const usernameTaken = draft.username &&
    existingUsernames.includes(draft.username) &&
    (isNew || draft.username !== user.username);

  const canSave = draft.displayName.trim() && draft.username.trim() && draft.role && !usernameTaken &&
    (!isNew || pwd.trim());

  const handleSave = () => {
    const next = { ...draft };
    if (pwd.trim()) next.password = pwd; // in prototype just stored plain — backend hashes
    if (isNew) next.id = 'u_' + Date.now();
    onSave(next, isNew);
  };

  return (
    <Modal onClose={onClose} title={isNew ? t.addUser : t.edit}>
      <div className="space-y-3">
        <Field label={t.displayName}>
          <Input value={draft.displayName} onChange={e => setDraft({...draft, displayName: e.target.value})} />
        </Field>
        <Field label={t.username}>
          <Input value={draft.username} onChange={e => setDraft({...draft, username: e.target.value.replace(/\s/g,'')})} />
          {usernameTaken && <div className="text-xs text-rose-600 mt-1">— занят / band</div>}
        </Field>
        <Field label={t.role}>
          <Select value={draft.role} onChange={e => setDraft({...draft, role: e.target.value})}>
            <option value="">{t.selectRole}</option>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r[`label_${lang}`]}</option>)}
          </Select>
        </Field>
        <Field label={isNew ? t.password : t.setPassword}>
          <Input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                 placeholder={isNew ? '' : t.leaveBlankToKeep} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>{t.cancel}</Btn>
        <Btn variant="primary" onClick={handleSave} disabled={!canSave}
             className={!canSave ? 'opacity-50 cursor-not-allowed' : ''}>
          {t.save}
        </Btn>
      </div>
    </Modal>
  );
};

// ============================================================
// Worker view — public, no auth
// ============================================================
const WorkerView = ({ lang, appointments, employees, causes }) => {
  const t = T[lang];
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return appointments.filter(a => {
      const v = visitorDisplay(a, employees);
      return v.name.toLowerCase().includes(s);
    }).sort((a,b) => new Date(b.history[0].at) - new Date(a.history[0].at));
  }, [q, appointments, employees]);
  const invitedNow = results.find(r => r.status === 'invited');

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-stone-900">{t.welcomeWorker}</h2>
        <p className="text-sm text-stone-500 mt-1">{t.workerHint}</p>
      </div>
      <div className="relative mb-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.sayLastName}
               className="w-full pl-11 pr-4 py-3 rounded-2xl border border-stone-300 bg-white text-base
                          focus:outline-none focus:border-stone-900 transition" />
      </div>
      {invitedNow && (
        <div className="bg-indigo-600 text-white rounded-2xl p-5 mb-4 flex items-center gap-3">
          <MessageCircle size={24}/>
          <div>
            <div className="text-xs opacity-90 uppercase tracking-wide">{t.youAreInvited}</div>
            <div className="text-lg font-semibold">{bossName(invitedNow.bossId, lang)}</div>
          </div>
        </div>
      )}
      {q && (
        <div className="space-y-3">
          {results.length === 0
            ? <Empty text={t.noResults} />
            : results.map(a => (
                <AppointmentCard key={a.id} a={a} lang={lang}
                  employees={employees} causes={causes} role="worker" onAction={()=>{}} />
              ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Tabs
// ============================================================
const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 mb-6 border-b border-stone-200 overflow-x-auto">
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)}
        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 -mb-px whitespace-nowrap
                    ${active===t.id ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
        {t.icon && <t.icon size={14}/>}
        {t.label}
        {typeof t.count === 'number' && t.count > 0 && (
          <span className="bg-stone-100 text-stone-600 px-1.5 rounded-md text-xs">{t.count}</span>
        )}
      </button>
    ))}
  </div>
);

// ============================================================
// Secretary / Assistant view
// ============================================================
const SecretaryView = ({ lang, appointments, employees, causes, role, currentUserId,
                        users, onAction, onCreate, onUpdateCauses, onUpdateUsers, onReset }) => {
  const t = T[lang];
  const [tab, setTab] = useState('today');
  const [showNew, setShowNew] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const todayList = useMemo(() => {
    const td = today();
    return appointments
      .filter(a => a.date === td || (a.date < td && (a.status === 'approved' || a.status === 'invited')))
      .sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        return new Date(a.history[0].at) - new Date(b.history[0].at);
      });
  }, [appointments]);

  const futureList = useMemo(() =>
    appointments.filter(a => a.date > today()).sort((a,b) => a.date.localeCompare(b.date))
  , [appointments]);

  const tabs = [
    { id: 'today',    label: t.today,    icon: Calendar,   count: todayList.filter(a=>a.status==='pending').length },
    { id: 'future',   label: t.future,   icon: Clock,      count: futureList.length },
    { id: 'journal',  label: t.journal,  icon: BookText },
    { id: 'settings', label: t.settings, icon: SettingsIcon },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">{roleName(role, lang)}</div>
          <h2 className="text-xl font-semibold text-stone-900">{t.todayList}</h2>
        </div>
        <Btn variant="primary" onClick={() => setShowNew(true)}>
          <Plus size={14} className="inline mr-1"/>{t.newAppointment}
        </Btn>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'today' && (
        <div className="space-y-3">
          {todayList.length === 0
            ? <Empty text={t.nothingHere} />
            : todayList.map(a => (
                <AppointmentCard key={a.id} a={a} lang={lang}
                  employees={employees} causes={causes} role={role}
                  onAction={(op, ap) => op==='rejectStart' ? setRejecting(ap) : onAction(op, ap)} />
              ))}
        </div>
      )}

      {tab === 'future' && (
        <>
          <div className="text-xs text-stone-500 mb-3">{t.futureNotice}</div>
          <div className="space-y-3">
            {futureList.length === 0
              ? <Empty text={t.nothingHere} />
              : futureList.map(a => (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className="text-xs text-stone-500 w-16 shrink-0">{fmtDate(a.date, lang)}</div>
                    <div className="flex-1">
                      <AppointmentCard a={a} lang={lang}
                        employees={employees} causes={causes} role={role} onAction={()=>{}} />
                    </div>
                  </div>
                ))}
          </div>
        </>
      )}

      {tab === 'journal' && <JournalTab lang={lang} appointments={appointments}
                                        employees={employees} users={users} />}

      {tab === 'settings' && <SettingsTab lang={lang}
                                          causes={causes}    onUpdateCauses={onUpdateCauses}
                                          users={users}      onUpdateUsers={onUpdateUsers}
                                          currentUserId={currentUserId}
                                          onReset={onReset} />}

      {showNew && <NewAppointmentModal lang={lang} employees={employees} causes={causes}
                                       onCreate={onCreate} onClose={() => setShowNew(false)} />}
      {rejecting && <RejectModal lang={lang} appt={rejecting} employees={employees}
                                 onConfirm={(r) => { onAction('reject', rejecting, r); setRejecting(null); }}
                                 onClose={() => setRejecting(null)} />}
    </div>
  );
};

// ============================================================
// Journal — full audit log, includes who (with displayName + role)
// ============================================================
const JournalTab = ({ lang, appointments, employees, users }) => {
  const t = T[lang];
  const allEntries = useMemo(() => {
    const out = [];
    appointments.forEach(a => a.history.forEach(h => out.push({ ...h, appt: a })));
    return out.sort((a,b) => new Date(b.at) - new Date(a.at));
  }, [appointments]);

  const actionLabel = {
    create: t.actionCreate, approve: t.actionApprove,
    reject: t.actionReject, invite: t.actionInvite, complete: t.actionComplete,
  };

  return (
    <div>
      <div className="text-xs text-stone-500 mb-3">{t.actionLogDesc}</div>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-stone-500 uppercase tracking-wide border-b border-stone-100">
          <div className="col-span-2">{t.when}</div>
          <div className="col-span-3">{t.who}</div>
          <div className="col-span-3">{t.what}</div>
          <div className="col-span-4">{t.appointmentNo}</div>
        </div>
        {allEntries.map((e, i) => {
          const v = visitorDisplay(e.appt, employees);
          const actor = resolveActor(e.by, users, lang);
          return (
            <div key={i} className="grid grid-cols-12 px-4 py-2.5 text-sm border-b border-stone-50 last:border-0">
              <div className="col-span-2 text-stone-500 text-xs">
                {new Date(e.at).toLocaleString(lang==='tk'?'en-GB':'ru-RU',
                  { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
              </div>
              <div className="col-span-3">
                <div className="text-stone-900 font-medium text-sm">{actor.name}</div>
                {actor.role && <div className="text-xs text-stone-500">{actor.role}</div>}
              </div>
              <div className="col-span-3 text-stone-900 font-medium">{actionLabel[e.action]}</div>
              <div className="col-span-4 text-stone-600">
                #{e.appt.id} · {v.name}
                {e.note && <span className="text-stone-400 italic"> — «{e.note}»</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// Settings — Causes + Users + Reset
// ============================================================
const SettingsTab = ({ lang, causes, onUpdateCauses, users, onUpdateUsers,
                      currentUserId, onReset }) => {
  const t = T[lang];
  const [section, setSection] = useState('causes');

  return (
    <div className="max-w-3xl">
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-5 text-sm font-medium w-fit">
        {[
          ['causes', BookText, t.causesSection],
          ['users',  Users,    t.usersSection],
        ].map(([k, Icon, label]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition
                        ${section===k ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {section === 'causes' && <CausesSection lang={lang} causes={causes} onUpdate={onUpdateCauses}/>}
      {section === 'users'  && <UsersSection  lang={lang} users={users}
                                              currentUserId={currentUserId}
                                              onUpdate={onUpdateUsers}/>}

      <div className="mt-6">
        <Btn variant="outline" onClick={() => { if (window.confirm(t.resetConfirm)) onReset(); }}>
          <RotateCcw size={14} className="inline mr-1"/> {t.resetData}
        </Btn>
      </div>
    </div>
  );
};

const CausesSection = ({ lang, causes, onUpdate }) => {
  const t = T[lang];
  const [editing, setEditing] = useState(null);
  const [draft, setDraft]     = useState({ id: '', label_ru: '', label_tk: '' });

  const startEdit = (c) => { setEditing(c.id); setDraft({ ...c }); };
  const startNew = () => { setEditing('__new'); setDraft({ id: '', label_ru: '', label_tk: '' }); };
  const saveEdit = () => {
    if (!draft.label_ru.trim()) return;
    if (editing === '__new') {
      const id = (draft.label_ru.toLowerCase().replace(/\s+/g, '_').slice(0,20) || 'new_' + Date.now());
      onUpdate([...causes, { ...draft, id }]);
    } else {
      onUpdate(causes.map(c => c.id === editing ? draft : c));
    }
    setEditing(null);
  };
  const remove = (id) => {
    if (id === 'work' || id === 'personal' || id === 'other') return;
    onUpdate(causes.filter(c => c.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-medium text-stone-900">{t.causes}</h3>
        <Btn variant="soft" onClick={startNew} className="!py-1.5 !px-3 !text-xs">
          <Plus size={12} className="inline mr-1"/> {t.addCause}
        </Btn>
      </div>
      {causes.map(c => (
        <div key={c.id} className="px-4 py-3 border-b border-stone-50 last:border-0">
          {editing === c.id ? (
            <div className="grid grid-cols-2 gap-2">
              <Input value={draft.label_ru} onChange={e => setDraft({...draft, label_ru: e.target.value})} placeholder={t.causeLabelRu} />
              <Input value={draft.label_tk} onChange={e => setDraft({...draft, label_tk: e.target.value})} placeholder={t.causeLabelTk} />
              <div className="col-span-2 flex gap-2 justify-end">
                <Btn variant="ghost" onClick={() => setEditing(null)}>{t.cancel}</Btn>
                <Btn variant="primary" onClick={saveEdit}>{t.save}</Btn>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-stone-900 text-sm">{c.label_ru}</div>
                <div className="text-xs text-stone-500">{c.label_tk}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(c)} className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg">
                  <Edit2 size={14}/>
                </button>
                {!['work','personal','other'].includes(c.id) && (
                  <button onClick={() => remove(c.id)} className="p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      {editing === '__new' && (
        <div className="px-4 py-3 bg-stone-50">
          <div className="grid grid-cols-2 gap-2">
            <Input value={draft.label_ru} onChange={e => setDraft({...draft, label_ru: e.target.value})} placeholder={t.causeLabelRu} />
            <Input value={draft.label_tk} onChange={e => setDraft({...draft, label_tk: e.target.value})} placeholder={t.causeLabelTk} />
            <div className="col-span-2 flex gap-2 justify-end">
              <Btn variant="ghost" onClick={() => setEditing(null)}>{t.cancel}</Btn>
              <Btn variant="primary" onClick={saveEdit}>{t.save}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UsersSection = ({ lang, users, currentUserId, onUpdate }) => {
  const t = T[lang];
  const [editing, setEditing] = useState(null); // user object or 'new' or null

  const handleSave = (user, isNew) => {
    if (isNew) onUpdate([...users, user]);
    else       onUpdate(users.map(u => u.id === user.id ? user : u));
    setEditing(null);
  };

  const handleDelete = (u) => {
    if (u.id === currentUserId) {
      window.alert(t.cannotDeleteSelf);
      return;
    }
    if (!window.confirm(t.deleteUserConfirm)) return;
    onUpdate(users.filter(x => x.id !== u.id));
  };

  // Group by role
  const grouped = ROLES.map(r => ({ role: r, items: users.filter(u => u.role === r.id) }));

  return (
    <div>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-stone-900">{t.users}</h3>
            <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
              <Shield size={11}/> {t.secretaryAlsoAdmin}
            </div>
          </div>
          <Btn variant="soft" onClick={() => setEditing('new')} className="!py-1.5 !px-3 !text-xs">
            <Plus size={12} className="inline mr-1"/> {t.addUser}
          </Btn>
        </div>

        {grouped.map(g => g.items.length === 0 ? null : (
          <div key={g.role.id}>
            <div className="px-4 pt-3 pb-1 text-xs font-medium text-stone-500 uppercase tracking-wide">
              {g.role[`label_${lang}`]}
            </div>
            {g.items.map(u => (
              <div key={u.id} className="px-4 py-3 border-b border-stone-50 last:border-0 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-stone-100 rounded-full flex items-center justify-center shrink-0">
                    <UserCircle size={18} className="text-stone-500"/>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-stone-900 text-sm flex items-center gap-2 flex-wrap">
                      {u.displayName}
                      {u.id === currentUserId && <Badge tone="info">{t.activeUser}</Badge>}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-1">
                      <KeyRound size={10}/> {u.username}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(u)} className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg">
                    <Edit2 size={14}/>
                  </button>
                  <button onClick={() => handleDelete(u)}
                          className="p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg">
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {editing && <UserModal lang={lang}
                             user={editing === 'new' ? null : editing}
                             existingUsernames={users.map(u => u.username)}
                             onSave={handleSave}
                             onClose={() => setEditing(null)} />}
    </div>
  );
};

// ============================================================
// Boss view
// ============================================================
const BossView = ({ lang, appointments, employees, causes, role, onAction }) => {
  const t = T[lang];
  const [tab, setTab] = useState('today');
  const [rejecting, setRejecting] = useState(null);

  const my = useMemo(() => appointments.filter(a => a.bossId === role), [appointments, role]);

  const todayList = useMemo(() => {
    const td = today();
    return my.filter(a => a.date === td ||
      (a.date < td && (a.status === 'approved' || a.status === 'invited')));
  }, [my]);

  const pending = useMemo(() => todayList
    .filter(a => a.status === 'pending')
    .sort((a,b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return new Date(a.history[0].at) - new Date(b.history[0].at);
    }), [todayList]);

  const queue = useMemo(() => todayList
    .filter(a => a.status === 'approved' || a.status === 'invited')
    .sort((a,b) => {
      if (a.status === 'invited' && b.status !== 'invited') return -1;
      if (b.status === 'invited' && a.status !== 'invited') return 1;
      return new Date(a.history.find(h=>h.action==='approve')?.at || 0)
           - new Date(b.history.find(h=>h.action==='approve')?.at || 0);
    }), [todayList]);

  const futureList = useMemo(() =>
    my.filter(a => a.date > today()).sort((a,b) => a.date.localeCompare(b.date))
  , [my]);

  const tabs = [
    { id: 'today',     label: t.today,     icon: Calendar,   count: pending.length },
    { id: 'future',    label: t.future,    icon: Clock,      count: futureList.length },
    { id: 'analytics', label: t.analytics, icon: BarChart3 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-5">
        <div className="text-xs text-stone-500 uppercase tracking-wide">{roleName(role, lang)}</div>
        <h2 className="text-xl font-semibold text-stone-900">{fmtDate(today(), lang)}</h2>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'today' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-stone-900">{t.pendingDecision}</h3>
              <span className="text-xs text-stone-400">({pending.length})</span>
            </div>
            <div className="space-y-3">
              {pending.length === 0
                ? <Empty text={t.noPending} />
                : pending.map(a => (
                    <AppointmentCard key={a.id} a={a} lang={lang}
                      employees={employees} causes={causes} role={role}
                      onAction={(op, ap) => op==='rejectStart' ? setRejecting(ap) : onAction(op, ap)} />
                  ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-stone-900">{t.awaitingPickup}</h3>
              <span className="text-xs text-stone-400">({queue.length})</span>
            </div>
            <div className="space-y-3">
              {queue.length === 0
                ? <Empty text={t.noApproved} />
                : queue.map(a => (
                    <AppointmentCard key={a.id} a={a} lang={lang}
                      employees={employees} causes={causes} role={role} onAction={onAction} />
                  ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'future' && (
        <div className="space-y-3">
          {futureList.length === 0
            ? <Empty text={t.nothingHere} />
            : futureList.map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="text-xs text-stone-500 w-16 shrink-0">{fmtDate(a.date, lang)}</div>
                  <div className="flex-1">
                    <AppointmentCard a={a} lang={lang}
                      employees={employees} causes={causes} role={role} onAction={onAction} />
                  </div>
                </div>
              ))}
        </div>
      )}

      {tab === 'analytics' && <BossAnalytics lang={lang} appointments={my} />}

      {rejecting && <RejectModal lang={lang} appt={rejecting} employees={employees}
                                 onConfirm={(r) => { onAction('reject', rejecting, r); setRejecting(null); }}
                                 onClose={() => setRejecting(null)} />}
    </div>
  );
};

const BossAnalytics = ({ lang, appointments }) => {
  const t = T[lang];
  const td = today();
  const todayAppts = appointments.filter(a => a.date === td);
  const stats = {
    total:     todayAppts.length,
    approved:  todayAppts.filter(a => ['approved','invited','completed'].includes(a.status)).length,
    rejected:  todayAppts.filter(a => a.status === 'rejected').length,
    completed: todayAppts.filter(a => a.status === 'completed').length,
    urgent:    todayAppts.filter(a => a.urgent).length,
  };
  const cards = [
    { label: t.totalToday,     value: stats.total,     tone: 'bg-stone-50   text-stone-900'  },
    { label: t.approvedCount,  value: stats.approved,  tone: 'bg-emerald-50 text-emerald-700' },
    { label: t.rejectedCount,  value: stats.rejected,  tone: 'bg-rose-50    text-rose-700'    },
    { label: t.completedCount, value: stats.completed, tone: 'bg-indigo-50  text-indigo-700'  },
    { label: t.urgentCount,    value: stats.urgent,    tone: 'bg-amber-50   text-amber-800'   },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map(c => (
        <div key={c.label} className={`${c.tone} rounded-2xl p-4`}>
          <div className="text-3xl font-semibold">{c.value}</div>
          <div className="text-xs mt-1 opacity-75">{c.label}</div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// Main App
// ============================================================
export default function App() {
  const [lang, setLang]               = useState('ru');
  const [users, setUsers]             = useState(INITIAL_USERS);
  const [currentUserId, setCurrentUserId] = useState('u_sec1');  // null = worker (public page)
  const [appointments, setAppts]      = useState(buildInitialAppointments());
  const [employees]                   = useState(INITIAL_EMPLOYEES);
  const [causes, setCauses]           = useState(INITIAL_CAUSES);
  const [notifs, setNotifs]           = useState([]);
  const [toast, setToast]             = useState(null);
  const [loaded, setLoaded]           = useState(false);

  const currentUser = users.find(u => u.id === currentUserId);
  const role = currentUser?.role || 'worker';
  const roleKind = ROLE_KIND(role) || 'worker';

  // Load persisted
  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (s) {
        if (s.appointments) setAppts(s.appointments);
        if (s.causes)       setCauses(s.causes);
        if (s.users)        setUsers(s.users);
        if (s.lang)         setLang(s.lang);
      }
      setLoaded(true);
    })();
  }, []);

  // Save on change
  useEffect(() => {
    if (!loaded) return;
    saveState({ appointments, causes, users, lang });
  }, [appointments, causes, users, lang, loaded]);

  const showToast = (toast) => setToast({ ...toast, id: Date.now() });
  const addNotif = (n) => setNotifs(prev => [...prev, { ...n, id: Date.now() + Math.random() }]);

  const appendHistory = (a, action, by, note) => ({
    ...a,
    history: [...a.history, { action, by, at: new Date().toISOString(), ...(note ? { note } : {}) }]
  });

  // ----- Actions (would map to backend endpoints) -----
  const handleCreate = (form) => {
    const newAppt = {
      id: Math.max(0, ...appointments.map(a => a.id)) + 1,
      visitorType: form.visitorType,
      employeeId: form.employeeId,
      visitor: form.visitor,
      bossId: form.bossId,
      causeId: form.causeId,
      customCause: form.customCause,
      urgent: form.urgent,
      date: form.date,
      status: 'pending',
      history: [{ action: 'create', by: currentUserId, at: new Date().toISOString() }],
    };
    setAppts(prev => [...prev, newAppt]);
    const v = visitorDisplay(newAppt, employees);
    showToast({ title: T[lang].requestCreated, body: `${v.name} → ${bossName(form.bossId, lang)}`, tone: 'success' });
    addNotif({ title: T[lang].notif_newRequest, body: `${v.name}${form.urgent ? ' ⚡' : ''} → ${bossName(form.bossId, lang)}` });
  };

  const handleAction = (op, a, payload) => {
    const v = visitorDisplay(a, employees);
    if (op === 'approve') {
      setAppts(prev => prev.map(x => x.id === a.id
        ? { ...appendHistory(x, 'approve', currentUserId), status: 'approved' } : x));
      showToast({ title: T[lang].notif_approved, body: v.name, tone: 'success' });
      addNotif({ title: T[lang].notif_approved, body: v.name });
    }
    if (op === 'reject') {
      setAppts(prev => prev.map(x => x.id === a.id
        ? { ...appendHistory(x, 'reject', currentUserId, payload), status: 'rejected', rejectionReason: payload || undefined } : x));
      showToast({ title: T[lang].notif_rejected, body: v.name });
      addNotif({ title: T[lang].notif_rejected, body: v.name });
    }
    if (op === 'invite') {
      setAppts(prev => prev.map(x => x.id === a.id
        ? { ...appendHistory(x, 'invite', currentUserId), status: 'invited' } : x));
      showToast({ title: `${bossName(a.bossId, lang)} ${T[lang].inviteToast}`, body: v.name, tone: 'urgent' });
      addNotif({ title: T[lang].notif_invited, body: `${bossName(a.bossId, lang)} → ${v.name}` });
    }
    if (op === 'complete') {
      setAppts(prev => prev.map(x => x.id === a.id
        ? { ...appendHistory(x, 'complete', currentUserId), status: 'completed' } : x));
      showToast({ title: T[lang].notif_completed, body: v.name });
    }
  };

  const handleReset = () => {
    setAppts(buildInitialAppointments());
    setCauses(INITIAL_CAUSES);
    setUsers(INITIAL_USERS);
    setNotifs([]);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900"
         style={{fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", system-ui, sans-serif'}}>
      <TopBar lang={lang} setLang={setLang}
              currentUserId={currentUserId} setCurrentUserId={setCurrentUserId}
              users={users}
              notifs={notifs} onClearNotifs={() => setNotifs([])} />

      {roleKind === 'worker' && <WorkerView lang={lang} appointments={appointments}
                                             employees={employees} causes={causes} />}
      {roleKind === 'staff'  && <SecretaryView lang={lang} appointments={appointments}
                                                employees={employees} causes={causes} role={role}
                                                currentUserId={currentUserId}
                                                users={users}
                                                onAction={handleAction} onCreate={handleCreate}
                                                onUpdateCauses={setCauses}
                                                onUpdateUsers={setUsers}
                                                onReset={handleReset} />}
      {roleKind === 'boss'   && <BossView lang={lang} appointments={appointments}
                                           employees={employees} causes={causes} role={role}
                                           onAction={handleAction} />}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
