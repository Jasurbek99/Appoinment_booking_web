import { useState, useMemo } from 'react';
import { Modal, Btn, Input, Select, Empty, Badge } from './primitives.jsx';
import { useEmployeeSearch, useFirms } from '../hooks/useEmployees.js';
import { useCauses } from '../hooks/useCauses.js';
import { useCreateAppointment } from '../hooks/useAppointments.js';
import { useUsers } from '../hooks/useUsers.js';
import { useToast } from '../contexts/ToastProvider.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { ApiError } from '../lib/api.js';
import { todayLocalISO } from '../lib/format.js';

const TAB_IDS = ['employee', 'guest', 'foreign'];

export function NewAppointmentModal({ open, onClose }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState('employee');
  const [employee, setEmployee] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [bossId, setBossId] = useState('boss1');
  const [causeId, setCauseId] = useState('work');
  const [customCause, setCustomCause] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [date, setDate] = useState(todayLocalISO());
  const [duplicate, setDuplicate] = useState(null);

  const { push } = useToast();
  const { data: causes = [] } = useCauses({ kind: 'visit' });
  const { data: users = [] } = useUsers();
  const create = useCreateAppointment();

  const bossOptions = ['boss1', 'boss2', 'boss3'].map((id) => {
    const u = users.find((x) => x.role === id);
    return { id, label: u ? u.displayName : t(`role${id[0].toUpperCase()}${id.slice(1)}`) };
  });

  function reset() {
    setTab('employee');
    setEmployee(null);
    setManualMode(false);
    setFirst('');
    setLast('');
    setCompany('');
    setPhone('');
    setBossId('boss1');
    setCauseId('work');
    setCustomCause('');
    setUrgent(false);
    setDate(todayLocalISO());
    setDuplicate(null);
  }

  async function submit({ force = false } = {}) {
    setDuplicate(null);
    // Phone is captured for employees/local guests only; foreign visitors skip it.
    const phoneField = tab === 'foreign' ? null : phone.trim() || null;
    let input;
    if (tab === 'employee' && employee && !manualMode) {
      // Snapshot the name + company on the appointment row alongside employeeId
      // so the audit log keeps working even if the employee-API cache expires
      // (it's an in-memory LRU with a 5-min TTL). The DTO serializer prefers
      // the live cache lookup but falls back to these snapshot fields.
      input = {
        visitorType: 'employee',
        employeeId: employee.id,
        visitor: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          company: employee.company || null,
          phone: phoneField,
        },
        bossId,
        causeId,
        urgent,
        date,
        ...(causeId === 'other' ? { customCause } : {}),
      };
    } else {
      input = {
        visitorType: tab,
        visitor: { firstName: first, lastName: last, company: company || null, phone: phoneField },
        bossId,
        causeId,
        urgent,
        date,
        ...(causeId === 'other' ? { customCause } : {}),
      };
    }

    try {
      await create.mutateAsync({ input, force });
      push({ kind: 'success', title: t('requestCreated') });
      reset();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.body?.error === 'duplicate') {
        setDuplicate(err.body.existing);
        return;
      }
      push({ kind: 'error', title: t('errorTitle'), message: err?.code || 'unknown' });
    }
  }

  const canSubmit = useMemo(() => {
    if (tab === 'employee' && employee && !manualMode) return true;
    if (first.trim() && last.trim()) return true;
    return false;
  }, [tab, employee, manualMode, first, last]);

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('newAppointment')}
      size="lg"
      footer={
        <>
          <Btn kind="ghost" onClick={() => { reset(); onClose(); }}>{t('cancel')}</Btn>
          <Btn onClick={() => submit()} disabled={!canSubmit || create.isPending}>
            {t('create')}
          </Btn>
        </>
      }
    >
      <div className="flex gap-1 mb-4 border-b border-stone-200">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            onClick={() => { setTab(id); setEmployee(null); setManualMode(id !== 'employee'); }}
            className={
              'px-3 py-2 text-sm border-b-2 ' +
              (tab === id ? 'border-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900')
            }
          >
            {t(id)}
          </button>
        ))}
      </div>

      {tab === 'employee' && !manualMode ? (
        <EmployeePicker
          selected={employee}
          onSelect={setEmployee}
          onManual={() => setManualMode(true)}
        />
      ) : (
        <ManualEntry
          first={first} setFirst={setFirst}
          last={last} setLast={setLast}
          company={company} setCompany={setCompany}
          showBackToSearch={tab === 'employee'}
          onBack={() => { setManualMode(false); }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <label className="text-sm text-stone-600">{t('boss')}</label>
          <Select value={bossId} onChange={(e) => setBossId(e.target.value)}>
            {bossOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('date')}</label>
          <Input type="date" value={date} min={todayLocalISO()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-stone-600">{t('cause')}</label>
          <Select value={causeId} onChange={(e) => setCauseId(e.target.value)}>
            {causes.map((c) => (
              <option key={c.id} value={c.id}>{lang === 'tk' ? c.label_tk : c.label_ru}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            {t('urgent')}
          </label>
        </div>
        {tab !== 'foreign' && (
          <div className="col-span-2">
            <label className="text-sm text-stone-600">{t('phoneOptional')}</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+993 ..."
            />
          </div>
        )}
        {causeId === 'other' && (
          <div className="col-span-2">
            <label className="text-sm text-stone-600">{t('customCause')}</label>
            <Input value={customCause} onChange={(e) => setCustomCause(e.target.value)} />
          </div>
        )}
      </div>

      {duplicate && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm">
          {t('duplicateConfirm').replace('{status}', duplicate.status)}
          <div className="mt-2 flex gap-2 justify-end">
            <Btn size="sm" kind="ghost" onClick={() => setDuplicate(null)}>{t('cancel')}</Btn>
            <Btn size="sm" onClick={() => submit({ force: true })}>{t('createAnyway')}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EmployeePicker({ selected, onSelect, onManual }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [firm, setFirm] = useState('');
  const { data: firmsData } = useFirms();
  const { data, isFetching } = useEmployeeSearch(q, firm);

  const firms = firmsData?.firms || [];
  const placeholder = firm ? t('searchByNameOrLastName') : t('searchEmployee');
  const emptyHint = q || firm ? t('noResults') : t('enterQueryOrFirm');

  return (
    <div>
      <div className="flex gap-2">
        <div className="w-44 shrink-0">
          <Select value={firm} onChange={(e) => setFirm(e.target.value)}>
            <option value="">{t('allFirms')}</option>
            {firms.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Input
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      {data?.degraded && (
        <div className="mt-2 text-xs text-stone-500">
          {t('catalogUnavailable')}
        </div>
      )}
      <div className="mt-3 max-h-56 overflow-auto">
        {(data?.results || []).length === 0 ? (
          <Empty>{isFetching ? t('searching') : emptyHint}</Empty>
        ) : (
          <ul className="space-y-1">
            {data.results.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelect(e)}
                  className={
                    'w-full text-left rounded-xl border px-3 py-2 ' +
                    (selected?.id === e.id ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:bg-stone-50')
                  }
                >
                  <div className="text-sm">{e.firstName} {e.lastName}</div>
                  <div className="text-xs text-stone-500">{e.company}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && (
        <div className="mt-2 text-sm">
          {t('selectedLabel')}: <Badge kind="info">{selected.firstName} {selected.lastName}</Badge>
        </div>
      )}
      <div className="mt-3 text-right">
        <Btn kind="ghost" size="sm" onClick={onManual}>{t('addManually')}</Btn>
      </div>
    </div>
  );
}

function ManualEntry({ first, setFirst, last, setLast, company, setCompany, showBackToSearch, onBack }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-sm text-stone-600">{t('firstName')}</label>
        <Input value={first} onChange={(e) => setFirst(e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-stone-600">{t('lastName')}</label>
        <Input value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="text-sm text-stone-600">{t('company')}</label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      {showBackToSearch && (
        <div className="col-span-2 text-right">
          <Btn kind="ghost" size="sm" onClick={onBack}>{t('backToSearchLong')}</Btn>
        </div>
      )}
    </div>
  );
}
